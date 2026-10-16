import {emitRoomRefresh} from "@/lib/realtime";
import {NextRequest} from "next/server";
import {db,hash,same,bad} from "@/lib/store";
import {findUser,noCache,checkOrigin,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 try{
  checkOrigin(req);const {pin}=await params,hostToken=req.headers.get("x-host-token");
  if(!hostToken||!/^\d{6}$/.test(pin))return noCache({error:"Invalid host credentials."},401);
  const auth=await findUser(req);
  if(!auth.user)return noCache({error:"Host account sign-in required."},401);
  const sql=db(),rows=await sql`SELECT quiz_set_id,status,current_index,deadline,host_token_hash,owner_user_id,question_seconds,question_order FROM rooms WHERE pin=${pin}`;
  if(!rows.length||!same(rows[0].host_token_hash,hash(hostToken)))return noCache({error:"Not authorized."},403);
  const r=rows[0];
  if(r.owner_user_id&&r.owner_user_id!==auth.user.id)return noCache({error:"Only the original host account may control this room."},403);
  if(r.status==="finished")return noCache({error:"Game already finished."},409);
  if(r.status==="playing"&&r.deadline&&new Date(r.deadline).getTime()>Date.now())return noCache({error:"Round still in progress."},409);
  const next=r.status==="lobby"?0:r.current_index+1;
  const position=Array.isArray(r.question_order)?r.question_order[next]:next;
  const question=await sql`SELECT time_limit FROM questions WHERE quiz_set_id=${r.quiz_set_id} AND position=${position??next}`;
  if(!question.length){
   await sql`UPDATE rooms SET status='finished',deadline=NULL WHERE pin=${pin} AND status='playing'`;
   await emitRoomRefresh('quiz',pin);return applyRenew(noCache({status:"finished"}),req,auth.renew);
  }
  const updated=await sql`UPDATE rooms SET status='playing',current_index=${next},deadline=now()+make_interval(secs => ${question[0].time_limit??r.question_seconds})
   WHERE pin=${pin} AND current_index=${r.current_index} AND status=${r.status} RETURNING pin`;
  if(!updated.length)return noCache({error:"Another request already advanced this round."},409);
  await emitRoomRefresh('quiz',pin);return applyRenew(noCache({index:next,status:"playing"}),req,auth.renew);
 }catch(e){return authError(e)}
}
