import {db,token,hash,bad} from "@/lib/store";
import {NextRequest} from "next/server";
import {findUser,noCache,applyRenew,checkOrigin} from "@/lib/mother-auth";
import {randomInt} from "node:crypto";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{checkOrigin(req)}catch{return noCache({error:"Invalid request origin."},403)}
 if(process.env.PAPER_MODE_ENABLED!=="true")return bad("Paper Mode is not enabled on this environment",503);
 const auth=await findUser(req).catch(()=>null);
 if(!auth)return noCache({error:"Authentication service temporarily unavailable."},503);
 if(!auth.user)return noCache({error:"Sign in with Vynalth AI to host Paper Mode.",code:"AUTH_REQUIRED"},401);
 if(!auth.user.email_confirmed_at)return noCache({error:"Confirm your email before hosting.",code:"EMAIL_UNVERIFIED"},403);
 try{
  const sql=db(), secret=token();
  for(let i=0;i<6;i++){
    const pin=String(randomInt(100000,1000000));
    const rows=await sql`INSERT INTO paper_sessions(pin,quiz_set_id,host_token_hash)
     SELECT ${pin},id,${hash(secret)} FROM quiz_sets WHERE id='b91f4600-1000-4000-8000-000000000001'
     ON CONFLICT DO NOTHING RETURNING pin`;
    if(rows.length)return applyRenew(noCache({pin,hostToken:secret}),req,auth.renew);
  }
  return bad("Could not find a free PIN. Try again.",503);
 }catch(e){console.error("paper create",e);return bad("Paper session unavailable. Check database setup.",503)}
}
