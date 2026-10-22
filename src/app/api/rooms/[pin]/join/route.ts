import {NextRequest} from "next/server";
import {avatarId,avatarInfo} from "@/lib/avatars";
import {findUser} from "@/lib/mother-auth";
import {emitRoomRefresh} from "@/lib/realtime";
import {randomInt} from "node:crypto";
import {db,token,hash,bad} from "@/lib/store";
import {issueRoomReadToken} from "@/lib/room-read-token";
export const runtime="nodejs";
const choices=["Comet","Panda","Star","Otter","Rocket","Fox","Pixel","Quokka"];
export async function POST(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
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
  const selected=avatarInfo(body.avatar);
  const avatar=avatarId(body.avatar);
  if(selected?.price){
   const auth=await findUser(req).catch(()=>({user:null}));
   if(!auth.user?.email_confirmed_at)return bad("Sign in to use this collectible avatar",403);
   const unlock=await sql`SELECT 1 FROM avatar_unlocks WHERE owner_user_id=${auth.user.id} AND avatar_id=${selected.id}`;
   if(!unlock.length)return bad("This avatar is not unlocked for your account",403);
  }
  const name=config[0].random_player_names?
    choices[randomInt(choices.length)]+String(randomInt(10000,99999)):desired;
  const t=token();
  // Database procedure locks the room row before checking the limit, preventing over-capacity joins.
  const rows=await sql`SELECT zokivo_join_room(${pin}::char(6),${name}::varchar(24),
    ${hash(t)}::char(64),${avatar},${randomInt(0,3)}::smallint,100) AS id`;
  if(!rows.length||!rows[0].id)return bad("Unable to join this room",409);
  await emitRoomRefresh("quiz",pin);
  // Read-only signed capability cuts redundant DB lookups for large live
  // classrooms. The original token remains mandatory for answer writes.
  const playerId=String(rows[0].id);
  const readToken=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(playerId)
   ?issueRoomReadToken(pin,playerId):null;
  return Response.json({token:t,readToken,nickname:name},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const message=e instanceof Error?e.message:"";
  if(/Room is full/i.test(message))return bad("Room is full (maximum 100 players).",409);
  if(/Room is not accepting|Room closed/i.test(message))return bad("Room is not accepting new players.",409);
  if(/Room not found/i.test(message))return bad("Room not found",404);
  if(/duplicate key|players_room_pin_nickname_key|unique constraint/i.test(message))return bad("Nickname already taken. Try another.",409);
  console.error("Unable to join ZoKivo room",e);return bad("Unable to join",503)
 }
}
