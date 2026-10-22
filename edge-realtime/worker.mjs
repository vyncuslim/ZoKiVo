/* Cloudflare Worker + one SQLite-backed Durable Object per game room.
   Pre-production pilot ONLY. No correctness/points and no public writes. */
const enc=new TextEncoder();
const roomPin=pin=>typeof pin==="string"&&/^\d{6}$/.test(pin);
const secretValid=env=>typeof env.EDGE_REALTIME_SECRET==="string"&&env.EDGE_REALTIME_SECRET.length>=32;
const cacheHeader={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
function json(body,status=200){return Response.json(body,{status,headers:cacheHeader})}
function decode64(value){
 if(!/^[A-Za-z0-9_-]+$/.test(value)||value.length>800)throw Error("Invalid encoding");
 const base=value.replace(/-/g,"+").replace(/_/g,"/");
 return Uint8Array.from(atob(base+"=".repeat((4-base.length%4)%4)),c=>c.charCodeAt(0));
}
async function verifyMac(secret,domain,message,mac){
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),
  {name:"HMAC",hash:"SHA-256"},false,["verify"]);
 return crypto.subtle.verify("HMAC",key,decode64(mac),enc.encode(domain+message));
}
/** Browser-to-Worker capability validated BEFORE any Durable Object request. */
export async function verifyCapability(token,kind,pin,secret,now=Math.floor(Date.now()/1000)){
 if(typeof token!=="string"||token.length>550||!roomPin(pin)||kind!=="quiz"||!secret||secret.length<32)return null;
 const parts=token.split(".");
 if(parts.length!==3||parts[0]!=="zke1")return null;
 try{
  const valid=await verifyMac(secret,"zokivo-edge-cap:v1:",parts[1],parts[2]);
  if(!valid)return null;
  const claims=JSON.parse(new TextDecoder().decode(decode64(parts[1])));
  if(!Array.isArray(claims)||claims.length!==5)return null;
  const [claimKind,claimPin,subject,expiry,nonce]=claims;
  if(claimKind!==kind||claimPin!==pin||
   typeof subject!=="string"||!subject||subject.length>90||
   !Number.isInteger(expiry)||expiry<now||expiry>now+120||
   typeof nonce!=="string"||nonce.length>80)return null;
  return {subject,expiry};
 }catch{return null}
}
export async function verifyNotification(signature,timestamp,body,secret,now=Date.now()){
 if(typeof signature!=="string"||typeof timestamp!=="string"||! /^\d{13}$/.test(timestamp)||
  typeof body!=="string"||body.length>1024)return false;
 if(Math.abs(now-Number(timestamp))>30000)return false;
 try{return await verifyMac(secret,"zokivo-edge-notify:v1:",timestamp+"."+body,signature)}
 catch{return false}
}
function allowedOrigin(req,env){
 const origin=req.headers.get("Origin");
 const allow=(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
 return origin!==null&&allow.includes(origin);
}
export default {
 async fetch(req,env){
  if(!secretValid(env))return json({error:"Not configured"},503);
  const u=new URL(req.url);
  if(u.pathname==="/connect"&&req.method==="GET"){
   if(req.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({error:"WebSocket required"},426);
   if(!allowedOrigin(req,env))return json({error:"Origin denied"},403);
   const pin=u.searchParams.get("pin");
   if(!roomPin(pin)||u.searchParams.size!==1)return json({error:"Invalid room"},400);
   const protocols=(req.headers.get("Sec-WebSocket-Protocol")||"").split(",").map(x=>x.trim());
   if(!protocols.includes("zokivo.v1"))return json({error:"Protocol required"},400);
   const authProtocols=protocols.filter(x=>x.startsWith("auth."));
   if(authProtocols.length!==1)return json({error:"One capability required"},401);
   const cap=await verifyCapability(authProtocols[0].slice(5),"quiz",pin,env.EDGE_REALTIME_SECRET);
   if(!cap)return json({error:"Invalid or expired capability"},401);
   const subjectBytes=await crypto.subtle.digest("SHA-256",enc.encode("zokivo-edge-peer:"+pin+":"+cap.subject));
   const subjectHash=Array.from(new Uint8Array(subjectBytes),x=>x.toString(16).padStart(2,"0")).join("");
   const id=env.ROOM_HUBS.idFromName("quiz:"+pin);
   return env.ROOM_HUBS.get(id).fetch(new Request("https://room.internal/connect",{
    headers:{"Upgrade":"websocket","X-Room-Subject-Hash":subjectHash,"X-Room-Expiry":String(cap.expiry)}
   }));
  }
  if(u.pathname==="/notify"&&req.method==="POST"){
   const timestamp=req.headers.get("X-ZoKivo-Timestamp");
   const signature=req.headers.get("X-ZoKivo-Signature");
   const body=await req.text();
   if(!(await verifyNotification(signature,timestamp,body,env.EDGE_REALTIME_SECRET)))
    return json({error:"Untrusted notification"},401);
   let value;
   try{value=JSON.parse(body)}catch{return json({error:"Invalid JSON"},400)}
   if(!value||Object.keys(value).sort().join(",")!=="kind,nonce,pin"||
    value.kind!=="quiz"||!roomPin(value.pin)||
    typeof value.nonce!=="string"||! /^[0-9a-f-]{36}$/.test(value.nonce))
    return json({error:"Invalid notification"},400);
   const id=env.ROOM_HUBS.idFromName("quiz:"+value.pin);
   return env.ROOM_HUBS.get(id).fetch("https://room.internal/notify",{method:"POST"});
  }
  return json({error:"Not found"},404);
 }
};
/** Stateless room fanout: no identities, answers, score values or media stored. */
export class RoomHub {
 constructor(ctx,env){this.ctx=ctx;this.env=env}
 async fetch(req){
  const u=new URL(req.url);
  if(u.pathname==="/connect"&&req.headers.get("Upgrade")?.toLowerCase()==="websocket"){
   // Access to room.internal is only possible through authenticated Worker routing.
   const subjectHash=req.headers.get("X-Room-Subject-Hash");
   const expiry=Number(req.headers.get("X-Room-Expiry"));
   if(!subjectHash||!/^[a-f0-9]{64}$/.test(subjectHash)||!Number.isInteger(expiry)||expiry<Math.floor(Date.now()/1000))
    return json({error:"Expired"},401);
   const sockets=this.ctx.getWebSockets();
   if(sockets.length>=128)return json({error:"Room socket safety cap reached"},429);
   const already=sockets.filter(ws=>ws.deserializeAttachment()?.sub===subjectHash).length;
   if(already>=2)return json({error:"Too many sockets for this participant"},429);
   const pair=new WebSocketPair(),[client,server]=Object.values(pair);
   this.ctx.acceptWebSocket(server);
   server.serializeAttachment({sub:subjectHash,expiry});
   return new Response(null,{status:101,webSocket:client,headers:{"Sec-WebSocket-Protocol":"zokivo.v1"}});
  }
  if(u.pathname==="/notify"&&req.method==="POST"){
   // One durable alarm coalesces any burst of update events into a refresh.
   // Alarm resolution and cost need empirical Cloudflare testing.
   const existing=await this.ctx.storage.getAlarm();
   if(existing===null)await this.ctx.storage.setAlarm(Date.now()+180);
   return json({queued:true},202);
  }
  return json({error:"Not found"},404);
 }
 async alarm(){
  const prev=await this.ctx.storage.get("revision")||0;
  const revision=prev+1;
  await this.ctx.storage.put("revision",revision);
  const message=JSON.stringify({type:"refresh",revision,v:1});
  for(const ws of this.ctx.getWebSockets()){
   try{ws.send(message)}
   catch{try{ws.close(1011,"Delivery failure")}catch{}}
  }
 }
 webSocketMessage(ws,message){
  // No client-to-client relay or answer submission. Ignore all non-heartbeats.
  if(message==="ping"){try{ws.send("pong")}catch{}}
  else if(typeof message!=="string"||message.length>128){
   try{ws.close(1009,"Unsupported message")}catch{}
  }
 }
 webSocketClose(ws,code,reason){try{ws.close(code,reason)}catch{}}
 webSocketError(ws){try{ws.close(1011,"Socket error")}catch{}}
}
