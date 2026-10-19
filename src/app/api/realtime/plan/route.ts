import {NextRequest} from "next/server";
import {db,hash,same} from "@/lib/store";
import {isRoomPin} from "@/lib/realtime";
import {realtimeProviders} from "@/lib/realtime-provider-selection";
import {noCache} from "@/lib/mother-auth";

export const runtime="nodejs";
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
