/**
 * Low-volume, read-only OAuth redirect + Cloudflare diagnostics.
 * Exactly 3 ordinary GETs per official host, never follows OAuth redirects,
 * never submits credentials, and stops on the first 403 / 429.
 */
import {writeFile} from "node:fs/promises";
const hosts=["https://zokivo.xyz","https://zokivo.vynalthai.com","https://zokivo.vercel.app"];
const paths=["/auth/login","/api/auth/me","/api/auth/google?next=%2Fteacher"];
const report={at:new Date().toISOString(),test:"read-only Cloudflare / OAuth PKCE entry redirect diagnostic",
  scope:"Nine maximum public GET requests, serial and without cookies. No login, no test users, no production mutations.",
  checks:[],firstBlocked:null,limitations:[
    "Cannot inspect Cloudflare account rules, Security Events, or Supabase provider settings",
    "A successful 307 only verifies the OAuth start, never a signed-in Google account",
    "A 403/429 blocked upstream might not appear in Vercel function logs"
  ]};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const simple=(value)=>typeof value==="string"?value.slice(0,80):null;
let stop=false;
for(const host of hosts){
 if(stop)break;
 for(const path of paths){
  if(stop)break;
  let item={host,path,status:0,ray:null,mitigation:null,retryAfter:null,originReached:false,providerAuthorize:false,callbackSameHost:false};
  try{
   const res=await fetch(host+path,{method:"GET",cache:"no-store",redirect:"manual",
    headers:{Accept:"text/html,application/json"},signal:AbortSignal.timeout(12000)});
   item.status=res.status;item.ray=simple(res.headers.get("cf-ray"));
   item.mitigation=simple(res.headers.get("cf-mitigated"));
   item.retryAfter=simple(res.headers.get("retry-after"));
   item.originReached=!!res.headers.get("x-vercel-id");
   if(path.startsWith("/api/auth/google")&&res.status>=300&&res.status<400){
    const location=res.headers.get("location")||"";
    try{
     const target=new URL(location);
     item.providerAuthorize=target.protocol==="https:"&&target.pathname==="/auth/v1/authorize"&&target.searchParams.get("provider")==="google";
     const callback=target.searchParams.get("redirect_to")||"";
     item.callbackSameHost=callback===host+"/auth/callback";
    }catch{}
   }
  }catch(e){item.failure=e?.name==="TimeoutError"?"TIMEOUT":"NETWORK_ERROR"}
  report.checks.push(item);
  console.log("SAFE_EDGE_OAUTH_PROBE "+JSON.stringify(item));
  if([403,429].includes(item.status)){
   report.firstBlocked=item;
   stop=true;
  }
  if(item.failure)stop=true;
  await wait(250);
 }
}
report.completed=report.checks.length;
report.pass=!report.firstBlocked&&!report.checks.some(x=>x.failure)&&
 report.checks.length===hosts.length*paths.length&&
 report.checks.filter(x=>x.path.startsWith("/api/auth/google")).every(x=>x.providerAuthorize&&x.callbackSameHost);
await writeFile("zokivo-edge-oauth-smoke.json",JSON.stringify(report,null,2)+"\n");
console.log("SAFE_EDGE_OAUTH_RESULT "+JSON.stringify({pass:report.pass,completed:report.completed,blocked:!!report.firstBlocked,
 message:report.pass?"OAuth initiation only; full real login remains unverified":"Review Cloudflare Ray IDs, callback allowlists and hosting aliases"}));
if(!report.pass)process.exitCode=1;
