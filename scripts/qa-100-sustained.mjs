/**
 * ZoKivo bounded online load acceptance: real HTTP requests, no test data writes.
 * 25/50/100 concurrent readers + 12 waves of 100 dynamic Paper Mode DB reads.
 * Does NOT emulate 100 authenticated game participants, answer submissions,
 * socket subscriptions, real browsers, or teacher accounts.
 */
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";

const DIRECT = "https://zokivo.vercel.app";
const CUSTOM = "https://zokivo.vynalthai.com";
const PIN = "995777"; // dedicated, read-only fixture used by preceding green runs
const MAX_CLIENTS = 100;
const MAX_WAVES = 12;
const TIMEOUT_MS = 10000;
const PAUSE_MS = 3000;
const paperPath = "/api/paper/" + PIN;
const routes = [
  {path:paperPath,type:"paper"},
  {path:"/host",type:"html"},
  {path:"/paper/scan/" + PIN,type:"html"},
];

const percentile=(v,p)=>{
  if(!v.length)return null;
  const s=[...v].sort((a,b)=>a-b);
  return s[Math.max(0,Math.ceil(s.length*p)-1)];
};
const summarize=(records)=>{
  const lat=records.filter(r=>Number.isFinite(r.ms)).map(r=>r.ms);
  const passed=records.filter(r=>r.ok).length;
  return {
    requests:records.length,passed,failed:records.length-passed,
    successRate:Number((records.length?passed/records.length:0).toFixed(4)),
    p50Ms:percentile(lat,0.5),p95Ms:percentile(lat,0.95),p99Ms:percentile(lat,0.99),
    maxMs:lat.length?Math.max(...lat):null,
    byStatus:records.reduce((a,r)=>(a[String(r.status)]=(a[String(r.status)]||0)+1,a),{}),
    byRoute:Object.fromEntries([...new Set(records.map(r=>r.route))].map(route=>{
      const sub=records.filter(r=>r.route===route), l=sub.map(r=>r.ms);
      return [route,{requests:sub.length,passed:sub.filter(r=>r.ok).length,
        p95Ms:percentile(l,0.95),statuses:[...new Set(sub.map(r=>r.status))]}];
    })),
    failures:records.filter(r=>!r.ok).slice(0,6).map(r=>({route:r.route,status:r.status,error:r.error})),
  };
};

async function requestOne(base,route,client,wave){
  const t=performance.now(),controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch(base+route.path,{
      method:"GET",cache:"no-store",redirect:"manual",signal:controller.signal,
      headers:{"Accept":route.type==="paper"?"application/json":"text/html",
        "Cache-Control":"no-cache","X-ZoKivo-QA-ReadOnly":"1"}
    });
    const body=await response.text();
    let valid=false;
    if(route.type==="paper"){
      try {
        const x=JSON.parse(body);
        valid=x.pin===PIN && ["lobby","playing","finished"].includes(x.status)
          && Number.isInteger(x.index);
      }catch{}
    }else valid=body.includes("ZoKivo")&&!body.includes("Checking regional access");
    const ok=response.status===200&&valid;
    return {route:route.path,client,wave,status:response.status,ok,
      ms:Math.round(performance.now()-t),
      error:ok?null:response.status===200?"UNEXPECTED_BODY":"HTTP_"+response.status};
  }catch(error){
    return {route:route.path,client,wave,status:0,ok:false,
      ms:Math.round(performance.now()-t),
      error:error?.name==="AbortError"?"TIMEOUT":"NETWORK_ERROR"};
  }finally{clearTimeout(timeout)}
}

const start=performance.now();
const result={
  project:"ZoKivo",test:"bounded 100-client sustained read and dynamic DB",
  when:new Date().toISOString(),origin:DIRECT,customDomain:CUSTOM,
  concurrencyLevels:[25,50,100],maxClients:MAX_CLIENTS,maxWaves:MAX_WAVES,
  methodology:"Independent Node.js concurrent fetch clients on GitHub-hosted Linux runner",
  customDomain:null,preflight:null,stages:[],total:null,
  abortedEarly:false,abortReason:null,
  limitations:[
    "These are HTTP reader clients, not 100 authenticated players",
    "No simultaneous join, game writes, answer scoring, rewards, socket/realtime, or physical devices",
    "One GitHub-runner source IP, not 100 independent client geographies",
    "Fixture may expire; an invalid fixture is not a concurrency benchmark",
    "Passing cannot guarantee 100 real-player reliability or zero outages"
  ]
};
const all=[];
let failed=false;
try {
  result.customDomain=await requestOne(CUSTOM,{path:"/",type:"html"},0,0);
  console.log("Custom-domain gate:",JSON.stringify(result.customDomain));

  result.preflight=await requestOne(DIRECT,routes[0],0,0);
  console.log("Direct dynamic API preflight:",JSON.stringify(result.preflight));
  if(!result.preflight.ok){
    result.abortedEarly=true;result.abortReason="Dynamic fixture preflight failed; do not flood a nonworking endpoint";failed=true;
  } else {
    const stages=[
      {name:"ramp-25-database",clients:25,waves:1,pauseMs:0,mixed:false},
      {name:"ramp-50-database",clients:50,waves:1,pauseMs:0,mixed:false},
      {name:"mixed-100-clients",clients:100,waves:3,pauseMs:1000,mixed:true},
      {name:"sustained-100-database",clients:100,waves:12,pauseMs:PAUSE_MS,mixed:false},
    ];
    outer: for(const stage of stages){
      const measurements=[];
      for(let wave=1;wave<=stage.waves;wave++){
        const waveStart=performance.now();
        const oneWave=await Promise.all(Array.from({length:stage.clients},(_,idx)=>{
          const route=stage.mixed?routes[(idx+wave-1)%routes.length]:routes[0];
          return requestOne(DIRECT,route,idx+1,wave);
        }));
        measurements.push(...oneWave); all.push(...oneWave);
        const waveErrors=oneWave.filter(x=>!x.ok);
        const busy=oneWave.filter(x=>x.status===429||x.status===503||x.status===502);
        console.log(stage.name+" wave "+wave+": "+(oneWave.length-waveErrors.length)+"/"+oneWave.length+
          " passed, elapsed "+Math.round(performance.now()-waveStart)+" ms");
        // Avoid sustained traffic if the application is rate limiting / overloaded.
        if(busy.length>=3||waveErrors.length>oneWave.length*0.1){
          result.abortedEarly=true;failed=true;
          result.abortReason=stage.name+": elevated 429/502/503 or >10% errors";
          result.stages.push({name:stage.name,clients:stage.clients,plannedWaves:stage.waves,
            executedWaves:wave,stats:summarize(measurements)});
          break outer;
        }
        if(wave<stage.waves)await new Promise(done=>setTimeout(done,stage.pauseMs));
      }
      result.stages.push({name:stage.name,clients:stage.clients,plannedWaves:stage.waves,
        executedWaves:stage.waves,stats:summarize(measurements)});
      const stats=summarize(measurements);
      if(stats.failed||stats.p95Ms>8000)failed=true;
    }
  }
} catch(error){
  result.abortedEarly=true;failed=true;
  result.abortReason="TEST_RUNNER_ERROR";
  console.error(error?.message||"Unexpected test error");
} finally {
  result.total=summarize(all);
  result.elapsedMs=Math.round(performance.now()-start);
  result.publicDomainReady=!!result.customDomain?.ok;
  result.directReadBenchmarkPass=!failed&&result.total.requests>0;
  result.full100PlayerAcceptance=false;
  await writeFile("zokivo-load-v2.json",JSON.stringify(result,null,2)+"\n");
  console.log("LOAD_TEST_SUMMARY="+JSON.stringify(result));
}
if(!result.publicDomainReady)console.error("CUSTOM_DOMAIN_NOT_PUBLICLY_REACHABLE: location-gate response may prevent users and crawlers without verified access");
if(!result.directReadBenchmarkPass||!result.publicDomainReady)process.exitCode=1;
