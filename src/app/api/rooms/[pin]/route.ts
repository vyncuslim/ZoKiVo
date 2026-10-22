import {db,hash,same,bad} from "@/lib/store";
import {quizPartySnapshot} from "@/lib/quiz-party-snapshot";
export const runtime="nodejs";
/** All viewers see one authoritative score snapshot. Current-round points stay hidden until timeout. */
export async function GET(req:Request,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params;
 if(!/^\d{6}$/.test(pin))return bad("Invalid PIN");
 try{
  const sql=db();
  const found=await sql`SELECT pin,quiz_set_id,status,current_index,deadline,host_token_hash,game_mode,question_order,mute_sounds,score_goal,now() AS server_time,
   (status='playing' AND deadline>now()) AS round_open FROM rooms WHERE pin=${pin}`;
  if(!found.length)return bad("Room not found",404);
  const r=found[0],hostKey=req.headers.get("x-host-token"),playerKey=req.headers.get("x-player-token");
  const host=!!hostKey&&same(r.host_token_hash,hash(hostKey));
  const me=playerKey?await sql`SELECT p.id,a.is_correct,a.points,(a.id IS NOT NULL) AS answered
   FROM players p JOIN rooms r ON r.pin=p.room_pin
   LEFT JOIN answers a ON a.player_id=p.id AND a.room_pin=p.room_pin AND a.question_index=r.current_index
   WHERE p.room_pin=${pin} AND p.token_hash=${hash(playerKey)} LIMIT 1`:[];
  if(!host&&!me.length)return bad("Unauthorized",401);
  // Fast path: Quiz Party is the majority of student traffic. Authenticate
  // BEFORE consulting a shared cache; no tokens or answer keys are cached.
  if(r.game_mode==="quiz_party"&&process.env.ZOKIVO_ROOM_FAST_PATH_ENABLED!=="false"){
   const key=[r.status,r.current_index,r.round_open?"open":"closed",
    r.deadline?new Date(r.deadline).getTime():0].join(":");
   const snapshot=await quizPartySnapshot(pin,key);
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
