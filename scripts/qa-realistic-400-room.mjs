/**
 * Bounded super-stress test: real official hostname, 100 distinct players, sustained scoreboard polling.
 * Fail closed when 429/5xx/4xx/network errors occur; all writes use an isolated QA room.
 * 100 separate region-verification cookies + 100 independent player tokens.
 * Requires a fresh isolated QA room supplied via ZOKIVO_TEST_ROOM_PIN. Tokens and cookies NEVER logged/artifacted.
 * This is NOT 100 human-operated mobile devices.
 */
import {performance} from "node:perf_hooks";
import {writeFile} from "node:fs/promises";
import {newQaCookieJar} from "./qa-cookie-jar.mjs";
const BASE="https://zokivo.vynalthai.com", PIN=process.env.ZOKIVO_TEST_ROOM_PIN||"",N=100,TIMEOUT=22000;
const allow=new Set(["982501","982502","982503","982504"]);
if(process.env.ZOKIVO_QA_AUTHORIZED!=="20261018"||!allow.has(PIN))throw Error("Refusing live traffic: this one-off test requires a pre-approved isolated QA PIN.");
if(!/^\d{6}$/.test(PIN))throw Error("Require a fresh, separate 6-digit QA room PIN");
const at=()=>new Date().toISOString();
const out={test:"ZoKivo REALISTIC 400: 4 parallel rooms, each 100 simulated clients and 24x100 concurrent scoreboard reads",at:at(),
 base:BASE,roomPin:PIN,profile:{players:100,pollWaves:24,clientsPerWave:100,betweenWaveMs:3000,maxConcurrent:100,stopOnAnyError:true},cookieHandling:"separate per-client Cloudflare _cfuvid + region cookie jars",phases:{},limits:["100 simulated unique sessions, not human operators or devices",
 "Dedicated QA room pre-provisioned in Neon; actual teacher login/start not covered",
 "All request traffic originates from one external GitHub Actions runner",
 "Geographic conditions represent the runner's legitimate Cloudflare-origin country and timezone",
 "No personal user or student data written","No long-term endurance beyond this scenario"]};
const pct=(a,p)=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y);return s[Math.max(0,Math.ceil(a.length*p)-1)]};
function summary(rows){return {requests:rows.length,success:rows.filter(x=>x.ok).length,
 failures:rows.filter(x=>!x.ok).length,p50Ms:pct(rows.map(x=>x.ms),.5),
 p95Ms:pct(rows.map(x=>x.ms),.95),p99Ms:pct(rows.map(x=>x.ms),.99),
 byStatus:Object.fromEntries([...new Set(rows.map(x=>x.status))].map(st=>[st,rows.filter(x=>x.status===st).length])),
 errors:rows.filter(x=>!x.ok).slice(0,6).map(x=>({status:x.status,error:x.error}))};}
async function hit(path,{method="GET",cookie,jar,token,payload,accept}={}){
 const start=performance.now(),c=new AbortController(),timer=setTimeout(()=>c.abort(),TIMEOUT);
 try {
  const res=await fetch(BASE+path,{method,cache:"no-store",redirect:"manual",signal:c.signal,
   headers:{Accept:accept||"application/json",...(payload?{"Content-Type":"application/json"}:{}),
    ...(jar?.header()?{Cookie:jar.header()}:(cookie?{Cookie:cookie}:{})),...(token?{"x-player-token":token}:{}),
    ...(path==="/__shield/gps/region-check"?{Origin:BASE,"Sec-Fetch-Site":"same-origin"}:{})},
   body:payload?JSON.stringify(payload):undefined});
  jar?.capture(res.headers);
  const body=await res.text();let data=null;
  try{data=JSON.parse(body)}catch{}
  return {status:res.status,ms:Math.round(performance.now()-start),data,
   body:body.slice(0,80000)};
 } catch(e){
  return {status:0,ms:Math.round(performance.now()-start),data:null,
   error:e?.name==="AbortError"?"TIMEOUT":"NETWORK_ERROR"};
 } finally {clearTimeout(timer)}
}
function emit(label,data){out.phases[label]=data;console.log(label.toUpperCase()+"="+JSON.stringify(data));}
const nickname=i=>"CQA"+PIN+"-"+String(i).padStart(3,"0");
const visitors=Array.from({length:N},(_,i)=>({i:i+1,jar:newQaCookieJar()}));
const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
const handshake=await Promise.all(visitors.map(async p=>{
 let r;
 for(let attempt=0;attempt<3;attempt++){
  r=await hit("/__shield/gps/region-check",{method:"POST",payload:{timezone},jar:p.jar});
  if(r.status!==0)break; // retry transport failures only, never HTTP 429
  await new Promise(resolve=>setTimeout(resolve,(attempt+1)*250));
 }
 const cookie=p.jar.header();
 const ok=r.status===200&&r.data?.checked===true&&r.data?.gpsRequired===false&&
   p.jar.has("__Host-vynalth-region");
 return {...p,status:r.status,ms:r.ms,ok,error:ok?null:r.data?.error||r.error||"REGION_NOT_ALLOWED",cookie:ok?cookie:null};
}));
emit("handshake",summary(handshake));
let active=handshake.filter(x=>x.ok);
if(active.length===N){
 const arrived=await Promise.all(active.map(async p=>{
  const r=await hit("/api/rooms/"+PIN+"/join",{method:"POST",jar:p.jar,
   payload:{nickname:nickname(p.i),avatar:"spark"}});
  const ok=r.status===200&&r.data?.nickname===nickname(p.i)&&typeof r.data?.token==="string";
  return {...p,token:ok?r.data.token:null,ok,status:r.status,ms:r.ms,
    error:ok?null:r.data?.error||r.error||"JOIN_ERROR"};
 }));
 emit("join",summary(arrived));
 active=arrived.filter(x=>x.ok);
 if(active.length===N){
  const extra=await hit("/api/rooms/"+PIN+"/join",{method:"POST",jar:active[0].jar,
   payload:{nickname:"CQA-EXTRA-101",avatar:"spark"}});
  emit("capacityLimit",{status:extra.status,blocked:extra.status===409});
 }
 if(active.length>=80) {
  const answered=await Promise.all(active.map(async p=>{
   const choice=p.i%2===0?1:0;
   const r=await hit("/api/rooms/"+PIN+"/answer",{method:"POST",jar:p.jar,
     token:p.token,payload:{choice}});
   const ok=r.status===200&&r.data?.accepted===true;
   return {...p,ok,status:r.status,ms:r.ms,error:ok?null:r.data?.error||r.error||"ANSWER_ERROR"};
  }));
  emit("answer",summary(answered));
  const accepted=answered.filter(x=>x.ok);
  if(accepted.length===N){
   const first=await hit("/api/rooms/"+PIN,{jar:accepted[0].jar,token:accepted[0].token});
   const phase=first.data?.scoreboardPhase||null;
   emit("duringRound",{status:first.status,phase,masked:first.status===200&&phase==="previous-round"&&
     first.data.players.length===100&&first.data.players.every(x=>x.score===0)});
   const duplicate=await hit("/api/rooms/"+PIN+"/answer",{method:"POST",jar:accepted[0].jar,
     token:accepted[0].token,payload:{choice:1}});
   emit("duplicate",{status:duplicate.status,blocked:duplicate.status===409});
   const invalid=await hit("/api/rooms/"+PIN,{jar:accepted[0].jar,token:"untrusted-token"});
   emit("unauthorized",{status:invalid.status,blocked:invalid.status===401||invalid.status===403});
   // 24 bounded waves of 100 concurrent GETs, every ~3s, one GitHub runner per isolated room. Stop on first bad wave.
   // Stop immediately after any bad wave; DO NOT continue making traffic under rate limits.
   const waveRecords=[];
   const allLatencies=[];
   for(let w=1;w<=24;w++){
    await new Promise(resolve=>setTimeout(resolve,3000));
    const t0=performance.now();
    const reads=await Promise.all(accepted.map(async p=>{
     let r=await hit("/api/rooms/"+PIN,{jar:p.jar,token:p.token});
     if(r.status===0)r=await hit("/api/rooms/"+PIN,{jar:p.jar,token:p.token});
     const scores=r.data?.players;
     return {status:r.status,ms:r.ms,ok:r.status===200&&r.data?.scoreboardPhase==="previous-round"&&
      Array.isArray(scores)&&scores.length===N&&scores.every(q=>q.score===0),
      error:r.error||r.data?.error||null};
    }));
    const one=summary(reads);
    const entry={wave:w,elapsedMs:Math.round(performance.now()-t0),...one};
    waveRecords.push(entry);
    allLatencies.push(...reads.map(x=>x.ms));
    console.log("POLLING_WAVE="+JSON.stringify(entry));
    if(one.failures>0||one.byStatus["429"]||one.byStatus["503"]||one.byStatus["500"]){
     out.aborted="SUSTAINED_WAVE_ERROR_STOPPED";
     break;
    }
   }
   const total=waveRecords.reduce((n,w)=>n+w.requests,0),
    good=waveRecords.reduce((n,w)=>n+w.success,0);
   emit("pollingBurst",{planned:2400,requests:total,success:good,failures:total-good,
    completedWaves:waveRecords.length,pass:waveRecords.length===24&&good===2400,
    p50Ms:pct(allLatencies,.5),p95Ms:pct(allLatencies,.95),p99Ms:pct(allLatencies,.99),
    waves:waveRecords});
   if(out.phases.pollingBurst.pass){
   const deadline=Date.parse(first.data?.deadline||"");
   const wait=deadline+2200-Date.now();
   if(!Number.isFinite(deadline)||wait>110000)emit("settlePreflight",{ok:false,error:"INVALID_OR_LATE_DEADLINE",waitMs:wait});
   else {
    if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
    // Region session cookies expire after 120sec; renew if needed.
    const settled=await Promise.all(accepted.map(async p=>{
     let r=await hit("/api/rooms/"+PIN,{jar:p.jar,token:p.token});
     if(r.status===403&&r.data?.error==="REGIONAL_CHECK_REQUIRED"){
      await hit("/__shield/gps/region-check",{method:"POST",payload:{timezone},jar:p.jar});
      r=await hit("/api/rooms/"+PIN,{jar:p.jar,token:p.token});
     }
     const players=r.data?.players||[];
     const scoreByName=new Map(players.map(x=>[x.nickname,x.score]));
     const allScores=accepted.every(x=>scoreByName.get(nickname(x.i))===(x.i%2===0?100:0));
     const ok=r.status===200&&r.data?.scoreboardPhase==="settled"&&
        r.data?.answeredCount===100&&players.length===100&&allScores;
     return {status:r.status,ms:r.ms,ok,error:ok?null:r.data?.error||r.error||"BAD_SETTLED_SCORES"};
    }));
    emit("settledScoreboard",summary(settled));
   }
   } // sustained phase passed
  }
 } else out.aborted="More than 20 join failures; answer wave not executed";
}else out.aborted="Regional handshake failed for some clients; no game writes attempted";
out.pass=out.phases.handshake?.success===100&&out.phases.join?.success===100&&
 out.phases.answer?.success===100&&out.phases.pollingBurst?.pass===true&&out.phases.capacityLimit?.blocked===true&&
 out.phases.duringRound?.masked===true&&out.phases.duplicate?.blocked===true&&
 out.phases.unauthorized?.blocked===true&&out.phases.settledScoreboard?.success===100;
out.actualHumanDevicesTested=0;
out.realPhysicalDevices=0;
out.browserE2ESeparate=true;
await writeFile("zokivo-realistic-400-room-report.json",JSON.stringify(out,null,2)+"\n");
console.log("REALISTIC_400_ROOM_RESULT="+JSON.stringify({...out,phases:{...out.phases,pollingBurst:{...out.phases.pollingBurst,waves:undefined}}}));
if(!out.pass)process.exitCode=1;
