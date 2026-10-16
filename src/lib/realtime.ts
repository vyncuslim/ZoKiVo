import {createHmac} from "node:crypto";

export type RoomKind="quiz"|"paper";
export function isRoomPin(pin:string){return /^\d{6}$/.test(pin)}
export function roomTopic(kind:RoomKind,pin:string){
 if(!isRoomPin(pin))throw new Error("Invalid game PIN");
 const secret=process.env.ZOKIVO_SESSION_SECRET;
 if(!secret||secret.length<32)throw new Error("ZOKIVO_SESSION_SECRET must be 32+ characters");
 // Never expose PIN or a predictable channel name to unauthenticated parties.
 const digest=createHmac("sha256",secret).update("zokivo-realtime:v1:"+kind+":"+pin).digest("hex");
 return "zk-"+kind+"-"+digest.slice(0,40);
}
export function realtimeConfig(){
 if(process.env.ZOKIVO_REALTIME_ENABLED==="false")return null;
 const url=process.env.ZOKIVO_SUPABASE_URL;
 const publishable=process.env.ZOKIVO_SUPABASE_PUBLISHABLE_KEY;
 const secret=process.env.ZOKIVO_SUPABASE_SECRET_KEY;
 if(!url||!publishable||!secret)return null;
 try{
  const u=new URL(url);
  if(u.protocol!=="https:"||u.pathname!=="/"||u.username||u.password||u.search||u.hash||!/\.supabase\.co$/.test(u.hostname))return null;
  return {origin:u.origin,publishable,secret};
 }catch{return null}
}
export async function emitRoomRefresh(kind:RoomKind,pin:string){
 const conf=realtimeConfig();
 if(!conf||!isRoomPin(pin))return false;
 try{
  const topic=roomTopic(kind,pin);
  const target=conf.origin+"/realtime/v1/api/broadcast/"+encodeURIComponent(topic)+"/events/refresh";
  const res=await fetch(target,{
   method:"POST",
   headers:{"apikey":conf.secret,"Content-Type":"application/json"},
   body:JSON.stringify({v:1}),cache:"no-store",signal:AbortSignal.timeout(1600)
  });
  if(!res.ok)console.warn("ZoKivo Realtime broadcast status",res.status);
  return res.ok;
 }catch(e){
  console.warn("ZoKivo Realtime broadcast unavailable; polling remains active.",e instanceof Error?e.message:"error");
  return false;
 }
}
