import {writeFile} from "node:fs/promises";
const base="https://zokivo.vynalthai.com",maxWaves=9,waveSize=25;
const report={test:"bounded official-domain game API read-only rate limit diagnostics",
 at:new Date().toISOString(),maxRequests:maxWaves*waveSize,waveSize,waves:[],firstBlocked:null,
 limitations:["One GitHub runner source IP","GET only, no scoring or player writes","Does not prove a particular security rule without vendor event logs"]};
async function call(path,{method="GET",cookie,payload}={}){
 const controller=new AbortController(),clock=setTimeout(()=>controller.abort(),12000);
 const began=performance.now();
 try{
  const r=await fetch(base+path,{method,redirect:"manual",cache:"no-store",signal:controller.signal,
   headers:{Accept:"application/json",...(payload?{"Content-Type":"application/json",Origin:base,"Sec-Fetch-Site":"same-origin"}:{}),...(cookie?{Cookie:cookie}:{})},body:payload?JSON.stringify(payload):undefined});
  const raw=await r.text();
  return {status:r.status,ms:Math.round(performance.now()-began),
   server:r.headers.get("server"),edge:r.headers.get("x-vynalth-edge"),
   ray:!!r.headers.get("cf-ray"),mitigated:r.headers.get("cf-mitigated"),
   retryAfter:r.headers.get("retry-after"),vercel:!!r.headers.get("x-vercel-id"),
   contentType:r.headers.get("content-type"),
   bodyType:/error.*REGIONAL_CHECK_REQUIRED/.test(raw)?"regional-check":
     /too many requests|rate limit/i.test(raw)?"rate-limit-text":
     /cloudflare/i.test(raw)?"cloudflare-page":
     raw.includes("Unauthorized")?"unauthorized":"other",
   cookie:r.headers.get("set-cookie")?.split(";")[0]||null,
   body:raw.slice(0,140)};
 }catch(e){return{status:0,ms:Math.round(performance.now()-began),error:e?.name==="AbortError"?"timeout":"network_error"}}
 finally{clearTimeout(clock)}
}
const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
const r=await call("/__shield/gps/region-check",{method:"POST",payload:{timezone:tz}});
const cookie=r.cookie;
report.handshake={status:r.status,gpsRequired:/gpsRequired":true/.test(r.body),hasCookie:!!cookie};
if(r.status===200&&cookie?.startsWith("__Host-vynalth-region=")){
 for(let wave=1;wave<=maxWaves;wave++){
  const rows=await Promise.all(Array.from({length:waveSize},()=>call("/api/rooms/967651",{cookie})));
  const statuses=Object.fromEntries([...new Set(rows.map(x=>x.status))].map(st=>[st,rows.filter(x=>x.status===st).length]));
  report.waves.push({wave,statuses,p95Ms:rows.map(x=>x.ms).sort((a,b)=>a-b)[Math.ceil(rows.length*.95)-1]});
  console.log("RATE_WAVE="+JSON.stringify(report.waves.at(-1)));
  const blocked=rows.find(x=>x.status===429||x.status===403||x.status===503);
  if(blocked){
   const {cookie:secretCookie,body,...safe}=blocked;
   report.firstBlocked={wave,...safe}; console.log("RATE_BLOCK="+JSON.stringify(report.firstBlocked));
   break;
  }
  await new Promise(x=>setTimeout(x,500));
 }
}else report.error="Unable to establish allowed regional visitor context";
await writeFile("zokivo-rate-limit-diagnostics.json",JSON.stringify(report,null,2)+"\n");
console.log("RATE_DIAGNOSTICS="+JSON.stringify(report));
