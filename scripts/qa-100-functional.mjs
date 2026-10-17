/**
 * ZoKivo bounded 100-player API acceptance, using ONLY a disposable test room.
 * The room is provisioned separately with Neon; no user credentials or real
 * player names are present in this script. Tokens never enter logs/artifacts.
 * This is 100 distinct simulated players, NOT 100 physical browsers/devices.
 */
import {performance} from "node:perf_hooks";
import {writeFile} from "node:fs/promises";

const PIN="997321";
const BASE="https://zokivo.vercel.app";
const PUBLIC="https://zokivo.vynalthai.com";
const N=100, TIMEOUT=25000;
const results={project:"ZoKivo",test:"100 distinct real API player sessions",executedAt:new Date().toISOString(),
  roomPin:PIN,base:BASE,publicDomain:PUBLIC,domainProbes:[],stages:{},limitations:[
    "100 simulated independently-tokened HTTP clients, not 100 physical mobile devices",
    "Host start/end APIs require a separately authenticated real host; test room was safely provisioned in Neon",
    "Only a disposable QA room is mutated; no live student scores or teacher accounts are modified",
    "This run checks masked in-round scores; finalized leaderboard is tested separately after deadline",
    "One GitHub-hosted runner source IP; no geographic or multi-network coverage"
  ]};
const history=[];
const percentile=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.max(0,Math.ceil(s.length*p)-1)]};
function stats(a){return {requests:a.length,success:a.filter(x=>x.ok).length,errors:a.filter(x=>!x.ok).length,
  p50Ms:percentile(a.map(x=>x.ms),.5),p95Ms:percentile(a.map(x=>x.ms),.95),
  p99Ms:percentile(a.map(x=>x.ms),.99),
  statuses:Object.fromEntries([...new Set(a.map(x=>x.status))].map(n=>[n,a.filter(x=>x.status===n).length])),
  examples:a.filter(x=>!x.ok).slice(0,4).map(x=>({code:x.status,error:x.error}))}};
async function req(url,{method="GET",headers={},json}={}){
 const start=performance.now(),controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),TIMEOUT);
 try{
  const res=await fetch(url,{method,headers:{"Accept":"application/json",...(json?{"Content-Type":"application/json"}:{}),...headers},
    body:json?JSON.stringify(json):undefined,signal:controller.signal,redirect:"manual",cache:"no-store"});
  const raw=await res.text();let data=null;
  try{data=JSON.parse(raw)}catch{}
  return {status:res.status,ms:Math.round(performance.now()-start),data,raw,
    contentType:res.headers.get("content-type")||"",
    edge:res.headers.get("x-vynalth-edge")||"",origin:res.headers.get("x-vynalth-origin")||"",
    location:res.headers.has("location")};
 }catch(e){return {status:0,ms:Math.round(performance.now()-start),error:e?.name==="AbortError"?"TIMEOUT":"NETWORK_ERROR",raw:"",data:null}}
 finally{clearTimeout(timer)}
}
// Test official domain without exposing cookies, signed query tokens or PII.
for(const path of ["/","/games","/play","/api/paper/status"]){
 const x=await req(PUBLIC+path,{headers:{Accept:path.startsWith("/api")?"application/json":"text/html"}});
 const screen=/checking regional access|verify your location|REGIONAL_CHECK_REQUIRED|Access currently unavailable/i.test(x.raw);
 const valid=path.startsWith("/api")?
    x.status===200&&!!x.data&&typeof x.data.enabled==="boolean":
    x.status===200&&/ZoKivo/i.test(x.raw)&&!screen;
 const safe={path,status:x.status,contentType:x.contentType,
   edge:x.edge,origin:x.origin,gpsScreen:screen,actualApp:valid,
   preview:x.raw.replace(/<[^>]*>/g," ").replace(/\s+/g," ").slice(0,120)};
 results.domainProbes.push(safe);
 console.log("DOMAIN_PROBE="+JSON.stringify(safe));
}
results.officialDomainPass=results.domainProbes.every(p=>p.actualApp);
const state=await req(BASE+"/api/rooms/"+PIN);
results.roomPreflight={status:state.status,expectedUnauthorized:state.status===401};
console.log("ROOM_PREFLIGHT="+JSON.stringify(results.roomPreflight));
if(state.status!==401){results.aborted="Unexpected test-room preflight. Refusing player writes.";}
else {
 const roster=Array.from({length:N},(_,i)=>({idx:i+1,name:"LoadQA-"+PIN+"-"+String(i+1).padStart(3,"0")}));
 const joined=await Promise.all(roster.map(async player=>{
   const r=await req(BASE+"/api/rooms/"+PIN+"/join",{method:"POST",
     json:{nickname:player.name,avatar:"spark"}});
   const ok=r.status===200 && typeof r.data?.token==="string" && r.data.nickname===player.name;
   return {idx:player.idx,name:player.name,token:ok?r.data.token:null,status:r.status,
      ok,ms:r.ms,error:ok?null:r.error||r.data?.error||"BAD_JOIN_RESPONSE"};
 }));
 results.stages.join=stats(joined);
 console.log("JOIN="+JSON.stringify(results.stages.join));
 const sessions=joined.filter(x=>x.ok);
 // One extra guest must be refused (capacity is exactly 100).
 if(sessions.length===100){
  const extra=await req(BASE+"/api/rooms/"+PIN+"/join",{method:"POST",json:{nickname:"LoadQA-EXTRA-101",avatar:"spark"}});
  results.overflow={status:extra.status,refused:extra.status===409};
 }else results.overflow={skipped:true,reason:"Not all 100 players joined"};
 console.log("OVERFLOW="+JSON.stringify(results.overflow));
 if(sessions.length>=80){
  const answerRows=await Promise.all(sessions.map(async p=>{
   const choice=p.idx%2===0?1:0; // sample quiz question 0 correct index=1
   const r=await req(BASE+"/api/rooms/"+PIN+"/answer",{method:"POST",
     headers:{"x-player-token":p.token},json:{choice}});
   return {idx:p.idx,status:r.status,ms:r.ms,
     ok:r.status===200&&r.data?.accepted===true,
     error:r.status===200?null:r.error||r.data?.error||"BAD_ANSWER_RESPONSE"};
  }));
  results.stages.answer=stats(answerRows);
  console.log("ANSWER="+JSON.stringify(results.stages.answer));
  const successful=answerRows.filter(x=>x.ok).map(x=>sessions.find(p=>p.idx===x.idx));
  const scoreboard=await Promise.all(successful.map(async p=>{
   const r=await req(BASE+"/api/rooms/"+PIN,{headers:{"x-player-token":p.token}});
   const view=r.data,ok=r.status===200 && view?.viewer?.playerId
     && Array.isArray(view.players) && view.players.length===sessions.length
     && view.index===0 && view.status==="playing"
     && view.answeredCount===successful.length
     && view.scoreboardPhase==="previous-round"
     && view.players.every(x=>x.score===0);
   return {idx:p.idx,status:r.status,ms:r.ms,ok:!!ok,
     error:ok?null:r.error||r.data?.error||"BAD_SCOREBOARD"};
  }));
  results.stages.scoreboard=stats(scoreboard);
  console.log("SCOREBOARD="+JSON.stringify(results.stages.scoreboard));
  if(successful.length){
   const p=successful[0];
   const duplicate=await req(BASE+"/api/rooms/"+PIN+"/answer",{
     method:"POST",headers:{"x-player-token":p.token},json:{choice:1}});
   results.duplicate={status:duplicate.status,blocked:duplicate.status===409};
   console.log("DUPLICATE="+JSON.stringify(results.duplicate));
  }
  const unauthorized=await req(BASE+"/api/rooms/"+PIN,{
    headers:{"x-player-token":"not-a-real-token"}});
  results.unauthorized={status:unauthorized.status,rejected:[401,403].includes(unauthorized.status)};
  console.log("UNAUTHORIZED="+JSON.stringify(results.unauthorized));
 } else {
  results.aborted="More than 20 join failures. Did not run answer wave.";
 }
}
results.simulated100PlayerPass=(
 results.stages.join?.success===100 && results.overflow?.refused &&
 results.stages.answer?.success===100 && results.stages.scoreboard?.success===100 &&
 results.duplicate?.blocked && results.unauthorized?.rejected
);
results.full100RealPlayerProof=false;
await writeFile("zokivo-functional-100-result.json",JSON.stringify(results,null,2)+"\n");
console.log("FINAL_SUMMARY="+JSON.stringify({...results,domainProbes:results.domainProbes.map(({preview,...rest})=>rest)}));
if(!results.simulated100PlayerPass||!results.officialDomainPass)process.exitCode=1;
