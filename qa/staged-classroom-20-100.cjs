/**
 * Bounded REAL localhost HTTP + isolated Neon QA classroom acceptance.
 * 20 + 100 simulated, independently tokened HTTP students; NOT physical devices.
 * NEVER contacts production ZoKivo or shared production Neon.
 * Requires protected QA environment, isolated marker, and manual workflow consent.
 */
const {neon}=require("@neondatabase/serverless");
const {randomUUID,randomInt,createHmac}=require("node:crypto");
const {writeFileSync}=require("node:fs");
const {performance}=require("node:perf_hooks");
const assert=require("node:assert/strict");
const dbUrl=process.env.DATABASE_URL||"",secret=process.env.ZOKIVO_SESSION_SECRET||"";
if(process.env.ZOKIVO_QA_CONFIRM!=="BRANCH_ONLY_CLASSROOM_20_100"||secret.length<32)
 throw Error("Explicit isolated classroom QA confirmation and secret required");
let parsed;
try{parsed=new URL(dbUrl)}catch{throw Error("Neon QA URL is missing")}
if(!["postgres:","postgresql:"].includes(parsed.protocol)||!parsed.hostname.endsWith(".neon.tech"))
 throw Error("Only a Neon QA database is permitted");
const sql=neon(dbUrl),base="http://127.0.0.1:3000";
const result={at:new Date().toISOString(),scope:"Manual localhost Next.js + isolated Neon QA. Two synthetic classes (20,100). No production, Google OAuth, physical devices, Cloudflare or Realtime WebSockets.",classrooms:[],passed:false};
const pause=ms=>new Promise(done=>setTimeout(done,ms));
const percentile=(arr,p)=>arr.length?[...arr].sort((a,b)=>a-b)[Math.ceil(arr.length*p)-1]:null;
const metrics=arr=>({count:arr.length,p95Ms:percentile(arr,.95),p99Ms:percentile(arr,.99)});
async function guard(){
 const rows=await sql.query("SELECT marker FROM public.zokivo_qa_sandbox_guard WHERE marker=$1",["exclusive-qa-1000-20261020"]);
 assert.equal(rows.length,1,"Dedicated QA marker missing; refusing all fixture writes");
}
async function request(path,{method="GET",body,token,readToken,origin}={}){
 const start=performance.now();
 try{
  const r=await fetch(base+path,{method,cache:"no-store",redirect:"manual",
   headers:{"Accept":"application/json",...(body?{"Content-Type":"application/json"}:{}),
    ...(token?{"X-Player-Token":token}:{}),
    ...(readToken?{"X-Player-Read-Token":readToken}:{}),
    ...(origin?{"Origin":origin}:{}),
   },body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const data=await r.json().catch(()=>null);
  return {status:r.status,data,ms:Math.round(performance.now()-start)};
 }catch(e){return {status:0,data:null,ms:Math.round(performance.now()-start),error:e.name==="TimeoutError"?"TIMEOUT":"NETWORK"}}
}
async function pool(list,limit,fn){
 let index=0;await Promise.all(Array.from({length:Math.min(limit,list.length)},async()=>{
  while(index<list.length){const item=list[index++];await fn(item)}
 }));
}
async function fixture(size){
 const quiz=randomUUID();
 await sql.query("INSERT INTO quiz_sets(id,title,status,description) VALUES($1,$2,'published',$3)",[quiz,"ZoKivo isolated "+size+" classroom QA","Synthetic QA only"]);
 await sql.query("INSERT INTO questions(quiz_set_id,position,question,choices,correct_index,point_value) VALUES($1,0,'QA only: 1 + 1 = ?', $2::jsonb,1,100)",[quiz,JSON.stringify(["1","2","3","4"])]);
 const signature=pin=>createHmac("sha256",secret).update("qa-host-"+pin).digest("hex");
 for(let i=0;i<20;i++){
  const pin=String(randomInt(810000,899999));
  const r=await sql.query("INSERT INTO rooms(pin,quiz_set_id,host_token_hash,status,game_mode,allow_late_joining,question_seconds) VALUES($1,$2,$3,'lobby','quiz_party',false,60) ON CONFLICT DO NOTHING RETURNING pin",[pin,quiz,signature(pin)]);
  if(r.length)return {pin,quiz,size};
 }
 throw Error("No isolated QA room PIN available");
}
async function classroom(size){
 const room=await fixture(size),url="/api/rooms/"+room.pin,users=[],lat={join:[],read:[],answer:[],settled:[]},errors=[];
 const people=Array.from({length:size},(_,i)=>({i,nick:"ClassQA"+size+"-"+String(i).padStart(3,"0")}));
 await pool(people,8,async p=>{
  const r=await request(url+"/join",{method:"POST",body:{nickname:p.nick,avatar:"spark"}});
  lat.join.push(r.ms);
  if(r.status===200&&typeof r.data?.token==="string"&&typeof r.data?.readToken==="string")
   users.push({i:p.i,token:r.data.token,readToken:r.data.readToken});
  else errors.push({stage:"join",status:r.status,error:r.error||"BAD_RESPONSE"});
 });
 if(users.length!==size)throw Error("Join stage failed ("+size+" classroom); stop before writes");
 const invalid=await request(url+"/join",{method:"POST",body:{nickname:"CrossSiteGuest",avatar:"spark"},origin:"https://malicious.invalid"});
 assert.equal(invalid.status,403,"Cross-site join was not blocked");
 await sql.query("UPDATE rooms SET status='playing',current_index=0,deadline=now()+interval '5 minutes' WHERE pin=$1",[room.pin]);
 // Actual concurrent local HTTP requests with individually signed identities.
 const reads=await Promise.all(users.map(async u=>{
  const r=await request(url,{token:u.token,readToken:u.readToken});
  lat.read.push(r.ms);
  if(r.status!==200||r.data?.players?.length!==size)errors.push({stage:"read",status:r.status,error:r.error||"BAD_ROSTER"});
  return r;
 }));
 if(errors.length)throw Error("Concurrent status read stage failed; no answer wave attempted");
 await pool(users,20,async u=>{
  const choice=u.i%2===0?1:0;
  const r=await request(url+"/answer",{method:"POST",body:{choice},token:u.token});
  lat.answer.push(r.ms);
  if(r.status!==200||r.data?.accepted!==true)errors.push({stage:"answer",status:r.status,error:r.error||"NOT_ACCEPTED"});
 });
 if(errors.length)throw Error("Answer write stage failed; no further requests attempted");
 const answers=await sql.query("SELECT count(*)::integer AS n,count(*) FILTER(WHERE is_correct)::integer AS correct FROM answers WHERE room_pin=$1",[room.pin]);
 const totals=await sql.query("SELECT count(*)::integer AS n,coalesce(sum(score),0)::integer AS points FROM players WHERE room_pin=$1",[room.pin]);
 const integrity=answers[0].n===size&&answers[0].correct===Math.ceil(size/2)&&totals[0].n===size&&totals[0].points===Math.ceil(size/2)*100;
 if(!integrity)throw Error("Persisted score and answer reconciliation failed");
 await sql.query("UPDATE rooms SET deadline=now()-interval '3 seconds' WHERE pin=$1",[room.pin]);
 await pause(350);
 await Promise.all(users.map(async u=>{
  const r=await request(url,{token:u.token,readToken:u.readToken});
  lat.settled.push(r.ms);
  const expected=u.i%2===0?100:0;
  const player=r.data?.players?.find(x=>x.nickname==="ClassQA"+size+"-"+String(u.i).padStart(3,"0"));
  if(r.status!==200||Number(player?.score)!==expected)errors.push({stage:"settled",status:r.status,error:r.error||"SCORE_MISMATCH"});
 }));
 const stages=Object.fromEntries(Object.entries(lat).map(([k,v])=>[k,metrics(v)]));
 const performancePass=stages.join.p95Ms<=2500&&stages.read.p95Ms<=2000&&
  stages.answer.p95Ms<=2000&&stages.settled.p95Ms<=2000;
 const summary={size,uniqueSessions:users.length,realHttp:true,physicalDevices:false,
   stages,integrity,scoreTotal:totals[0].points,errors:errors.slice(0,8),
   passed:errors.length===0&&integrity&&performancePass};
 result.classrooms.push(summary);
 console.log("CLASSROOM_QA_SAFE_SUMMARY "+JSON.stringify(summary));
 if(!summary.passed)throw Error("Strict classroom QA acceptance failed");
}
(async()=>{
 try{
  await guard();
  for(const size of [20,100])await classroom(size);
  result.passed=true;
 }catch(e){
  result.failure=e instanceof Error?e.message.slice(0,180):"QA_FAILURE";
  process.exitCode=1;
 }finally{
  writeFileSync("/tmp/zokivo-classroom-20-100-summary.json",JSON.stringify(result,null,2));
  console.log("CLASSROOM_QA_RESULT "+JSON.stringify({passed:result.passed,classrooms:result.classrooms.length,failure:result.failure||null}));
 }
})();