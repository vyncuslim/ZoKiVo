import {NextRequest} from "next/server";
import {createRealtime,rawSql} from "@neon/realtime/server";
import {db,hash,same} from "@/lib/store";
import {isRoomPin} from "@/lib/realtime";
import {noCache} from "@/lib/mother-auth";

export const runtime="nodejs";
/**
 * Only room metadata plus current-round answer count can be subscribed to.
 * This is NOT a general-purpose SQL interface. Neon beta lacks RLS:
 * authenticate before sealing and never send the sealing secret to a client.
 */
export async function GET(req:NextRequest){
 const pin=req.nextUrl.searchParams.get("pin")||"";
 if(!isRoomPin(pin))return noCache({error:"Invalid PIN"},400);
 if(process.env.ZOKIVO_NEON_REALTIME_ENABLED!=="true")return noCache({enabled:false},200);
 const secret=process.env.NEON_REALTIME_SECRET;
 const endpoint=process.env.NEON_REALTIME_URL;
 if(!secret||!endpoint)return noCache({enabled:false},200);
 let neonUrl:URL;
 try{
  neonUrl=new URL(endpoint);
  if(neonUrl.protocol!=="https:"||!neonUrl.hostname.endsWith(".neon.tech")||neonUrl.username||neonUrl.password)
   throw Error("Invalid Neon endpoint");
 }catch{return noCache({enabled:false},503)}
 try{
  const tokenHost=req.headers.get("x-host-token"),tokenPlayer=req.headers.get("x-player-token");
  const sql=db();
  const found=await sql`SELECT host_token_hash FROM rooms WHERE pin=${pin} LIMIT 1`;
  if(!found.length)return noCache({error:"Room not found"},404);
  const isHost=!!tokenHost&&same(found[0].host_token_hash,hash(tokenHost));
  const player=tokenPlayer?await sql`SELECT id FROM players WHERE room_pin=${pin} AND token_hash=${hash(tokenPlayer)} LIMIT 1`:[];
  if(!isHost&&!player.length)return noCache({error:"Room session required"},401);
  const live=createRealtime({secret,db:"neondb"});
  // One row per room, no student identities, answers, scores, option keys or tokens.
  // Deterministic live SQL only: Neon beta forbids now() and side effects.
  const query=rawSql<{pin:string;status:string;current_index:number;submitted:number}>(
   "SELECT r.pin,r.status,r.current_index,count(a.player_id)::integer AS submitted "+
   "FROM rooms r LEFT JOIN answers a ON a.room_pin=r.pin AND a.question_index=r.current_index "+
   "WHERE r.pin=$1 GROUP BY r.pin,r.status,r.current_index",[pin]
  );
  const sealed=await live.seal({query});
  return noCache({enabled:true,url:neonUrl.origin+"/",query:sealed,version:1});
 }catch(e){
  console.error("Neon Realtime query issue failed",e instanceof Error?e.name:"error");
  return noCache({enabled:false},503);
 }
}
