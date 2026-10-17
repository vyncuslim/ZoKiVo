import {writeFile} from "node:fs/promises";
const BASE="https://zokivo.vynalthai.com";
const paths=["/","/games","/play","/api/paper/status"];
const out={test:"official host normal region/timezone verification",at:new Date().toISOString(),before:null,verification:null,after:[],pass:false};
const signal=AbortSignal.timeout(12000);
const get=async(path,cookie)=>{const r=await fetch(BASE+path,{redirect:"manual",signal,
 headers:{Accept:path.startsWith("/api")?"application/json":"text/html",...(cookie?{Cookie:cookie}:{})}});
 const raw=await r.text();return {status:r.status,body:raw,edge:r.headers.get("x-vynalth-edge"),
 headers:r.headers};};
try{
 const before=await get("/");
 out.before={status:before.status,regionScreen:/Checking regional access/i.test(before.body)};
 const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
 const response=await fetch(BASE+"/__shield/gps/region-check",{
   method:"POST",redirect:"manual",signal,
   headers:{"Origin":BASE,"Sec-Fetch-Site":"same-origin","Content-Type":"application/json",
     "Accept":"application/json"},body:JSON.stringify({timezone:tz})});
 const obj=await response.json().catch(()=>({}));
 const cookie=response.headers.get("set-cookie")?.split(";")[0]||"";
 const validCookie=cookie.startsWith("__Host-vynalth-region=");
 out.verification={status:response.status,gpsRequired:obj.gpsRequired??null,
  checked:obj.checked??false,hasRegionCookie:validCookie,timezone:tz};
 if(response.status===200&&validCookie&&obj.checked){
  for(const path of paths){
   const res=await get(path,cookie);
   const regional=/Checking regional access|REGIONAL_CHECK_REQUIRED|Access currently unavailable/i.test(res.body);
   const matches=path.startsWith("/api")?
     (()=>{try{return typeof JSON.parse(res.body).enabled==="boolean"}catch{return false}})():
     /ZoKivo/i.test(res.body) && !regional;
   out.after.push({path,status:res.status,regional,appContent:matches,
     cfWorker:res.edge==="cloudflare-worker"});
  }
 }
 out.pass=out.verification.gpsRequired===false && out.after.length===paths.length &&
   out.after.every(x=>x.status===200&&x.appContent);
}catch(e){out.error=e?.name==="TimeoutError"?"TIMEOUT":String(e?.message||e).slice(0,140);}
await writeFile("zokivo-official-domain-verification.json",JSON.stringify(out,null,2)+"\n");
console.log("DOMAIN_SESSION_RESULT="+JSON.stringify(out));
if(!out.pass)process.exitCode=1;
