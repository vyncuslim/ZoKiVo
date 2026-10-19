import {NextRequest} from "next/server";
import {createHash} from "node:crypto";
import {db,hash,same} from "@/lib/store";
import {isRoomPin,realtimeConfig} from "@/lib/realtime";
import {noCache} from "@/lib/mother-auth";

export const runtime="nodejs";
export type RealtimeTransport="neon"|"supabase";

/** Select one PRIMARY provider per room, not two simultaneous WebSockets. */
export function realtimeProviders(kind:"quiz"|"paper",pin:string):RealtimeTransport[]{
 const supabase=!!realtimeConfig();
 if(kind==="paper")return supabase?["supabase"]:[];
 const neon=process.env.ZOKIVO_NEON_REALTIME_ENABLED==="true"
  &&!!process.env.NEON_REALTIME_SECRET
  &&!!process.env.NEON_REALTIME_URL;
 if(!neon)return supabase?["supabase"]:[];
 if(!supabase)return ["neon"];
 const percentage=Math.max(0,Math.min(100,Number(process.env.ZOKIVO_NEON_REALTIME_PERCENT)||0));
 const bucket=createHash("sha256").update("zokivo-room-realtime:"+pin).digest().readUInt32BE(0)%100;
 return bucket<percentage?["neon","supabase"]:["supabase","neon"];
}

export async function GET(req:NextRequest){
 const pin=req.nextUrl.searchParams.get("pin")||"";
 const kind=req.nextUrl.searchParams.get("kind");
 if(!isRoomPin(pin)||(kind!=="quiz"&&kind!=="paper"))return noCache({error:"Invalid room"},400);
 try{
  const sql=db();
  if(kind==="quiz"){
   const found=await sql`SELECT host_token_hash FROM rooms WHERE pin=${pin} LIMIT 1`;
   if(!found.length)return noCache({error:"Room not found"},404);
   const hostKey=req.headers.get("x-host-token"),playerKey=req.headers.get("x-player-token");
   const host=!!hostKey&&same(found[0].host_token_hash,hash(hostKey));
   const player=playerKey?await sql`SELECT id FROM players WHERE room_pin=${pin} AND token_hash=${hash(playerKey)} LIMIT 1`:[];
   if(!host&&!player.length)return noCache({error:"Room access required"},401);
  }else{
   const rows=await sql`SELECT 1 FROM paper_sessions WHERE pin=${pin} LIMIT 1`;
   if(!rows.length)return noCache({error:"Session not found"},404);
  }
  return noCache({providers:realtimeProviders(kind,pin),version:1});
 }catch(e){console.error("Realtime plan unavailable",e);return noCache({providers:[],version:1},503)}
}
