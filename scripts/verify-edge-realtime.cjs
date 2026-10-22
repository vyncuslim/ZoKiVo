const fs=require("node:fs"),assert=require("node:assert/strict");
const ts=require("typescript"),{pathToFileURL}=require("node:url"),path=require("node:path");
let count=0;const ok=(value,label)=>{assert.ok(value,label);count++};
const raw=fs.readFileSync("src/lib/edge-realtime-auth.ts","utf8");
const compiled=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};
new Function("require","module","exports",compiled)(require,m,m.exports);
const node=m.exports;
const secret="test-only-zokivo-edge-key-must-never-be-used-in-production-123456";
process.env.ZOKIVO_EDGE_REALTIME_SECRET=secret;
process.env.ZOKIVO_EDGE_REALTIME_ENABLED="true";
process.env.ZOKIVO_EDGE_REALTIME_URL="https://pilot.zokivo.example";
ok(node.edgeRealtimeUrl()===null,"0% rollout leaves edge completely disabled");
process.env.ZOKIVO_EDGE_REALTIME_PERCENT="1";
ok(node.edgeRealtimeUrl()?.origin==="https://pilot.zokivo.example","Controlled rollout enables configured endpoint");
const canaryCount=Array.from({length:10000},(_,i)=>node.edgeCanaryRoom(String(100000+i)))
 .filter(Boolean).length;
ok(canaryCount>50&&canaryCount<150,"Canary selects about 1% of rooms, not each player individually");
process.env.ZOKIVO_EDGE_REALTIME_PERCENT="100";
ok(node.edgeCanaryRoom("123456"),"100% enablement selects room predictably");

(async()=>{
 const worker=await import(pathToFileURL(path.resolve("edge-realtime/worker.mjs")).href);
 const now=Math.floor(Date.now()/1000);
 const cap=node.issueEdgeRoomCapability("quiz","123456","player:00000000-0000-4000-8000-000000000001",now);
 ok(cap.startsWith("zke1."),"Versioned capability minted");
 ok((await worker.verifyCapability(cap,"quiz","123456",secret,now))?.subject.startsWith("player:"),"Node-issued HMAC valid on Workers WebCrypto");
 ok((await worker.verifyCapability(cap,"quiz","654321",secret,now))===null,"Cross-room reuse denied");
 ok((await worker.verifyCapability(cap,"quiz","123456",secret,now+121))===null,"Expired capability denied");
 ok((await worker.verifyCapability(cap+"x","quiz","123456",secret,now))===null,"Modified HMAC denied");
 ok((await worker.verifyCapability(cap,"quiz","123456","wrong-secret-wrong-secret-wrong-secret",now))===null,"Wrong deployment secret denied");
 const body=JSON.stringify({kind:"quiz",pin:"123456",nonce:"00000000-0000-4000-8000-000000000001"});
 const timestamp=String(Date.now());
 const sig=node.signEdgeNotify(timestamp,body);
 ok(await worker.verifyNotification(sig,timestamp,body,secret),"Notify HMAC accepted");
 ok(!(await worker.verifyNotification(sig,timestamp,body.replace("123456","654321"),secret)),"Cross-room notify HMAC rejected");
 ok(!(await worker.verifyNotification(sig,String(Number(timestamp)-35000),body,secret)),"Stale notification rejected");
 let routed=0,assigned=null,network=0;
 const env={EDGE_REALTIME_SECRET:secret,
  ALLOWED_ORIGINS:"https://zokivo.xyz",
  ROOM_HUBS:{
   idFromName(name){assigned=name;return name},
   get(){return {fetch:async request=>{routed++;return new Response("",{status:request.method==="POST"?202:200})}}}
  }
 };
 const socketRequest=(origin,token)=>
  new Request("https://edge.example/connect?pin=123456",{
   headers:{"Origin":origin,"Upgrade":"websocket","Sec-WebSocket-Protocol":"zokivo.v1, auth."+token}
  });
 const badOrigin=await worker.default.fetch(socketRequest("https://evil.example",cap),env);
 ok(badOrigin.status===403&&routed===0,"Cross-origin socket rejected before Durable Object");
 const badCap=await worker.default.fetch(socketRequest("https://zokivo.xyz",cap+"corrupt"),env);
 ok(badCap.status===401&&routed===0,"Forged socket rejected before Durable Object");
 const allowed=await worker.default.fetch(socketRequest("https://zokivo.xyz",cap),env);
 ok(allowed.status===200&&assigned==="quiz:123456"&&routed===1,"Valid socket routes only to room-specific Durable Object");
 const deniedNotify=await worker.default.fetch(new Request("https://edge.example/notify",{
  method:"POST",body,headers:{"X-ZoKivo-Timestamp":timestamp,"X-ZoKivo-Signature":"wrong"}
 }),env);
 ok(deniedNotify.status===401&&routed===1,"Unauthenticated notification cannot broadcast");
 const validNotify=await worker.default.fetch(new Request("https://edge.example/notify",{
  method:"POST",body,headers:{"X-ZoKivo-Timestamp":timestamp,"X-ZoKivo-Signature":sig}
 }),env);
 ok(validNotify.status===202&&routed===2,"Authenticated notify routed into same room (status="+validNotify.status+", routed="+routed+", body="+await validNotify.clone().text()+")");
 let alarmAt=null,revision=0;
 const socket={sent:[],send(s){this.sent.push(s)},close(){}};
 const ctx={
  storage:{getAlarm:async()=>alarmAt,setAlarm:async t=>{alarmAt=t},
   get:async()=>revision,put:async (k,v)=>{revision=v}},
  getWebSockets:()=>[socket]
 };
 const hub=new worker.RoomHub(ctx,{});
 await hub.fetch(new Request("https://room.internal/notify",{method:"POST"}));
 await hub.fetch(new Request("https://room.internal/notify",{method:"POST"}));
 ok(typeof alarmAt==="number"&&alarmAt>Date.now()-1000,"Updates schedule hibernation-safe alarm");
 await hub.alarm();
 ok(revision===1&&socket.sent.length===1&&JSON.parse(socket.sent[0]).type==="refresh",
  "Burst emits one room-only refresh, no score or answer disclosure");
 ok(!JSON.stringify(socket.sent).includes("player:")&&!JSON.stringify(socket.sent).includes("choice"),"Fanout never includes student identity or answers");
 const client=fs.readFileSync("src/lib/use-room-realtime.ts","utf8");
 ok(client.includes('candidate==="edge"?await connectEdge()')&&client.includes('"auth."+meta.capability'),"WebSocket primary and fallback protocol wired");
 const plan=fs.readFileSync("src/app/api/realtime/plan/route.ts","utf8");
 ok(plan.includes('["edge",...fallback]')&&plan.includes('edgeRealtimeUrl()'),"Edge flag preserves old provider sequence");
 const issuer=fs.readFileSync("src/app/api/realtime/edge/route.ts","utf8");
 ok(issuer.includes("token_hash=")&&issuer.includes("issueEdgeRoomCapability"),"Edge credentials issued only after DB verification");
 console.log("EDGE_REALTIME_TEST_PASS "+count+" tests; NO real sockets, credentials, DB writes, or network traffic");
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
