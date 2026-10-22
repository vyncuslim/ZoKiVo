import {NextRequest} from "next/server";
import {db,hash,same} from "@/lib/store";
import {isRoomPin} from "@/lib/realtime";
import {edgeRealtimeUrl,issueEdgeRoomCapability} from "@/lib/edge-realtime-auth";
import {noCache} from "@/lib/mother-auth";
export const runtime="nodejs";

/** Mint a room-scoped read-only edge socket credential after database auth. */
export async function GET(req:NextRequest){
 const pin=req.nextUrl.searchParams.get("pin")||"";
 if(!isRoomPin(pin))return noCache({error:"Invalid PIN"},400);
 const edge=edgeRealtimeUrl();
 if(!edge)return noCache({enabled:false},200);
 try{
  const hostKey=req.headers.get("x-host-token");
  const playerKey=req.headers.get("x-player-token");
  if(!hostKey&&!playerKey)return noCache({error:"Authentication required"},401);
  const playerHash=playerKey?hash(playerKey):"0".repeat(64);
  const sql=db();
  const rows=await sql`SELECT r.host_token_hash,p.id AS player_id
   FROM rooms r
   LEFT JOIN LATERAL(SELECT id FROM players WHERE room_pin=r.pin
    AND token_hash=${playerHash} LIMIT 1) p ON true
   WHERE r.pin=${pin} LIMIT 1`;
  if(!rows.length)return noCache({error:"Room not found"},404);
  const host=!!hostKey&&same(rows[0].host_token_hash,hash(hostKey));
  const playerId=rows[0].player_id;
  if(!host&&!playerId)return noCache({error:"Room access denied"},401);
  const subject=host?"host:"+pin:"player:"+String(playerId);
  return noCache({
   enabled:true,
   url:edge.origin+"/connect?pin="+encodeURIComponent(pin),
   capability:issueEdgeRoomCapability("quiz",pin,subject),
   version:1
  });
 }catch(e){
  console.error("Edge websocket capability unavailable",e instanceof Error?e.name:"unknown");
  return noCache({enabled:false},503);
 }
}
