import {NextRequest} from "next/server";
import {db,hash,same} from "@/lib/store";
import {realtimeConfig,roomTopic,isRoomPin,type RoomKind} from "@/lib/realtime";
import {noCache} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const pin=req.nextUrl.searchParams.get("pin")||"";
 const kind=req.nextUrl.searchParams.get("kind") as RoomKind;
 if(!isRoomPin(pin)||(kind!=="quiz"&&kind!=="paper"))return noCache({error:"Invalid room."},400);
 const conf=realtimeConfig();
 if(!conf)return noCache({enabled:false},200);
 try{
  const sql=db();
  if(kind==="quiz"){
   const rows=await sql`SELECT host_token_hash FROM rooms WHERE pin=${pin}`;
   if(!rows.length)return noCache({error:"Game not found."},404);
   const h=req.headers.get("x-host-token"),p=req.headers.get("x-player-token");
   const host=!!h&&same(rows[0].host_token_hash,hash(h));
   let player=false;
   if(p){
    const records=await sql`SELECT 1 FROM players WHERE room_pin=${pin} AND token_hash=${hash(p)} LIMIT 1`;
    player=records.length>0;
   }
   if(!host&&!player)return noCache({error:"Room access required."},401);
  }else{
   // Paper Mode projected board is readable by PIN; only minimal refresh notices are broadcast.
   const rows=await sql`SELECT 1 FROM paper_sessions WHERE pin=${pin} LIMIT 1`;
   if(!rows.length)return noCache({error:"Paper room not found."},404);
  }
  return noCache({enabled:true,url:conf.origin,publishableKey:conf.publishable,topic:roomTopic(kind,pin)});
 }catch(e){console.error("Realtime subscription configuration unavailable",e);return noCache({enabled:false},503)}
}
