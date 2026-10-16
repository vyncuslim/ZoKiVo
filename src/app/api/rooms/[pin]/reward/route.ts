import {NextRequest} from "next/server";
import {emitRoomRefresh} from "@/lib/realtime";
import {checkOrigin,noCache} from "@/lib/mother-auth";
import {db,hash} from "@/lib/store";
export const runtime="nodejs";
export async function POST(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 try{checkOrigin(req)}catch{return noCache({error:"Invalid request origin"},403)}
 const {pin}=await params,key=req.headers.get("x-player-token");
 if(!/^\d{6}$/.test(pin)||!key)return noCache({error:"Player credentials are required"},401);
 try{
  const body=await req.json().catch(()=>null);
  const action=body?.action,option=body?.option??0,target=body?.target??null;
  if(!["chest","mine","hack","fish","serve"].includes(action)||!Number.isInteger(option)||option<0||option>2||
    (target!==null&&(typeof target!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(target))))
    return noCache({error:"Invalid reward choice"},400);
  const sql=db();const player=await sql`SELECT id FROM players WHERE room_pin=${pin} AND token_hash=${hash(key)} LIMIT 1`;
  if(!player.length)return noCache({error:"Invalid player"},403);
  const result=await sql`SELECT zokivo_claim_reward(${pin}::char(6),${player[0].id}::uuid,${action},${option}::integer,${target}::uuid) AS reward`;
  await emitRoomRefresh("quiz",pin);
  return noCache({ok:true,reward:result[0].reward});
 }catch(e){
  const msg=e instanceof Error?e.message:"";
  if(/already claimed/i.test(msg))return noCache({error:"You already claimed a reward for this question."},409);
  if(/correct answer is required/i.test(msg))return noCache({error:"Answer correctly before opening a reward."},409);
  if(/not active/i.test(msg))return noCache({error:"This game mode is not active."},409);
  if(/Invalid rival|Choose another player|Select one|Choose a|Unsupported|code challenge/i.test(msg))return noCache({error:"Select a valid reward or another player."},400);
  console.error("ZoKivo reward engine failed",e);return noCache({error:"Reward is temporarily unavailable"},503);
 }
}
