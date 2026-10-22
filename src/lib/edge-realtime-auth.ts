import {createHmac,randomUUID} from "node:crypto";
import {isRoomPin,type RoomKind} from "@/lib/realtime";

const ttlSeconds=120;
function edgeSecret(){
 const value=process.env.ZOKIVO_EDGE_REALTIME_SECRET;
 if(!value||value.length<32)throw Error("Edge realtime secret not configured");
 return value;
}
function digest(prefix:string,data:string){
 return createHmac("sha256",edgeSecret()).update(prefix+data).digest("base64url");
}
export function edgeRealtimeUrl():URL|null{
 if(process.env.ZOKIVO_EDGE_REALTIME_ENABLED!=="true")return null;
 const url=process.env.ZOKIVO_EDGE_REALTIME_URL;
 if(!url||!process.env.ZOKIVO_EDGE_REALTIME_SECRET||process.env.ZOKIVO_EDGE_REALTIME_SECRET.length<32)return null;
 try{
  const result=new URL(url);
  if(result.protocol!=="https:"||result.pathname!=="/"||result.search||result.hash||
   result.username||result.password||result.port)return null;
  return result;
 }catch{return null}
}
/** Short-lived scope for read-only edge fanout; not accepted by answer or admin APIs. */
export function issueEdgeRoomCapability(kind:RoomKind,pin:string,subject:string,now=Math.floor(Date.now()/1000)){
 if(kind!=="quiz"||!isRoomPin(pin)||!subject||subject.length>90)throw Error("Invalid edge capability");
 const body=Buffer.from(JSON.stringify([kind,pin,subject,now+ttlSeconds,randomUUID()])).toString("base64url");
 return "zke1."+body+"."+digest("zokivo-edge-cap:v1:",body);
}
export function signEdgeNotify(timestamp:string,body:string){
 if(!/^\d{13}$/.test(timestamp)||body.length>1024)throw Error("Invalid edge notification envelope");
 return digest("zokivo-edge-notify:v1:",timestamp+"."+body);
}
