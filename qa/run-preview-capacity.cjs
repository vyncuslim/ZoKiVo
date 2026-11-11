/* Isolated Vercel Preview build-time HTTP load check.
 * Never sends SQL credentials or QA session secrets outside the same build process.
 * Never runs on the Production branch/environment.
 */
const {neon}=require("@neondatabase/serverless");
const {randomBytes}=require("node:crypto");
const {spawn}=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");

const branch="qa/four-origin-instant-burst-20261022";
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
// Up to four independent Next.js processes; same isolated QA DB, same test secret.
const ports=[3000,3001,3002,3003];
env.ZOKIVO_QA_LOCAL_ORIGINS=String(ports.length);
function bootServers(){
 const cli=path.join(process.cwd(),"node_modules","next","dist","bin","next");
 return ports.map(port=>{
  const server=spawn(process.execPath,[cli,"start","-p",String(port),"-H","127.0.0.1"],
   {env,stdio:["ignore","pipe","pipe"]});
  let errors="";
  for(const stream of [server.stdout,server.stderr])stream.on("data",data=>{
   if(/Error|EADDRINUSE|failed/i.test(data.toString()))errors+=data.toString().slice(0,450);
  });
  return {port,server,errors:()=>errors};
 });
}
async function waitReadyOne(instance){
 const start=Date.now();
 while(Date.now()-start<45000){
  if(instance.server.exitCode!==null)throw Error("QA server exited early on port "+instance.port+": "+instance.errors());
  try{
   const response=await fetch("http://127.0.0.1:"+instance.port+"/",{signal:AbortSignal.timeout(1800)});
   if(response.status===200)return;
  }catch{}
  await new Promise(r=>setTimeout(r,350));
 }
 throw Error("QA origin did not become ready on port "+instance.port);
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
 const instances=bootServers();
 try{
  await Promise.all(instances.map(waitReadyOne));
  console.log("QA_FOUR_ORIGINS_READY",{localProcesses:4,dbGuardVerified:true});
  await runLoad();
  console.log("QA_FOUR_ORIGIN_CAPACITY_GATE_PASS");
 }finally{
  await Promise.all(instances.map(({server})=>new Promise(resolve=>{
   if(server.exitCode!==null)return resolve();
   const stop=setTimeout(()=>{server.kill("SIGKILL");resolve()},2600);
   server.once("exit",()=>{clearTimeout(stop);resolve()});
   server.kill("SIGTERM");
  })));
 }
}
main().catch(e=>{console.error("QA_PREVIEW_LOAD_FAILED:",e.message);process.exitCode=1});
