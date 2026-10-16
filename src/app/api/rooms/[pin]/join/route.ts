import {avatarId} from "@/lib/avatars";
import {emitRoomRefresh} from "@/lib/realtime";
import {randomInt} from "node:crypto";
import {db,token,hash,bad} from "@/lib/store";
export const runtime="nodejs";
const choices=["Comet","Panda","Star","Otter","Rocket","Fox","Pixel","Quokka"];
export async function POST(req:Request,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params;
 if(!/^\d{6}$/.test(pin))return bad("Invalid PIN");
 try{
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=="object")return bad("Invalid join information");
  const desired=typeof body.nickname==="string"?body.nickname.trim().replace(/[<>\x00-\x1f]/g,"").slice(0,24):"";
  const sql=db();
  const config=await sql`SELECT status,allow_late_joining,random_player_names FROM rooms WHERE pin=${pin}`;
  if(!config.length)return bad("Room not found",404);
  if(config[0].status!=="lobby"&&!(config[0].status==="playing"&&config[0].allow_late_joining))return bad("Room is not accepting new players.",409);
  if(!config[0].random_player_names&&desired.length<2)return bad("Nickname too short");
  const avatar=avatarId(body.avatar),name=config[0].random_player_names?
    choices[randomInt(choices.length)]+String(randomInt(10000,99999)):desired;
  const t=token();
  const rows=await sql`INSERT INTO players(room_pin,nickname,token_hash,avatar_id,defense_code)
    SELECT pin,${name},${hash(t)},${avatar},${randomInt(0,3)} FROM rooms
    WHERE pin=${pin} AND (status='lobby' OR (status='playing' AND allow_late_joining))
    ON CONFLICT DO NOTHING RETURNING id`;
  if(!rows.length)return bad("Room closed or nickname already taken",409);
  await emitRoomRefresh("quiz",pin);
  return Response.json({token:t,nickname:name},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("Unable to join ZoKivo room",e);return bad("Unable to join",503)}
}
