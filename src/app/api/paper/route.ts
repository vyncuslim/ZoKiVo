import {NextRequest} from "next/server";
import {db,token,hash} from "@/lib/store";
import {findUser,noCache,applyRenew,checkOrigin,authError,AuthError} from "@/lib/mother-auth";
import {isId} from "@/lib/quizzes";
import {randomInt} from "node:crypto";
export const runtime="nodejs";
const SAMPLE="b91f4600-1000-4000-8000-000000000001";
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  if(process.env.PAPER_MODE_ENABLED!=="true")return noCache({error:"Paper Mode is disabled until classroom security validation is complete."},503);
  const auth=await findUser(req);
  if(!auth.user)return noCache({error:"Sign in with Vynalth AI to host Paper Mode.",code:"AUTH_REQUIRED"},401);
  if(!auth.user.email_confirmed_at)return noCache({error:"Confirm your email before hosting.",code:"EMAIL_UNVERIFIED"},403);
  const body=await req.json().catch(()=>({})),id=body?.quizId||SAMPLE;
  if(typeof id!=="string"||!isId(id))throw new AuthError("Invalid quiz selected.");
  const sql=db(),secret=token();
  const ok=await sql`SELECT id FROM quiz_sets WHERE id=${id} AND status='published'
    AND EXISTS(SELECT 1 FROM questions WHERE quiz_set_id=${id})`;
  if(!ok.length)return noCache({error:"The selected quiz is unavailable."},409);
  for(let i=0;i<6;i++){
   const pin=String(randomInt(100000,1000000));
   const rows=await sql`INSERT INTO paper_sessions(pin,quiz_set_id,host_token_hash,owner_user_id)
     VALUES(${pin},${id},${hash(secret)},${auth.user.id}) ON CONFLICT DO NOTHING RETURNING pin`;
   if(rows.length)return applyRenew(noCache({pin,hostToken:secret}),req,auth.renew);
  }
  return noCache({error:"Could not create a PIN."},503);
 }catch(e){return authError(e)}
}
