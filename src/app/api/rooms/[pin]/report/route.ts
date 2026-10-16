import {NextRequest} from "next/server";
import {db,hash,same} from "@/lib/store";
import {findUser,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 try{
  const {pin}=await params;if(!/^\d{6}$/.test(pin))return noCache({error:"Invalid PIN"},400);
  const key=req.headers.get("x-host-token");if(!key)return noCache({error:"Host token required"},401);
  const session=await findUser(req);if(!session.user)return noCache({error:"Sign in as host"},401);
  const sql=db(),room=await sql`SELECT status,quiz_set_id,owner_user_id,host_token_hash FROM rooms WHERE pin=${pin}`;
  if(!room.length||!same(room[0].host_token_hash,hash(key)))return noCache({error:"Not authorized"},403);
  if(room[0].owner_user_id&&room[0].owner_user_id!==session.user.id)return noCache({error:"Only the original host can export results"},403);
  if(room[0].status!=="finished")return noCache({error:"Report available only after the game finishes"},409);
  const players=await sql`SELECT p.nickname,p.score,COUNT(a.id)::integer AS answered,COUNT(a.id) FILTER(WHERE a.is_correct)::integer AS correct FROM players p LEFT JOIN answers a ON a.player_id=p.id AND a.room_pin=${pin} WHERE p.room_pin=${pin} GROUP BY p.id,p.nickname,p.score,p.created_at ORDER BY p.score DESC,p.created_at`;
  const questions=await sql`SELECT q.position,q.question,q.correct_index,q.choices,COUNT(a.id)::integer AS submissions,COUNT(a.id) FILTER(WHERE a.is_correct)::integer AS correct FROM questions q LEFT JOIN answers a ON a.room_pin=${pin} AND a.question_index=q.position WHERE q.quiz_set_id=${room[0].quiz_set_id} GROUP BY q.id,q.position,q.question,q.correct_index,q.choices ORDER BY q.position`;
  return applyRenew(noCache({pin,status:"finished",players:players.map((p,i)=>({rank:i+1,nickname:p.nickname,score:Number(p.score),answered:Number(p.answered),correct:Number(p.correct)})),questions:questions.map(q=>({number:q.position+1,question:q.question,correctAnswer:q.choices[q.correct_index],submissions:Number(q.submissions),correct:Number(q.correct)}))}),req,session.renew);
 }catch(e){return authError(e)}
}
