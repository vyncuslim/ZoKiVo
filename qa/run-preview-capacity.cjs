/* Isolated Vercel Preview build-time HTTP load check.
 * Never sends SQL credentials or QA session secrets outside the same build process.
 * Never runs on the Production branch/environment.
 */
const {neon}=require("@neondatabase/serverless");
const {randomBytes}=require("node:crypto");
const {spawn}=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");

const branch="qa/room-state-1000-fast-path-20261022";
const qaMarker="exclusive-qa-1000-20261020";
const url=process.env.DATABASE_URL||"";
const inPreview=process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF===branch;
if(!inPreview)throw Error("QA guard: refused outside the exact designated Preview branch");
if(!/^postgres(?:ql)?:\/\//.test(url))throw Error("QA requires existing Vercel Preview Neon connection");
const dbHost=new URL(url).hostname;
if(!dbHost.endsWith(".neon.tech"))throw Error("QA guard: non-Neon connection rejected");
// Verify the private guard marker exists only in this dedicated Preview branch.
// No writes are made before this test succeeds.
async function qaGuard(){
 const sql=neon(url);
 const rows=await sql.query("SELECT marker FROM public.zokivo_qa_sandbox_guard WHERE marker=$1",[qaMarker]);
 if(rows.length!==1)throw Error("QA guard marker absent: refusing any load test");
 console.log("QA_ISOLATED_NEON_GUARD_PASS");
}
const env={...process.env,
 ZOKIVO_SESSION_SECRET:randomBytes(48).toString("hex"),
 ZOKIVO_QA_CONFIRM:"BRANCH_ONLY_1000",
 ZOKIVO_REALTIME_ENABLED:"false",
 ZOKIVO_NEON_REALTIME_ENABLED:"false",
 NEXT_TELEMETRY_DISABLED:"1"
};
function bootServer(){
 const cli=path.join(process.cwd(),"node_modules","next","dist","bin","next");
 const server=spawn(process.execPath,[cli,"start","-p","3000","-H","127.0.0.1"],
  {env,stdio:["ignore","pipe","pipe"]});
 let errors="";
 for(const stream of [server.stdout,server.stderr])stream.on("data",data=>{
  // Intentionally do not echo runtime environment or configuration values.
  const message=data.toString();
  if(/Error|EADDRINUSE|failed/i.test(message))errors+=message.slice(0,500);
 });
 return {server,errors:()=>errors};
}
async function waitReady(server){
 const start=Date.now();
 while(Date.now()-start<30000){
  if(server.exitCode!==null)throw Error("QA Next server exited unexpectedly");
  try{
   const response=await fetch("http://127.0.0.1:3000/",{signal:AbortSignal.timeout(2000)});
   if(response.status===200){console.log("QA_LOCAL_NEXT_SERVER_READY");return}
  }catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 throw Error("QA Next server did not become ready in 30 seconds");
}
async function runLoad(){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,["qa/staged-real-1000.cjs"],{cwd:process.cwd(),env,stdio:["ignore","pipe","pipe"]});
  const markerLines=[];
  for(const stream of [child.stdout,child.stderr]){
   let tail="";
   stream.on("data",chunk=>{
    tail+=chunk.toString();
    const parts=tail.split(/\r?\n/);
    tail=parts.pop()||"";
    for(const line of parts)if(/^(QA_|.*QA_FATAL)/.test(line)){
     const truncated=line.slice(0,4000);markerLines.push(truncated);console.log(truncated);
    }
   });
  }
  const timeout=setTimeout(()=>{child.kill("SIGKILL");reject(Error("QA runner exceeded 210s hard stop"))},210000);
  child.once("error",e=>{clearTimeout(timeout);reject(e)});
  child.once("exit",(code,signal)=>{clearTimeout(timeout);if(code===0)resolve();else reject(Error("QA real HTTP load rejected: code="+code+", signal="+signal))});
 });
}
async function main(){
 await qaGuard();
 const {server,errors}=bootServer();
 try{
  await waitReady(server);
  await runLoad();
  console.log("QA_PREVIEW_REAL_HTTP_LOAD_GATE_PASS");
 }finally{
  server.kill("SIGTERM");
  await new Promise(resolve=>{if(server.exitCode!==null)resolve();else{server.once("exit",resolve);setTimeout(resolve,2500)}});
 }
}
main().catch(e=>{console.error("QA_PREVIEW_LOAD_FAILED:",e.message);process.exitCode=1});
