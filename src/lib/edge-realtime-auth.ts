import {createHmac,createHash,randomUUID} from "node:crypto";
type RoomKind="quiz"|"paper";
const isRoomPin=(pin:string)=>/^\d{6}$/.test(pin);

const ttlSeconds=120;
function edgeSecret(){
 const value=process.env.ZOKIVO_EDGE_REALTIME_SECRET;
 if(!value||value.length<32)throw Error("Edge realtime secret not configured");
 return value;
}
function digest(prefix:string,data:string){
 return createHmac("sha256",edgeSecret()).update(prefix+data).digest("base64url");
}
/** Room-level canary keeps all 100 classmates on one pilot transport.
 * Default 0: deployable code never creates edge traffic until explicitly enabled.
 */
export function edgeCanaryRoom(pin:string):boolean{
 if(!isRoomPin(pin))return false;
 const raw=process.env.ZOKIVO_EDGE_REALTIME_PERCENT?.trim()||"0";
 const numeric=Number(raw);
 if(!Number.isFinite(numeric)||numeric<=0)return false;
 const percent=Math.max(0,Math.min(100,numeric));
 const value=createHash("sha256").update("zokivo-edge-canary-room:v1:"+pin)
  .digest().readUInt32BE(0)%100;
 return value<percent;
}
export function edgeRealtimeUrl():URL|null{
 if(process.env.ZOKIVO_EDGE_REALTIME_ENABLED!=="true")return null;
 const percent=Number(process.env.ZOKIVO_EDGE_REALTIME_PERCENT||"0");
 if(!Number.isFinite(percent)||percent<=0)return null;
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
