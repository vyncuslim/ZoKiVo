/**
 * Read-only, bounded production HTTP sampling.
 * 64 logical samples, at most 2 inflight (bounded redirect follows), no game writes.
 * Measures vantage point of GitHub Actions (normally U.S.), NOT Malaysia or 1,000 players.
 * Follows redirects only to explicitly allowed ZoKivo hostnames; no credentials.
 */
const https=require("node:https");
const {performance}=require("node:perf_hooks");
const fs=require("node:fs");
const hosts=["zokivo.xyz","zokivo.vynalthai.com"];
const routes=[
 {path:"/",label:"homepage",expected:[200]},
 {path:"/play",label:"play_page",expected:[200]},
 {path:"/games",label:"games_page",expected:[200]},
 {path:"/api/rooms/000000",label:"db_room_lookup",expected:[404]}
];
const samples=8, timeout=9000;
const allowedRedirectHosts=new Set([...hosts,"www.zokivo.xyz","zokivo.vercel.app"]);
function singleRequest(url){
 return new Promise(resolve=>{
  const t=performance.now();let size=0,done=false,firstByte=null;
  const settle=(x)=>{if(done)return;done=true;resolve({ms:Math.round(performance.now()-t),ttfbMs:firstByte===null?null:Math.round(firstByte),bytes:size,...x})};
  const req=https.get(url,{headers:{"User-Agent":"ZoKivo-Owner-QA-Bounded/1.0","Accept":"text/html,application/json","Cache-Control":"no-store"},timeout},res=>{
   firstByte=performance.now()-t;
   res.on("data",part=>{size+=part.length;if(size>1100000)req.destroy(new Error("Response exceeds 1.1MB"))});
   res.once("end",()=>settle({httpStatus:res.statusCode,location:res.headers.location||null,cfCache:res.headers["cf-cache-status"]||null,vercelCache:res.headers["x-vercel-cache"]||null}));
   res.once("error",e=>settle({error:e.code||e.message}));
  });
  req.once("timeout",()=>req.destroy(new Error("9s timeout")));
  req.once("error",e=>settle({error:e.code||e.message}));
 });
}
async function one(host,route){
 const started=performance.now(),visited=[];
 let target=new URL("https://"+host+route.path);
 for(let hop=0;hop<4;hop++){
  const part=await singleRequest(target);
  const elapsed=Math.round(performance.now()-started);
  if(part.error)return {host,route:route.label,ms:elapsed,ttfbMs:null,ok:false,error:part.error,redirects:visited.length};
  if([301,302,307,308].includes(part.httpStatus)&&part.location){
   visited.push({from:target.hostname,to:part.location,status:part.httpStatus});
   const next=new URL(part.location,target);
   if(next.protocol!=="https:"||!allowedRedirectHosts.has(next.hostname)||next.username||next.password)
    return {host,route:route.label,ms:elapsed,ttfbMs:null,ok:false,httpStatus:part.httpStatus,externalRedirect:next.hostname,redirects:visited.length};
   target=next;
   continue;
  }
  return {host,route:route.label,ms:elapsed,ttfbMs:elapsed-(part.ms-(part.ttfbMs??part.ms)),bytes:part.bytes,finalHost:target.hostname,finalPath:target.pathname,redirects:visited.length,
   httpStatus:part.httpStatus,ok:route.expected.includes(part.httpStatus),cfCache:part.cfCache,vercelCache:part.vercelCache};
 }
 return {host,route:route.label,ms:Math.round(performance.now()-started),ttfbMs:null,ok:false,error:"Too many redirects",redirects:visited.length};
}
const pct=(x,q)=>x.length?x[Math.max(0,Math.min(x.length-1,Math.ceil(q*x.length)-1))]:null;
async function main(){
 const tasks=[];
 for(const host of hosts)for(const route of routes)for(let i=0;i<samples;i++)tasks.push({host,route});
 const results=[];
 const workers=Array.from({length:2},async()=>{
  while(tasks.length){
   const job=tasks.shift();if(!job)return;
   results.push(await one(job.host,job.route));
   await new Promise(r=>setTimeout(r,180));
  }
 });
 await Promise.all(workers);
 const summary=[];
 for(const host of hosts)for(const route of routes){
  const relevant=results.filter(r=>r.host===host&&r.route===route.label);
  const ok=relevant.filter(r=>r.ok);const lat=ok.map(r=>r.ms).sort((a,b)=>a-b);
  const ttfb=ok.map(r=>r.ttfbMs).filter(Number.isFinite).sort((a,b)=>a-b);
  summary.push({host,path:route.path,samples:relevant.length,success:ok.length,
   p50Ms:pct(lat,.5),p90Ms:pct(lat,.9),p95Ms:pct(lat,.95),maxMs:lat.at(-1)||null,
   p95TtfbMs:pct(ttfb,.95),statuses:relevant.reduce((acc,r)=>{const k=String(r.httpStatus||r.error);acc[k]=(acc[k]||0)+1;return acc},{}),
   redirectCounts:relevant.reduce((acc,r)=>{const k=String(r.redirects||0);acc[k]=(acc[k]||0)+1;return acc},{}),
   finalHosts:[...new Set(relevant.map(r=>r.finalHost).filter(Boolean))],
   cfCache:[...new Set(relevant.map(r=>r.cfCache).filter(Boolean))].join(",")});
 }
 const output={testedAt:new Date().toISOString(),vantage:"GitHub Actions hosted runner (not Malaysia)",
  requestCount:results.length,maximumConcurrency:2,method:"GET only",scope:"public routes + nonexistent game PIN",
  summary,failures:results.filter(r=>!r.ok)};
 console.log("ZOKIVO_REAL_HTTP_LATENCY_RESULTS="+JSON.stringify(output));
 const md=["# ZoKivo bounded live HTTP sampling","","Vantage: GitHub-hosted runner outside Malaysia. 64 logical GET samples, two concurrent maximum; follows only allowlisted ZoKivo redirects; no gameplay sessions or score writes.","","| Host | Route | Success | P50 | P95 | Max | HTTP status |","|---|---|---:|---:|---:|---:|---|"];
 for(const x of summary)md.push(`| ${x.host} | ${x.path} | ${x.success}/${x.samples} | ${x.p50Ms??"-"} ms | ${x.p95Ms??"-"} ms | ${x.maxMs??"-"} ms | ${JSON.stringify(x.statuses)} |`);
 md.push("","**Limitations:** no logged-in game API, WebSocket measurement, browser rendering, mobile/Malaysia connection, or 1,000-player concurrent capacity. Nonexistent room check measures API error-path, not a full scored game.");
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md.join("\n")+"\n");
 fs.mkdirSync("/tmp/zokivo-qa",{recursive:true});
 fs.writeFileSync("/tmp/zokivo-qa/latency.json",JSON.stringify(output,null,2));
 // Report HTTP 429, 5xx and >=20% unexpected statuses as clear failures.
 if(results.some(r=>r.httpStatus===429||r.httpStatus>=500)||results.filter(r=>!r.ok).length>results.length*.2)process.exitCode=1;
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
