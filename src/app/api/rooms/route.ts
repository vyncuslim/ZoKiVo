import {NextRequest} from "next/server";
import {findUser,noCache,applyRenew} from "@/lib/mother-auth";
import {db,token,hash,bad} from '@/lib/store';export const runtime='nodejs';export async function POST(req:NextRequest){
 const auth=await findUser(req).catch(()=>({user:null,renew:undefined}));
 if(!auth.user)return noCache({error:"Sign in with Vynalth AI to host a game.",code:"AUTH_REQUIRED"},401);
 if(!auth.user.email_confirmed_at)return noCache({error:"Confirm your account email before hosting.",code:"EMAIL_UNVERIFIED"},403);try{const sql=db(),t=token();for(let i=0;i<5;i++){const pin=String(100000+Math.floor(Math.random()*900000));const r=await sql`INSERT INTO rooms(pin,quiz_set_id,host_token_hash) VALUES (${pin},'b91f4600-1000-4000-8000-000000000001',${hash(t)}) ON CONFLICT DO NOTHING RETURNING pin`;if(r.length)return applyRenew(noCache({pin,token:t}),req,auth.renew)}return bad('No PIN available',503)}catch(e){console.error(e);return bad('Database unavailable',503)}}