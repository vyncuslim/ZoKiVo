import {emitRoomRefresh} from "@/lib/realtime";
import {NextRequest} from "next/server";
import {db,hash,same} from "@/lib/store";
import {findUser,noCache,checkOrigin,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
/** Host-only early finish. No player may end a session or change scores. */
export async function POST(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 try{
  checkOrigin(req);const {pin}=await params;
  const hostToken=req.headers.get("x-host-token");if(!hostToken||!/^\d{6}$/.test(pin))return noCache({error:"Invalid host credentials"},401);
  const session=await findUser(req);if(!session.user)return noCache({error:"Sign in as host"},401);
  const sql=db();const r=await sql`SELECT host_token_hash,owner_user_id,status FROM rooms WHERE pin=${pin}`;
  if(!r.length||!same(r[0].host_token_hash,hash(hostToken)))return noCache({error:"Not authorized"},403);
  if(r[0].owner_user_id&&r[0].owner_user_id!==session.user.id)return noCache({error:"Original host account required"},403);
  const saved=await sql`UPDATE rooms SET status='finished',deadline=NULL WHERE pin=${pin} AND status IN ('lobby','playing') RETURNING pin`;
  if(!saved.length)return noCache({error:"Game already finished"},409);
  await emitRoomRefresh("quiz",pin);
  return applyRenew(noCache({status:"finished"}),req,session.renew);
 }catch(e){return authError(e)}
}
