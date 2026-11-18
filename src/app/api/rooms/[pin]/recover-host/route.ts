import {NextRequest} from "next/server";
import {db,token,hash} from "@/lib/store";
import {findUser,noCache,checkOrigin,authError,applyRenew} from "@/lib/mother-auth";

export const runtime="nodejs";
/**
 * Explicit, account-owner-only recovery for genuinely abandoned classrooms.
 * A missing room token cannot be bypassed for live games: only a room whose
 * latest deadline passed more than 24h ago can rotate its host capability.
 * Does NOT finish, advance, score, delete, archive or recycle the room.
 */
export async function POST(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 try{
  checkOrigin(req);
  const {pin}=await params;
  if(!/^\d{6}$/.test(pin))return noCache({error:"Invalid room PIN."},400);
  const auth=await findUser(req);
  if(!auth.user)return noCache({error:"Sign in as the original host to recover this room."},401);
  if(!auth.user.email_confirmed_at)
   return noCache({error:"Verify your account email before recovering a classroom."},403);
  const newHostToken=token();
  const sql=db();
  // One atomic owner-scoped UPDATE. A guessed PIN, wrong account, active room,
  // completed room or recently expired round cannot obtain a host capability.
  const updated=await sql`UPDATE rooms SET host_token_hash=${hash(newHostToken)}::char(64)
   WHERE pin=${pin} AND owner_user_id=${auth.user.id}
     AND status='playing' AND deadline IS NOT NULL
     AND deadline<now()-interval '24 hours'
   RETURNING pin`;
  if(!updated.length)
   return noCache({error:"Only the original host may recover an eligible old classroom."},409);
  return applyRenew(noCache({pin,hostToken:newHostToken,recovered:true}),req,auth.renew);
 }catch(e){return authError(e)}
}
