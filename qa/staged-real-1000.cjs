/* Isolated ZoKivo real HTTP 10x100 QA. All writes restricted by QA DB marker. */
const {neon}=require("@neondatabase/serverless");
const {randomUUID,createHmac}=require("node:crypto");
const fs=require("node:fs");
const http=require("node:http");
const {performance}=require("node:perf_hooks");
const secret=process.env.ZOKIVO_SESSION_SECRET,dburl=process.env.DATABASE_URL;
if(process.env.ZOKIVO_QA_CONFIRM!=="BRANCH_ONLY_1000"||!dburl||!secret||secret.length<32)throw Error("QA guard env is missing");
const sql=neon(dburl),agent=new http.Agent({keepAlive:true,maxSockets:1024});
const m={join:[],state:[],answer:[],settled:[],reconnect:[],burst100:[],burst250:[],burst500:[],burst1000:[]};
const counts={join:[0,0],state:[0,0],answer:[0,0],settled:[0,0],reconnect:[0,0],burst100:[0,0],burst250:[0,0],burst500:[0,0],burst1000:[0,0]};
const failures=[],statusCodes={},roundOk=[];
const hash=t=>createHmac("sha256",secret).update(t).digest("hex");
function p95(a,p){if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return Math.round(s[Math.min(s.length-1,Math.ceil(s.length*p)-1)])}
function stats(a){return {count:a.length,p50:p95(a,.5),p90:p95(a,.9),p95:p95(a,.95),p99:p95(a,.99),max:Math.round(Math.max(0,...a))}}
function httpCall(path,{token,readToken,method="GET",body,timeout=10000}={}){
 return new Promise(resolve=>{
  const start=performance.now();
  const data=body?JSON.stringify(body):"";
  const headers={accept:"application/json",...(token?{"x-player-token":token}:{}),...(readToken?{"x-player-read-token":readToken}:{}),...(body?{"content-type":"application/json","content-length":Buffer.byteLength(data)}:{})};
  let done=false;
  const finish=(obj)=>{if(done)return;done=true;resolve({...obj,ms:performance.now()-start})};
  const req=http.request("http://127.0.0.1:3000"+path,{method,headers,agent,timeout},res=>{
   let buffer="";
   res.on("data",c=>{if(buffer.length<1300000)buffer+=c.toString()});
   res.on("end",()=>{let json=null;try{json=JSON.parse(buffer)}catch{}finish({status:res.statusCode,data:json})});
   res.on("error",e=>finish({error:e.code||e.message}));
  });
  req.once("error",e=>finish({error:e.code||e.message}));
  req.once("timeout",()=>req.destroy(new Error("timeout")));
  if(body)req.write(data);req.end();
 });
}
function track(kind,r){
 m[kind].push(r.ms);const ok=r.status===200;
 counts[kind][ok?0:1]++;
 if(!ok){
  const key=String(r.status||r.error||"unknown");
  statusCodes[key]=(statusCodes[key]||0)+1;
  if(failures.length<30)failures.push({kind,status:r.status,error:r.error,message:r.data?.error});
 }
 return ok;
}
async function pool(tasks,concurrency,work){
 let next=0;const workers=Math.min(concurrency,tasks.length);
 await Promise.all(Array.from({length:workers},async()=>{
  while(next<tasks.length){
   const x=tasks[next++];
   try{await work(x)}catch(e){if(failures.length<30)failures.push({workException:String(e).slice(0,200)})}
  }
 }));
}
async function qaGuard(){
 const rows=await sql.query("SELECT marker FROM public.zokivo_qa_sandbox_guard WHERE marker=$1",["exclusive-qa-1000-20261020"]);
 if(rows.length!==1)throw Error("QA DB marker absent: refusing to write");
}
async function createRooms(){
 const quizId=randomUUID();
 await sql.query("INSERT INTO quiz_sets(id,title,status,description) VALUES($1,$2,$3,$4)",[quizId,"Isolated QA load test","published","Test only"]);
 for(let i=0;i<2;i++)await sql.query("INSERT INTO questions(quiz_set_id,question,choices,correct_index,position,point_value) VALUES($1,$2,$3::jsonb,$4,$5,$6)",
  [quizId,"Test maths question "+i,JSON.stringify(["0","1","2","3"]),1,i,100]);
 const rooms=[];
 for(let i=0;i<10;i++){
  let room=null;
  for(let tries=0;tries<25;tries++){
   const pin=String(810000+Math.floor(Math.random()*90000));
   if(rooms.some(r=>r.pin===pin))continue;
   const rows=await sql.query("INSERT INTO rooms(pin,quiz_set_id,host_token_hash,status,game_mode,allow_late_joining,question_seconds) VALUES($1,$2,$3,'lobby','quiz_party',true,60) ON CONFLICT DO NOTHING RETURNING pin",[pin,quizId,hash("testhost-"+pin)]);
   if(rows.length){room={pin,players:[]};break}
  }
  if(!room)throw Error("Could not allocate synthetic room");
  rooms.push(room);
 }
 console.log("QA_FIXTURES",{quizId,pins:rooms.map(r=>r.pin)});
 return {quizId,rooms};
}
async function verify(fixture,round){
 const rows=await sql.query("SELECT room_pin,question_index,count(*)::integer AS n,count(*) FILTER(WHERE is_correct)::integer AS right FROM answers WHERE room_pin=ANY($1::char(6)[]) GROUP BY room_pin,question_index ORDER BY room_pin,question_index",
  [fixture.rooms.map(r=>r.pin)]);
 const scores=await sql.query("SELECT room_pin,count(*)::integer AS player_count,sum(score)::integer AS total,min(score)::integer AS low,max(score)::integer AS high FROM players WHERE room_pin=ANY($1::char(6)[]) GROUP BY room_pin ORDER BY room_pin",[fixture.rooms.map(r=>r.pin)]);
 const ok=rows.length===10*(round+1)&&rows.every(x=>x.n===100&&x.right===50)&&scores.length===10&&scores.every(x=>x.player_count===100&&x.total===5000*(round+1)&&x.low===0&&x.high===100*(round+1));
 console.log("QA_DB_RECONCILIATION",JSON.stringify({round,passed:ok,answersPerRoom:rows.map(x=>x.n),scoresPerRoom:scores.map(x=>({total:x.total,min:x.low,max:x.high}))}));
 return ok;
}
// Graduated, isolated burst test: actual concurrent HTTP calls, NOT merely 1000 users in a loop.
// Never run this against production; qaGuard() is required before fixtures can be created.
async function readBurst(fixture){
 const people=fixture.rooms.flatMap(room=>room.players.map(player=>({room,player})));
 for(const num of [100,250,500,1000]){
  const stage="burst"+num;
  const started=performance.now();
  const results=await Promise.all(people.slice(0,num).map(x=>
   httpCall("/api/rooms/"+x.room.pin,{token:x.player.token,readToken:x.player.readToken,timeout:15000})));
  results.forEach(result=>track(stage,result));
  console.log("QA_BURST",JSON.stringify({
   clients:num,actualHttpRequests:results.length,phase:"lobby",
   wallClockMs:Math.round(performance.now()-started),
   metrics:stats(m[stage]),success:counts[stage][0],failed:counts[stage][1]
  }));
  if(counts[stage][1]!==0&&num>=500)throw Error("QA automatic stop: failures at "+num+" concurrent reads; not escalating");
 }
}
async function playRound(fixture,round){
 await pool(fixture.rooms,10,async room=>{
  await sql.query("UPDATE rooms SET status='playing',current_index=$1,deadline=now()+interval '5 minutes' WHERE pin=$2",[round,room.pin]);
 });
 const tasks=fixture.rooms.flatMap(room=>room.players.map((player,index)=>({room,player,index})));
 await pool(tasks,100,async x=>{
  const r=await httpCall("/api/rooms/"+x.room.pin,{token:x.player.token,readToken:x.player.readToken,timeout:14000});
  if(track("state",r)&&r.data?.players?.length!==100&&failures.length<30)failures.push({kind:"bad room size",pin:x.room.pin});
 });
 await pool(tasks,120,async x=>{
  const r=await httpCall("/api/rooms/"+x.room.pin+"/answer",{method:"POST",token:x.player.token,body:{choice:x.index%2===0?1:0},timeout:18000});
  track("answer",r);
 });
 await pool(fixture.rooms,10,async room=>{await sql.query("UPDATE rooms SET deadline=now()-interval '5 seconds' WHERE pin=$1",[room.pin])});
 await pool(tasks,100,async x=>{
  const r=await httpCall("/api/rooms/"+x.room.pin,{token:x.player.token,readToken:x.player.readToken,timeout:14000});
  if(track("settled",r)&&r.data?.players?.length!==100&&failures.length<30)failures.push({kind:"bad settled room size"});
 });
 await pool(tasks.filter((_,i)=>i%10===0),30,async x=>{
  const r=await httpCall("/api/rooms/"+x.room.pin,{token:x.player.token,readToken:x.player.readToken,timeout:14000});
  track("reconnect",r);
 });
 const ok=await verify(fixture,round);roundOk.push(ok);
 console.log("QA_ROUND",JSON.stringify({round,answer:stats(m.answer),state:stats(m.state),errors:counts}));
}
async function main(){
 const started=Date.now();
 await qaGuard();
 console.log("QA_READY","Neon isolated marker verified");
 const fixture=await createRooms();
 const joins=fixture.rooms.flatMap(room=>Array.from({length:100},(_,i)=>({room,nickname:"QA"+String(i).padStart(3,"0")})));
 await pool(joins,25,async x=>{
  const r=await httpCall("/api/rooms/"+x.room.pin+"/join",{method:"POST",body:{nickname:x.nickname,avatar:"spark"},timeout:18000});
  if(track("join",r)&&r.data?.token){
   if(typeof r.data.readToken!=="string"||!r.data.readToken.startsWith("zr1."))throw Error("Missing signed QA room-read token");
   x.room.players.push({nickname:x.nickname,token:r.data.token,readToken:r.data.readToken});
  }
 });
 const players=fixture.rooms.reduce((n,r)=>n+r.players.length,0);
 console.log("QA_JOIN",JSON.stringify({players,metrics:stats(m.join),errors:counts.join}));
 if(players!==1000)throw Error("Joined "+players+"/1000: stage aborted");
 await readBurst(fixture);
 for(let round=0;round<2;round++)await playRound(fixture,round);
 const report={at:new Date().toISOString(),durationSec:Math.round((Date.now()-started)/1000),
  rooms:10,players,rounds:2,results:Object.fromEntries(Object.keys(m).map(k=>[k,{...stats(m[k]),successful:counts[k][0],failed:counts[k][1]}])),
  httpErrors:statusCodes,dbIntegrity:roundOk,failures,scope:"Local Next.js origin with isolated Neon QA branch. Graduated 100/250/500/1000 simultaneous authorized HTTP GET, 1000 joins, 2 answer rounds capped at 120 in-flight writes. No production Cloudflare, serverless deployment or realtime sockets."};
 fs.writeFileSync("/tmp/zokivo-1000-qa-summary.json",JSON.stringify(report,null,2));
 console.log("QA_FINAL_REPORT",JSON.stringify(report));
 // Do not label a run PASS just because HTTP returned 200: slow requests
 // are a performance failure. These are *local QA HTTP* gates, not Realtime.
 const latencyTargets={join:2000,state:1000,answer:1000,settled:1000,reconnect:1000,burst100:1000,burst250:1000,burst500:1000,burst1000:1000};
 const slow=Object.entries(latencyTargets).filter(([name,target])=>{
  const result=report.results[name];
  return result?.count===0||result?.p95===null||result.p95>target||result.p99>Math.max(2000,target*2);
 });
 const incompleteBurst=report.results.burst1000?.count!==1000;
 const integrityFailure=roundOk.length!==2||roundOk.some(x=>!x);
 const errorFailure=Object.values(counts).some(c=>c[1]>0);
 const passed=!incompleteBurst&&!integrityFailure&&!errorFailure&&!slow.length;
 console.log("QA_PERFORMANCE_ACCEPTANCE",JSON.stringify({
  passed,latencyTargets,p99MaxMs:2000,burst1000Samples:report.results.burst1000?.count||0,
  slow:slow.map(([name])=>({name,p95:report.results[name]?.p95,p99:report.results[name]?.p99})),
  integrityFailure,errorFailure,limit:"Does not certify realtime fanout, Cloudflare or production"
 }));
 report.acceptance={passed,latencyTargets,slow:slow.map(([name])=>name),incompleteBurst,integrityFailure,errorFailure};
 fs.writeFileSync("/tmp/zokivo-1000-qa-summary.json",JSON.stringify(report,null,2));
 if(!passed)process.exitCode=1;
}
main().catch(e=>{console.error("QA_FATAL",e.stack||e);process.exitCode=2});

