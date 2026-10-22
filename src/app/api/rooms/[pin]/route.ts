import {db,hash,same,bad} from "@/lib/store";
import {quizPartySnapshot,type QuizPartySnapshot,type QuizRoomMeta} from "@/lib/quiz-party-snapshot";
import {verifyRoomReadToken} from "@/lib/room-read-token";
import {quizPartySignedPlayerResponse} from "@/lib/room-response-fast";
type VerifiedViewer={id:string;answered?:boolean;is_correct?:boolean;points?:number};
function quizPartyResponse(r:QuizRoomMeta,snapshot:QuizPartySnapshot,host:boolean,me:VerifiedViewer[]){
   const {players,submitted,answers}=snapshot;
   const allAnswered=r.status==="playing"&&players.length>0&&submitted>=players.length;
   const expired=r.status==="playing"&&r.deadline&&new Date(r.deadline).getTime()<=new Date(r.server_time).getTime();
   const canShowResult=r.status==="finished"||Boolean(expired)||allAnswered;
   const playerAnswer=me[0];
   // Each player's own answer is obtained from the authenticated lookup,
   // not from the shared cache. Results remain hidden while a round is open.
   const myResult=canShowResult&&playerAnswer?.answered
    ?{is_correct:playerAnswer.is_correct,points:playerAnswer.points}:null;
   const allowedQuestion=r.status==="playing"&&snapshot.question?{
    question:snapshot.question.question,choices:snapshot.question.choices,
    image_url:snapshot.question.image_url,audio_url:snapshot.question.audio_url,
    formula_text:snapshot.question.formula_text
   }:null;
   const hostAnswer=host&&canShowResult?snapshot.question:null;
   const hostResults=hostAnswer?{
    correctIndex:Number(hostAnswer.correct_index),
    questionText:String(hostAnswer.question||""),
    correctAnswer:Array.isArray(hostAnswer.choices)?String(hostAnswer.choices[Number(hostAnswer.correct_index)]||""):"",
    correctCount:answers.filter(a=>a.is_correct===true).length,
    wrongCount:answers.filter(a=>a.is_correct===false).length,
    pendingCount:Math.max(0,players.length-submitted),
    choiceCounts:[0,1,2,3].map(index=>answers.filter(a=>Number(a.chosen_index)===index).length),
    playerResults:answers.map(a=>({id:a.player_id,correct:a.is_correct===true}))
   }:null;
   return Response.json({
    status:r.status,index:r.current_index,deadline:r.deadline,
    gameMode:r.game_mode,muteSounds:r.mute_sounds,scoreGoal:r.score_goal,
    serverTime:r.server_time,allAnswered,roundReady:r.status==="playing"&&(Boolean(expired)||allAnswered),
    rewardsPending:false,scoreboardPhase:r.round_open?"previous-round":"settled",
    total:snapshot.total,question:allowedQuestion,players,answeredCount:submitted,
    answeredIds:host?answers.map(a=>a.player_id):(playerAnswer?.answered?[playerAnswer.id]:[]),
    ...(host?{hostResults}:{}),
    viewer:{host,playerId:playerAnswer?.id||null,mode:null,result:myResult}
   },{headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
}

export const runtime="nodejs";
/** All viewers see one authoritative score snapshot. Current-round points stay hidden until timeout. */
export async function GET(req:Request,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params;
 if(!/^\d{6}$/.test(pin))return bad("Invalid PIN");
 try{
  // Room-scoped signed read capability avoids 1,000 repetitive Neon identity
  // queries. Every response still checks live room membership in a 200ms
  // server-only snapshot. It cannot authorize game writes or Host grading.
  const readIdentity=verifyRoomReadToken(pin,req.headers.get("x-player-read-token"));
  if(readIdentity&&process.env.ZOKIVO_ROOM_FAST_PATH_ENABLED!=="false"){
   const fast=await quizPartySnapshot(pin,"signed-player");
   if(fast.room.game_mode==="quiz_party"){
    const response=quizPartySignedPlayerResponse(fast,readIdentity);
    if(!response)return bad("Unauthorized",401);
    return response;
   }
  }
  const sql=db();
  // One round trip validates the player's session and loads their own
  // answer. Authentication never depends on a cached shared snapshot.
  const hostKey=req.headers.get("x-host-token"),playerKey=req.headers.get("x-player-token");
  const playerHash=playerKey?hash(playerKey):"0".repeat(64);
  const found=await sql`SELECT r.pin,r.quiz_set_id,r.status,r.current_index,r.deadline,r.host_token_hash,
   r.game_mode,r.question_order,r.mute_sounds,r.score_goal,now() AS server_time,
   (r.status='playing' AND r.deadline>now()) AS round_open,
   p.id AS player_id,(a.id IS NOT NULL) AS answered,a.is_correct AS player_is_correct,a.points AS player_points
   FROM rooms r
   LEFT JOIN LATERAL (
    SELECT id FROM players WHERE room_pin=r.pin AND token_hash=${playerHash} LIMIT 1
   ) p ON true
   LEFT JOIN LATERAL (
    SELECT id,is_correct,points FROM answers
    WHERE player_id=p.id AND room_pin=r.pin AND question_index=r.current_index LIMIT 1
   ) a ON true
   WHERE r.pin=${pin}`;
  if(!found.length)return bad("Room not found",404);
  const r=found[0];
  const host=!!hostKey&&same(r.host_token_hash,hash(hostKey));
  const me=r.player_id?[{id:r.player_id,answered:r.answered,
   is_correct:r.player_is_correct,points:r.player_points}]:[];
  if(!host&&!me.length)return bad("Unauthorized",401);
  // Fast path: Quiz Party is the majority of student traffic. Authenticate
  // BEFORE consulting a shared cache; no tokens or answer keys are cached.
  if(r.game_mode==="quiz_party"&&process.env.ZOKIVO_ROOM_FAST_PATH_ENABLED!=="false"){
   const key=[r.status,r.current_index,r.round_open?"open":"closed",
    r.deadline?new Date(r.deadline).getTime():0].join(":");
   const snapshot=await quizPartySnapshot(pin,key);
   return quizPartyResponse(r as unknown as QuizRoomMeta,snapshot,host,me);
  }
  // Identical score policy for host and player. Do not leak correct answers via current-round score changes.
  // Aggregate answer points and mode-event totals ONCE per room, rather
  // than running two correlated SUM queries for each of its 100 players.
  // Keep in-flight scores hidden until the deadline/round settlement.
  const players=await sql`WITH prior_scores AS (
    SELECT a.player_id,SUM(a.points)::integer AS settled_points
    FROM answers a JOIN rooms r ON r.pin=a.room_pin
    WHERE a.room_pin=${pin} AND r.status='playing' AND r.deadline>now()
      AND a.question_index<r.current_index
    GROUP BY a.player_id
   ),
   mode_amount_rows AS (
    SELECT e.player_id,e.delta AS amount
    FROM mode_events e JOIN rooms r ON r.pin=e.room_pin
    WHERE e.room_pin=${pin} AND r.game_mode<>'quiz_party'
      AND (r.status='finished' OR r.deadline<=now() OR e.question_index<r.current_index)
    UNION ALL
    SELECT e.target_player_id AS player_id,e.target_delta AS amount
    FROM mode_events e JOIN rooms r ON r.pin=e.room_pin
    WHERE e.room_pin=${pin} AND e.target_player_id IS NOT NULL AND r.game_mode<>'quiz_party'
      AND (r.status='finished' OR r.deadline<=now() OR e.question_index<r.current_index)
   ),
   mode_totals AS (
    SELECT player_id,SUM(amount)::integer AS total
    FROM mode_amount_rows GROUP BY player_id
   )
   SELECT p.id,p.nickname,p.avatar_id,
    (CASE WHEN r.game_mode='quiz_party' THEN 0 ELSE COALESCE(m.total,0) END)::integer AS mode_score,
    (CASE WHEN r.status='playing' AND r.deadline>now()
      THEN COALESCE(pr.settled_points,0) ELSE p.score END)::integer AS score
   FROM players p INNER JOIN rooms r ON r.pin=p.room_pin
   LEFT JOIN prior_scores pr ON pr.player_id=p.id
   LEFT JOIN mode_totals m ON m.player_id=p.id
   WHERE p.room_pin=${pin} ORDER BY score DESC,p.created_at ASC`;
  const position=Array.isArray(r.question_order)?r.question_order[r.current_index]:r.current_index;
  const question=r.status==="playing"?await sql`SELECT question,choices,image_url,audio_url,formula_text FROM questions
   WHERE quiz_set_id=${r.quiz_set_id} AND position=${position??r.current_index}`:[];
  const count=await sql`SELECT count(*)::integer AS n FROM questions WHERE quiz_set_id=${r.quiz_set_id}`;
  const ownMode=me.length&&r.game_mode!=="quiz_party"?await sql`SELECT
    EXISTS(SELECT 1 FROM answers WHERE player_id=${me[0].id} AND room_pin=${pin} AND question_index=${r.current_index} AND is_correct) AND
    NOT EXISTS(SELECT 1 FROM mode_events WHERE player_id=${me[0].id} AND question_index=${r.current_index}) AS reward_ready,
    COALESCE((SELECT credits FROM mode_wallets WHERE player_id=${me[0].id}),0)::integer AS credits,
    COALESCE((SELECT fish_count FROM mode_wallets WHERE player_id=${me[0].id}),0)::integer AS fish,
    COALESCE((SELECT served_count FROM mode_wallets WHERE player_id=${me[0].id}),0)::integer AS served,
    COALESCE((SELECT cafe_level FROM mode_wallets WHERE player_id=${me[0].id}),1)::integer AS cafe_level,
    (SELECT defense_code FROM players WHERE id=${me[0].id}) AS defense_code`:[];
  // Players receive ONE aggregate row, not 100 classmates' answer records.
  // Only hosts fetch per-player grading data for the closed-round review.
  const answers=host?await sql`SELECT player_id,chosen_index,is_correct FROM answers WHERE room_pin=${pin} AND question_index=${r.current_index}`:[];
  const answerSummary=host?[]:await sql`SELECT count(*)::integer AS submitted,
    (count(*) FILTER(WHERE player_id=${me[0].id})>0) AS mine
    FROM answers WHERE room_pin=${pin} AND question_index=${r.current_index}`;
  const submitted=host?answers.length:Number(answerSummary[0]?.submitted||0);
  // Everyone answering closes the ANSWERING phase early; reward games stay open
  // until successful answer bonuses have been claimed by those eligible.
  const allAnswered=r.status==='playing'&&players.length>0&&submitted>=players.length;
  const outstandingRewards=allAnswered&&r.game_mode!=='quiz_party'?await sql`SELECT count(*)::integer AS n FROM answers a
   WHERE a.room_pin=${pin} AND a.question_index=${r.current_index} AND a.is_correct
    AND NOT EXISTS(SELECT 1 FROM mode_events e WHERE e.room_pin=${pin} AND e.question_index=${r.current_index} AND e.player_id=a.player_id)`:[];
  const rewardsPending=(outstandingRewards[0]?.n||0)>0;
  const expired=r.status==='playing'&&r.deadline&&new Date(r.deadline).getTime()<=new Date(r.server_time).getTime();
  // An individual result is revealed only when EVERY player is done or time is up.
  const canShowResult=r.status==='finished'||Boolean(expired)||allAnswered;
  const myResult=canShowResult&&me.length?await sql`SELECT is_correct,points FROM answers
    WHERE player_id=${me[0].id} AND room_pin=${pin} AND question_index=${r.current_index} LIMIT 1`:[];
  const canAdvance=r.status==='playing'&&(Boolean(expired)||(allAnswered&&!rewardsPending));
  // Only the authenticated host sees grading details, and only after the
  // answering window is closed. Projected host screens never reveal early.
  const hostAnswer=host&&canShowResult&&(r.status==="playing"||r.status==="finished")
   ?await sql`SELECT correct_index,question,choices FROM questions WHERE quiz_set_id=${r.quiz_set_id} AND position=${position??r.current_index} LIMIT 1`:[];
  const hostResults=hostAnswer.length?{
   correctIndex:Number(hostAnswer[0].correct_index),
   questionText:String(hostAnswer[0].question||""),
   correctAnswer:Array.isArray(hostAnswer[0].choices)?String(hostAnswer[0].choices[Number(hostAnswer[0].correct_index)]||""):"",
   correctCount:answers.filter(a=>a.is_correct===true).length,
   wrongCount:answers.filter(a=>a.is_correct===false).length,
   pendingCount:Math.max(0,players.length-submitted),
   choiceCounts:[0,1,2,3].map(index=>answers.filter(a=>Number(a.chosen_index)===index).length),
   playerResults:answers.map(a=>({id:a.player_id,correct:a.is_correct===true}))
  }:null;
  return Response.json({
   status:r.status,index:r.current_index,deadline:r.deadline,gameMode:r.game_mode,muteSounds:r.mute_sounds,scoreGoal:r.score_goal,
   serverTime:r.server_time,allAnswered,roundReady:canAdvance,rewardsPending,scoreboardPhase:r.round_open?"previous-round":"settled",
   total:count[0].n,question:question[0]||null,players,answeredCount:submitted,
   answeredIds:host?answers.map(a=>a.player_id):(answerSummary[0]?.mine?[me[0].id]:[]),
   ...(host?{hostResults}:{}),
   viewer:{host,playerId:me[0]?.id||null,mode:ownMode[0]||null,result:myResult[0]||null}
  },{headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
 }catch(e){console.error("Game status unavailable",e);return bad("Game unavailable",503)}
}
