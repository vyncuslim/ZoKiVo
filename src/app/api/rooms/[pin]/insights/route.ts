import {NextRequest} from "next/server";
import {db,hash,same,bad} from "@/lib/store";
import {findUser,applyRenew,noCache,authError} from "@/lib/mother-auth";

export const runtime="nodejs";

/**
 * Results are read-only and unlock AFTER a game finishes.
 * Player tokens grant access only to their owner's submitted answers.
 * Room-wide reports require both the host session token AND the original
 * signed-in room owner. A six-digit game PIN is never an access credential.
 * This endpoint deliberately does not modify any existing UI or game flow.
 */
export async function GET(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 try{
  const {pin}=await params;
  if(!/^\d{6}$/.test(pin))return bad("Invalid game PIN",400);
  const hostToken=req.headers.get("x-host-token");
  const playerToken=req.headers.get("x-player-token");
  if(!hostToken&&!playerToken)return bad("Game session required",401);

  const sql=db();
  const rooms=await sql`SELECT r.status,r.quiz_set_id,r.current_index,r.question_order,
    r.host_token_hash,r.owner_user_id,r.game_mode,q.title
    FROM rooms r JOIN quiz_sets q ON q.id=r.quiz_set_id
    WHERE r.pin=${pin} LIMIT 1`;
  if(!rooms.length)return bad("Game room not found",404);
  const room=rooms[0];
  const asHost=!!hostToken&&same(room.host_token_hash,hash(hostToken));
  const signedIn=asHost?await findUser(req):null;
  if(asHost&&(!signedIn?.user||!room.owner_user_id||room.owner_user_id!==signedIn.user.id))
   return bad("Only the original signed-in host can view class results",403);

  let player:{id:string;nickname:string;score:number;avatar_id:string}|null=null;
  if(!asHost){
   if(!playerToken)return bad("Player session required",401);
   const matches=await sql`SELECT id,nickname,score,avatar_id FROM players
    WHERE room_pin=${pin} AND token_hash=${hash(playerToken)} LIMIT 1`;
   if(!matches.length)return bad("Invalid player session",403);
   player={id:String(matches[0].id),nickname:String(matches[0].nickname),score:Number(matches[0].score),avatar_id:String(matches[0].avatar_id)};
  }
  if(room.status!=="finished")return bad("Answer review unlocks only after the game ends",409);

  if(player){
   // This query is scoped by the verified player UUID; it NEVER returns
   // another player's answer, name, or result.
   const rows=await sql`SELECT a.question_index,q.question,q.choices,q.correct_index,
    q.explanation,a.chosen_index,a.is_correct,a.points
    FROM answers a JOIN rooms r ON r.pin=a.room_pin
    JOIN questions q ON q.quiz_set_id=r.quiz_set_id
     AND q.position=COALESCE((r.question_order->>a.question_index)::integer,a.question_index)
    WHERE a.room_pin=${pin} AND a.player_id=${player.id}
    ORDER BY a.question_index`;
   const review=rows.map(a=>({
    number:Number(a.question_index)+1,
    question:String(a.question),
    yourAnswer:Array.isArray(a.choices)?String(a.choices[a.chosen_index]??""):"",
    correctAnswer:Array.isArray(a.choices)?String(a.choices[a.correct_index]??""):"",
    correct:a.is_correct===true,
    points:Number(a.points)||0,
    explanation:typeof a.explanation==="string"?a.explanation:""
   }));
   const correct=review.filter(r=>r.correct).length;
   return noCache({
    scope:"player",pin,title:room.title,gameMode:room.game_mode,
    player:{nickname:player.nickname,avatarId:player.avatar_id,score:Number(player.score),
     answered:review.length,correct,wrong:review.length-correct},
    review
   });
  }

  const players=await sql`SELECT p.id,p.nickname,p.avatar_id,p.score,
   count(a.id)::integer AS answered,count(a.id) FILTER(WHERE a.is_correct)::integer AS correct
   FROM players p LEFT JOIN answers a ON a.player_id=p.id AND a.room_pin=${pin}
   WHERE p.room_pin=${pin} GROUP BY p.id
   ORDER BY p.score DESC,p.created_at ASC`;
  const questions=await sql`SELECT q.position,q.question,q.choices,q.correct_index,q.explanation,
   count(a.id)::integer AS submissions,
   count(a.id) FILTER(WHERE a.is_correct)::integer AS correct,
   count(a.id) FILTER(WHERE a.chosen_index=0)::integer AS a,
   count(a.id) FILTER(WHERE a.chosen_index=1)::integer AS b,
   count(a.id) FILTER(WHERE a.chosen_index=2)::integer AS c,
   count(a.id) FILTER(WHERE a.chosen_index=3)::integer AS d
   FROM questions q JOIN rooms r ON r.pin=${pin}
   LEFT JOIN answers a ON a.room_pin=${pin}
    AND q.position=COALESCE((r.question_order->>a.question_index)::integer,a.question_index)
   WHERE q.quiz_set_id=${room.quiz_set_id}
   GROUP BY q.id ORDER BY q.position`;
  const participants=players.map((p,i)=>({
   id:p.id,rank:i+1,nickname:p.nickname,avatarId:p.avatar_id,score:Number(p.score),
   answered:Number(p.answered),correct:Number(p.correct),
   wrong:Number(p.answered)-Number(p.correct)
  }));
  const itemized=questions.map(q=>({
   number:Number(q.position)+1,question:String(q.question),
   correctAnswer:Array.isArray(q.choices)?String(q.choices[q.correct_index]??""):"",
   explanation:typeof q.explanation==="string"?q.explanation:"",
   submissions:Number(q.submissions),correct:Number(q.correct),
   wrong:Number(q.submissions)-Number(q.correct),
   choices:Array.isArray(q.choices)?q.choices:[],
   choiceCounts:[q.a,q.b,q.c,q.d].map(Number)
  }));
  // Detail lookups must be authorized as host; player tokens cannot select an
  // arbitrary student by appending ?player=<uuid>.
  const target=req.nextUrl.searchParams.get("player");
  if(target){
   if(!participants.some(p=>p.id===target))return bad("Student not found",404);
   const attempts=await sql`SELECT a.question_index,q.question,q.choices,q.correct_index,
    q.explanation,a.chosen_index,a.is_correct,a.points
    FROM answers a JOIN rooms r ON r.pin=a.room_pin
    JOIN questions q ON q.quiz_set_id=r.quiz_set_id
     AND q.position=COALESCE((r.question_order->>a.question_index)::integer,a.question_index)
    WHERE a.room_pin=${pin} AND a.player_id=${target}
    ORDER BY a.question_index`;
   const review=attempts.map(a=>({
    number:Number(a.question_index)+1,question:String(a.question),
    yourAnswer:Array.isArray(a.choices)?String(a.choices[a.chosen_index]??""):"",
    correctAnswer:Array.isArray(a.choices)?String(a.choices[a.correct_index]??""):"",
    correct:a.is_correct===true,points:Number(a.points)||0,
    explanation:typeof a.explanation==="string"?a.explanation:""
   }));
   return applyRenew(noCache({scope:"host-student",pin,student:participants.find(p=>p.id===target),review}),req,signedIn?.renew);
  }
  const attempts=participants.reduce((n,p)=>n+p.answered,0);
  const correct=participants.reduce((n,p)=>n+p.correct,0);
  return applyRenew(noCache({scope:"host",pin,title:room.title,gameMode:room.game_mode,
   metrics:{players:participants.length,questions:questions.length,submissions:attempts,
    correct,wrong:attempts-correct,accuracy:attempts?Math.round(100*correct/attempts):0},
   players:participants,questions:itemized}),req,signedIn?.renew);
 }catch(e){return authError(e)}
}
