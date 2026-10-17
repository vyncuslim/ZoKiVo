/**
 * Live official-domain 100-session end-to-end API load validation.
 * 100 separate region-verification cookies + 100 independent player tokens.
 * Only isolated QA room 967651. Tokens and cookies NEVER logged/artifacted.
 * This is NOT 100 human-operated mobile devices.
 */
import {performance} from "node:perf_hooks";
import {writeFile} from "node:fs/promises";
const BASE="https://zokivo.vynalthai.com", PIN="967651",N=100,TIMEOUT=22000;
const at=()=>new Date().toISOString();
const out={test:"official ZoKivo domain 100-session full API journey",at:at(),
 base:BASE,roomPin:PIN,phases:{},limits:["100 simulated unique sessions, not human operators or devices",
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
async function hit(path,{method="GET",cookie,token,payload,accept}={}){
 const start=performance.now(),c=new AbortController(),timer=setTimeout(()=>c.abort(),TIMEOUT);
 try {
  const res=await fetch(BASE+path,{method,cache:"no-store",redirect:"manual",signal:c.signal,
   headers:{Accept:accept||"application/json",...(payload?{"Content-Type":"application/json"}:{}),
    ...(cookie?{Cookie:cookie}:{}),...(token?{"x-player-token":token}:{}),
    ...(path==="/__shield/gps/region-check"?{Origin:BASE,"Sec-Fetch-Site":"same-origin"}:{})},
   body:payload?JSON.stringify(payload):undefined});
  const body=await res.text();let data=null;
  try{data=JSON.parse(body)}catch{}
  return {status:res.status,ms:Math.round(performance.now()-start),data,
   body:body.slice(0,80000),setCookie:res.headers.get("set-cookie")};
 } catch(e){
  return {status:0,ms:Math.round(performance.now()-start),data:null,
   error:e?.name==="AbortError"?"TIMEOUT":"NETWORK_ERROR"};
 } finally {clearTimeout(timer)}
}
function emit(label,data){out.phases[label]=data;console.log(label.toUpperCase()+"="+JSON.stringify(data));}
const nickname=i=>"CQA"+PIN+"-"+String(i).padStart(3,"0");
const visitors=Array.from({length:N},(_,i)=>({i:i+1}));
const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
const handshake=await Promise.all(visitors.map(async p=>{
 const r=await hit("/__shield/gps/region-check",{method:"POST",payload:{timezone}});
 const cookie=r.setCookie?.split(";")[0]||"";
 const ok=r.status===200&&r.data?.checked===true&&r.data?.gpsRequired===false&&
   cookie.startsWith("__Host-vynalth-region=");
 return {...p,status:r.status,ms:r.ms,ok,error:ok?null:r.data?.error||r.error||"REGION_NOT_ALLOWED",cookie:ok?cookie:null};
}));
emit("handshake",summary(handshake));
let active=handshake.filter(x=>x.ok);
if(active.length===N){
 const arrived=await Promise.all(active.map(async p=>{
  const r=await hit("/api/rooms/"+PIN+"/join",{method:"POST",cookie:p.cookie,
   payload:{nickname:nickname(p.i),avatar:"spark"}});
  const ok=r.status===200&&r.data?.nickname===nickname(p.i)&&typeof r.data?.token==="string";
  return {...p,token:ok?r.data.token:null,ok,status:r.status,ms:r.ms,
    error:ok?null:r.data?.error||r.error||"JOIN_ERROR"};
 }));
 emit("join",summary(arrived));
 active=arrived.filter(x=>x.ok);
 if(active.length===N){
  const extra=await hit("/api/rooms/"+PIN+"/join",{method:"POST",cookie:active[0].cookie,
   payload:{nickname:"CQA-EXTRA-101",avatar:"spark"}});
  emit("capacityLimit",{status:extra.status,blocked:extra.status===409});
 }
 if(active.length>=80) {
  const answered=await Promise.all(active.map(async p=>{
   const choice=p.i%2===0?1:0;
   const r=await hit("/api/rooms/"+PIN+"/answer",{method:"POST",cookie:p.cookie,
     token:p.token,payload:{choice}});
   const ok=r.status===200&&r.data?.accepted===true;
   return {...p,ok,status:r.status,ms:r.ms,error:ok?null:r.data?.error||r.error||"ANSWER_ERROR"};
  }));
  emit("answer",summary(answered));
  const accepted=answered.filter(x=>x.ok);
  if(accepted.length===N){
   const first=await hit("/api/rooms/"+PIN,{cookie:accepted[0].cookie,token:accepted[0].token});
   const phase=first.data?.scoreboardPhase||null;
   emit("duringRound",{status:first.status,phase,masked:first.status===200&&phase==="previous-round"&&
     first.data.players.length===100&&first.data.players.every(x=>x.score===0)});
   const duplicate=await hit("/api/rooms/"+PIN+"/answer",{method:"POST",cookie:accepted[0].cookie,
     token:accepted[0].token,payload:{choice:1}});
   emit("duplicate",{status:duplicate.status,blocked:duplicate.status===409});
   const invalid=await hit("/api/rooms/"+PIN,{cookie:accepted[0].cookie,token:"untrusted-token"});
   emit("unauthorized",{status:invalid.status,blocked:invalid.status===401||invalid.status===403});
   const deadline=Date.parse(first.data?.deadline||"");
   const wait=deadline+2200-Date.now();
   if(!Number.isFinite(deadline)||wait>110000)emit("settlePreflight",{ok:false,error:"INVALID_OR_LATE_DEADLINE",waitMs:wait});
   else {
    if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
    // Region session cookies expire after 120sec; renew if needed.
    const settled=await Promise.all(accepted.map(async p=>{
     let region=p.cookie;
     let r=await hit("/api/rooms/"+PIN,{cookie:region,token:p.token});
     if(r.status===403&&r.data?.error==="REGIONAL_CHECK_REQUIRED"){
      const renew=await hit("/__shield/gps/region-check",{method:"POST",payload:{timezone}});
      region=renew.setCookie?.split(";")[0]||"";
      r=await hit("/api/rooms/"+PIN,{cookie:region,token:p.token});
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
  }
 } else out.aborted="More than 20 join failures; answer wave not executed";
}else out.aborted="Regional handshake failed for some clients; no game writes attempted";
out.pass=out.phases.handshake?.success===100&&out.phases.join?.success===100&&
 out.phases.answer?.success===100&&out.phases.capacityLimit?.blocked===true&&
 out.phases.duringRound?.masked===true&&out.phases.duplicate?.blocked===true&&
 out.phases.unauthorized?.blocked===true&&out.phases.settledScoreboard?.success===100;
out.actualHumanDevicesTested=0;
await writeFile("zokivo-official-100-session.json",JSON.stringify(out,null,2)+"\n");
console.log("OFFICIAL_100_RESULT="+JSON.stringify(out));
if(!out.pass)process.exitCode=1;
