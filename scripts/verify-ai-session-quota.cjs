// Mocked AI-session quota/refund contract. No real ElevenLabs or database calls.
const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const raw=fs.readFileSync("src/app/api/ai/voice/session/route.ts","utf8");
const js=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const noCache=(obj,status=200)=>Response.json(obj,{status});
let records=new Map(),idSeq=0,providerCalls=0;
const db=()=>async(strings,...args)=>{
 const sql=strings.join("?");
 if(sql.includes("INSERT INTO ai_session_requests")){
  if(records.size>=10)return [];
  const id="11111111-1111-4111-8111-"+String(++idSeq).padStart(12,"0");
  records.set(id,"reserved");return [{id}];
 }
 if(sql.includes("UPDATE ai_session_requests")){
  const id=String(args[0]);if(records.get(id)!=="reserved")return [];
  records.set(id,"issued");return [{id}];
 }
 if(sql.includes("DELETE FROM ai_session_requests")){
  const id=String(args[0]);if(records.get(id)==="reserved")records.delete(id);return [];
 }
 throw Error("Unexpected mock SQL");
};
const mocks={
 "@/lib/store":{db},
 "@/lib/quizzes":{authUser:async()=>({user:{id:"qa-user",email_confirmed_at:true},renew:null})},
 "@/lib/mother-auth":{checkOrigin:()=>{},noCache,authError:e=>noCache({error:e.message},e.status||503),applyRenew:r=>r}
};
const mod={exports:{}};
new Function("require","module","exports",js)(name=>Object.prototype.hasOwnProperty.call(mocks,name)?mocks[name]:require(name),mod,mod.exports);
const prevFetch=globalThis.fetch;
const envKeys=["ZOKIVO_AI_ENABLED","ELEVENLABS_API_KEY","ELEVENLABS_AGENT_ID"];
const prev=Object.fromEntries(envKeys.map(x=>[x,process.env[x]]));
process.env.ZOKIVO_AI_ENABLED="true";process.env.ELEVENLABS_API_KEY="qa-fake-key";process.env.ELEVENLABS_AGENT_ID="agent_QA_mock";
const req=()=>new Request("https://zokivo.test/api/ai/voice/session",{method:"POST",headers:{origin:"https://zokivo.test"}});
async function main(){
 globalThis.fetch=async()=>{providerCalls++;return Response.json({signed_url:"wss://api.elevenlabs.io/v1/convai/conversation"})};
 const many=await Promise.all(Array.from({length:12},()=>mod.exports.POST(req())));
 assert.equal(many.filter(r=>r.status===200).length,10);
 assert.equal(many.filter(r=>r.status===429).length,2);
 assert.equal(providerCalls,10,"No provider access for over-quota requests");
 records.clear();
 globalThis.fetch=async()=>{throw Error("QA only: provider down")};
 assert.equal((await mod.exports.POST(req())).status,503);
 assert.equal(records.size,0,"Failed network request releases reservation");
 globalThis.fetch=async()=>Response.json({signed_url:"wss://api.elevenlabs.io.evil.example/path"});
 assert.equal((await mod.exports.POST(req())).status,503);
 assert.equal(records.size,0,"Spoofed provider host does not count");
 globalThis.fetch=async()=>new Response("unavailable",{status:503});
 assert.equal((await mod.exports.POST(req())).status,503);
 assert.equal(records.size,0,"Provider 503 does not count");
 globalThis.fetch=async()=>Response.json({signed_url:"wss://api.elevenlabs.io/v1/convai/conversation"});
 assert.equal((await mod.exports.POST(req())).status,200);
 assert.equal(records.size,1,"Successful provider response counts exactly once");
 console.log("ZOKIVO_AI_QUOTA_MOCK_PASS: 10 success, 2 over-quota, network/HTTP/host failures refunded.");
}
main().catch(e=>{console.error("ZOKIVO_AI_QUOTA_MOCK_FAILED",e);process.exitCode=1}).finally(()=>{
 globalThis.fetch=prevFetch;for(const k of envKeys){if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k]}
});
