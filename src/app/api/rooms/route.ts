import {NextRequest} from "next/server";
import {findUser,noCache,applyRenew,checkOrigin} from "@/lib/mother-auth";
import {db,token,hash,bad} from '@/lib/store';export const runtime='nodejs';export async function POST(req:NextRequest){
 try{checkOrigin(req)}catch{return noCache({error:"Invalid request origin."},403)}
 const auth=await findUser(req).catch(()=>null);
 if(!auth)return noCache({error:"Authentication service temporarily unavailable."},503);
 if(!auth.user)return noCache({error:"Sign in with Vynalth AI to host a game.",code:"AUTH_REQUIRED"},401);
 if(!auth.user.email_confirmed_at)return noCache({error:"Confirm your account email before hosting.",code:"EMAIL_UNVERIFIED"},403);try{const sql=db(),t=token();for(let i=0;i<5;i++){const pin=String(100000+Math.floor(Math.random()*900000));const r=await sql`INSERT INTO rooms(pin,quiz_set_id,host_token_hash) VALUES (${pin},'b91f4600-1000-4000-8000-000000000001',${hash(t)}) ON CONFLICT DO NOTHING RETURNING pin`;if(r.length)return applyRenew(noCache({pin,token:t}),req,auth.renew)}return bad('No PIN available',503)}catch(e){console.error(e);return bad('Database unavailable',503)}}