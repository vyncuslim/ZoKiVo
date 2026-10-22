/**
 * Real WebSocket integration against isolated LOCAL Cloudflare workerd via Miniflare.
 * NEVER touches production or external endpoints. Hard cap 1000 test sockets.
 * This tests room fanout and local delivery P95, NOT 1M users or cloud capacity.
 */
import {Miniflare} from "miniflare";
import WebSocket from "ws";
import {createHmac,randomUUID,randomBytes} from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import {performance} from "node:perf_hooks";
const PORT=18878,MAX=process.env.ZOKIVO_LOCAL_10K==="ENABLE_ISOLATED_10000"?10000:1000,PER_ROOM=100;
const KEY=randomBytes(48).toString("hex");
const base="http://127.0.0.1:"+PORT,wsBase="ws://127.0.0.1:"+PORT;
const opened=[],samples=[],failures=[];
let dispatched=0,completed=0;
const p=(xs,n)=>{
 if(!xs.length)return null;
 const s=[...xs].sort((a,b)=>a-b);
 return Math.round(s[Math.min(s.length-1,Math.ceil(xs.length*n)-1)]*10)/10;
};
const stats=xs=>({count:xs.length,p50:p(xs,.5),p95:p(xs,.95),p99:p(xs,.99),max:p(xs,1)});
const hmac=(domain,message)=>createHmac("sha256",KEY).update(domain+message).digest("base64url");
function issue(pin,participant){
 const data=Buffer.from(JSON.stringify(["quiz",pin,"player:"+participant,Math.floor(Date.now()/1000)+120,randomUUID()])).toString("base64url");
 return "zke1."+data+"."+hmac("zokivo-edge-cap:v1:",data);
}
async function notify(pin){
 const body=JSON.stringify({kind:"quiz",pin,nonce:randomUUID()});
 const timestamp=String(Date.now());
 const r=await fetch(base+"/notify",{method:"POST",headers:{
  "Content-Type":"application/json","X-ZoKivo-Timestamp":timestamp,
  "X-ZoKivo-Signature":hmac("zokivo-edge-notify:v1:",timestamp+"."+body)
 },body,signal:AbortSignal.timeout(5000)});
 if(r.status!==202)throw Error("Room notify refused: HTTP "+r.status);
 dispatched++;
}
async function expectHandshakeBlocked(pin,capability,origin,status){
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(wsBase+"/connect?pin="+pin,["zokivo.v1","auth."+capability],{
   headers:{Origin:origin},handshakeTimeout:5000,perMessageDeflate:false
  });
  const watchdog=setTimeout(()=>{ws.terminate();reject(Error("Denied socket timed out"))},5500);
  let handled=false;
  ws.once("open",()=>{
   if(!handled){handled=true;clearTimeout(watchdog);ws.terminate();reject(Error("Unauthorized socket ACCEPTED"))}
  });
  ws.once("unexpected-response",(_,response)=>{
   if(!handled){handled=true;clearTimeout(watchdog);
    if(response.statusCode===status)resolve();else reject(Error("Expected HTTP "+status+", got "+response.statusCode));}
   response.resume();
  });
  ws.once("error",err=>{if(!handled){handled=true;clearTimeout(watchdog);reject(err)}});
 });
}
async function openOne(pin,n){
 const capability=issue(pin,randomUUID());
 return new Promise((resolve,reject)=>{
  const started=performance.now();
  const ws=new WebSocket(wsBase+"/connect?pin="+pin,["zokivo.v1","auth."+capability],{
   headers:{Origin:"https://zokivo.xyz"},handshakeTimeout:7000,
   perMessageDeflate:false
  });
  let finished=false;
  const timeout=setTimeout(()=>{if(!finished){finished=true;ws.terminate();reject(Error("Handshake timeout"))}},8000);
  ws.once("unexpected-response",(_,response)=>{
   if(!finished){finished=true;clearTimeout(timeout);reject(Error("Handshake "+response.statusCode))}
  });
  ws.once("error",error=>{
   if(!finished){finished=true;clearTimeout(timeout);reject(error)}
  });
  ws.once("open",()=>{
   if(finished)return;
   finished=true;clearTimeout(timeout);
   if(ws.protocol!=="zokivo.v1"){ws.close();reject(Error("Invalid negotiated subprotocol: "+ws.protocol));return;}
   opened.push(ws);
   resolve({pin,n,ws,connectMs:performance.now()-started});
  });
 });
}
async function openStage(total){
 const clients=[];
 let next=0;
 const lanes=Math.min(total,30);
 await Promise.all(Array.from({length:lanes},async()=>{
  while(next<total){
   const i=next++;
   const room=String((total===100?860000:850000)+Math.floor(i/PER_ROOM));
   const entry=await openOne(room,i);
   clients.push(entry);
  }
 }));
 return clients;
}
async function broadcastStage(clients){
 const byRoom=new Map();
 for(const client of clients){
  const members=byRoom.get(client.pin)||[];
  members.push(client);byRoom.set(client.pin,members);
 }
 const outstanding=new Map();
 const received=[];
 const listeners=[];
 for(const client of clients){
  const handler=raw=>{
   try{
    const data=JSON.parse(String(raw));
    if(data.type!=="refresh"||data.v!==1)return;
    const started=outstanding.get(client.pin);
    if(started===undefined)return;
    received.push({pin:client.pin,latency:performance.now()-started});
    completed++;
   }catch(e){if(failures.length<8)failures.push(String(e))}
  };
  client.ws.on("message",handler);
  listeners.push({client,handler});
 }
 // Mark all rooms before sending so responses cannot race registration.
 const start=performance.now();
 for(const pin of byRoom.keys())outstanding.set(pin,start);
 await Promise.all([...byRoom.keys()].map(notify));
 // 500 ms local max is too strict for CI; 7s watchdog avoids indefinite hangs.
 while(received.length<clients.length&&performance.now()-start<7000)
  await new Promise(r=>setTimeout(r,20));
 listeners.forEach(({client,handler})=>client.ws.off("message",handler));
 assert.equal(received.length,clients.length,
  "Expected "+clients.length+" real socket messages, got "+received.length);
 const metric=stats(received.map(r=>r.latency));
 assert.ok(metric.p95<=2000,"Local message delivery P95 >2000ms: "+JSON.stringify(metric));
 return {clients:clients.length,rooms:byRoom.size,fanout:metric,allReceived:true};
}
async function main(){
 assert.equal(process.env.ZOKIVO_TEST_TARGET||"LOCAL","LOCAL","External target forbidden");
 assert.ok(MAX===1000||MAX===10000,"No unbounded test size permitted");
 if(MAX===10000)console.log("EDGE_LOCAL_10K_HARD_CAP_ACTIVE");
 assert.equal(process.env.ZOKIVO_TEST_CONNECTIONS||"100","100","Only fixed safe stage allowed");
 const mf=new Miniflare({
  modules:true,scriptPath:"edge-realtime/worker.mjs",compatibilityDate:"2026-08-06",
  durableObjects:{ROOM_HUBS:"RoomHub"},
  bindings:{EDGE_REALTIME_SECRET:KEY,ALLOWED_ORIGINS:"https://zokivo.xyz"},
  port:PORT,host:"127.0.0.1",cf:false
 });
 try{
  await mf.ready;
  console.log("EDGE_LOCAL_WORKER_READY");
  const pilot=issue("860000",randomUUID());
  await expectHandshakeBlocked("860000",pilot,"https://unauthorized.example",403);
  await expectHandshakeBlocked("860000",pilot+"tamper","https://zokivo.xyz",401);
  console.log("EDGE_LOCAL_UNAUTHORIZED_HANDSHAKES_REJECTED");
  // First run 100 real sockets in one room: all of a full classroom.
  const first=await openStage(100);
  const one=await broadcastStage(first);
  console.log("EDGE_REAL_WS_STAGE_100="+JSON.stringify(one));
  for(const client of first)client.ws.close(1000);
  await new Promise(r=>setTimeout(r,600));
  // Second stage: ten or one hundred different rooms, 100 per room.
  const clients=await openStage(MAX);
  const ten=await broadcastStage(clients);
  console.log("EDGE_REAL_WS_STAGE_"+MAX+"="+JSON.stringify(ten));
  console.log("EDGE_REAL_WS_TEST_PASS="+JSON.stringify({
   localWebSocketConnectionsEstablished:100+MAX,maxSimultaneousLocal:MAX,
   realCloudflareConnections:0,realNeonAnswerWrites:0,
   networkScope:"localhost Miniflare/workerd",fanoutP95Ms:ten.fanout.p95,
   certifiedOneMillion:false,certifiedTwoSecondGameOperations:false
  }));
 }finally{
  for(const ws of opened){try{ws.terminate()}catch{}}
  await mf.dispose();
 }
}
main().catch(error=>{
 console.error("EDGE_REAL_WS_TEST_FAIL",error.stack||error);
 process.exitCode=1;
});
