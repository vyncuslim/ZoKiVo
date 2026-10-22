import {NextRequest} from "next/server";
import {db,hash,same} from "@/lib/store";
import {isRoomPin} from "@/lib/realtime";
import {realtimeProviders} from "@/lib/realtime-provider-selection";
import {edgeRealtimeUrl} from "@/lib/edge-realtime-auth";
import {noCache} from "@/lib/mother-auth";

export const runtime="nodejs";
export async function GET(req:NextRequest){
 const pin=req.nextUrl.searchParams.get("pin")||"";
 const kind=req.nextUrl.searchParams.get("kind");
 if(!isRoomPin(pin)||(kind!=="quiz"&&kind!=="paper"))return noCache({error:"Invalid room"},400);
 try{
  const sql=db();
  let verifiedParticipant=pin;
  if(kind==="quiz"){
   const found=await sql`SELECT host_token_hash FROM rooms WHERE pin=${pin} LIMIT 1`;
   if(!found.length)return noCache({error:"Room not found"},404);
   const hostKey=req.headers.get("x-host-token"),playerKey=req.headers.get("x-player-token");
   const host=!!hostKey&&same(found[0].host_token_hash,hash(hostKey));
   const player=playerKey?await sql`SELECT id FROM players WHERE room_pin=${pin} AND token_hash=${hash(playerKey)} LIMIT 1`:[];
   if(!host&&!player.length)return noCache({error:"Room access required"},401);
   // Never accept client-selected allocation identities: only verified database IDs.
   // This keeps each player's assignment stable across reconnects and devices.
   verifiedParticipant=host?"host:"+pin:"player:"+String(player[0].id);
  }else{
   const rows=await sql`SELECT 1 FROM paper_sessions WHERE pin=${pin} LIMIT 1`;
   if(!rows.length)return noCache({error:"Session not found"},404);
  }
  const fallback=realtimeProviders(kind,pin,verifiedParticipant);
  // Edge pilot is strictly opt-in. Existing 50/50 Neon/Supabase selection
  // remains untouched when edge is off and remains the backup order when on.
  const providers=kind==="quiz"&&edgeRealtimeUrl()
   ?["edge",...fallback]:fallback;
  return noCache({providers,version:3});
 }catch(e){console.error("Realtime plan unavailable",e);return noCache({providers:[],version:1},503)}
}
