/**
 * ZoKivo 100-client online read-only load smoke.
 * Runs on an independent CI runner with 100 parallel Node fetch clients.
 * This does not test login sessions, 100 authenticated WebSocket users, or camera devices.
 */
import {performance} from "node:perf_hooks";
import {writeFile} from "node:fs/promises";

const base=(process.env.ZOKIVO_TEST_BASE_URL||"https://zokivo.vercel.app").replace(/\/$/,"");
const clients=Math.min(100,Math.max(1,Number(process.env.ZOKIVO_TEST_CLIENTS||100)));
const paperPin=process.env.ZOKIVO_TEST_PAPER_PIN||"995777";
const rounds=Math.min(3,Math.max(1,Number(process.env.ZOKIVO_TEST_ROUNDS||2)));
if(!/^https:\/\/[a-z0-9.-]+$/.test(base)||!/^\d{6}$/.test(paperPin)||
 !Number.isInteger(clients)||!Number.isInteger(rounds))throw Error("Invalid load test settings");
const origins=[new URL(base).origin];
const abortAfter=12000;
const outcomes=[];
const paths=[{url:"/host",type:"html"},{url:"/paper/scan/"+paperPin,type:"html"},
 {url:"/api/paper/"+paperPin,type:"paper"}];

async function hit(client,round,choice) {
 const start=performance.now(),ctrl=new AbortController();
 const timeout=setTimeout(()=>ctrl.abort(),abortAfter);
 try{
  const res=await fetch(base+choice.url,{
   cache:"no-store",redirect:"manual",signal:ctrl.signal,headers:{"Accept":choice.type==="paper"?"application/json":"text/html",
    "X-ZoKivo-QA-ReadOnly":"1"}
  });
  const bytes=await res.text();
  const isJson=choice.type==="paper";
  let valid=false;
  if(isJson){
   try{const obj=JSON.parse(bytes);valid=obj.pin===paperPin&&
     ["lobby","playing","finished"].includes(obj.status)&&Number.isInteger(obj.index)}catch{}
  }else valid=bytes.includes("ZoKivo");
  outcomes.push({client,round,route:choice.url,status:res.status,ok:res.status===200&&valid,
   ms:Math.round(performance.now()-start),error:valid?"":(res.status===200?"Invalid response":"HTTP "+res.status)});
 }catch(e){
  outcomes.push({client,round,route:choice.url,status:0,ok:false,
   ms:Math.round(performance.now()-start),error:e instanceof Error?e.message:"Unknown transport failure"});
 }finally{clearTimeout(timeout)}
}

for(let round=1;round<=rounds;round++){
 const start=performance.now();
 // All 100 clients enter the same start gate; requests are truly concurrent within this process.
 await Promise.all(Array.from({length:clients},(_,i)=>hit(i+1,round,paths[(i+round-1)%paths.length])));
 console.log("Completed concurrent wave "+round+": "+clients+" independent read clients in "+Math.round(performance.now()-start)+" ms");
}

const latencies=outcomes.map(o=>o.ms).sort((a,b)=>a-b);
const percentile=p=>latencies[Math.max(0,Math.ceil(p*latencies.length)-1)];
const good=outcomes.filter(o=>o.ok).length;
const byRoute=Object.fromEntries(paths.map(p=>[p.url,{
 passed:outcomes.filter(o=>o.route===p.url&&o.ok).length,
 total:outcomes.filter(o=>o.route===p.url).length,
 errors:outcomes.filter(o=>o.route===p.url&&!o.ok).slice(0,10)
}]));
const summary={project:"ZoKivo",base,datetime:new Date().toISOString(),
 clients,rounds,requests:outcomes.length,success:good,failures:outcomes.length-good,
 successRate:good/outcomes.length,p50Ms:percentile(.50),p95Ms:percentile(.95),p99Ms:percentile(.99),
 maxMs:latencies.at(-1),byRoute,
 limitations:["Read-only GET requests","No real teacher login or cookies",
 "No 100 authenticated game join, answer, reward or live leaderboard updates",
 "No Supabase realtime subscriptions", "No mobile camera validation",
 "This test cannot guarantee zero incidents in real classroom conditions"]};
await writeFile("zokivo-load-result.json",JSON.stringify(summary,null,2)+"\n");
console.log(JSON.stringify(summary,null,2));
if(summary.failures>0||summary.p95Ms>8000)process.exitCode=1;
