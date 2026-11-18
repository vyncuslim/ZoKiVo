// Mocked host recovery contract. Does not access real Neon, Vercel or Supabase.
const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const raw=fs.readFileSync("src/app/api/rooms/[pin]/recover-host/route.ts","utf8");
const js=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const responses=[];
const dbState={owner:"original-host",status:"playing",ageHours:50,previousHash:"old-hash",updates:0};
let user={id:"original-host",email_confirmed_at:"2026-01-01T00:00:00Z"};
let seq=0;
function failIfCrossOrigin(req){
 if(req.headers.get("origin")!==new URL(req.url).origin)throw Object.assign(new Error("Invalid request origin."),{status:403});
}
const noCache=(obj,status=200)=>Response.json(obj,{status,headers:{"Cache-Control":"no-store"}});
const store={
 token:()=>("test-cryptographic-token-"+(++seq)),
 hash:s=>"sha256-"+s,
 db:()=>async(strings,...args)=>{
  const text=strings.join("?");
  assert(text.includes("UPDATE rooms SET host_token_hash="));
  assert(text.includes("AND status='playing' AND deadline IS NOT NULL"));
  assert(text.includes("deadline<now()-interval '24 hours'"));
  const [newHash,pin,owner]=args;
  if(pin==="123456"&&owner===dbState.owner&&dbState.status==="playing"&&dbState.ageHours>24){
   dbState.updates++;dbState.previousHash=newHash;return [{pin}];
  }
  return [];
 }
};
const mocks={
 "@/lib/store":store,
 "@/lib/mother-auth":{checkOrigin:failIfCrossOrigin,findUser:async()=>({user}),noCache,authError:e=>noCache({error:e.message},e.status||503),applyRenew:r=>r}
};
const mod={exports:{}};
new Function("require","module","exports",js)((p)=>Object.prototype.hasOwnProperty.call(mocks,p)?mocks[p]:require(p),mod,mod.exports);
const post=(pin="123456",origin="https://zokivo.test")=>mod.exports.POST(new Request("https://zokivo.test/api/rooms/"+pin+"/recover-host",{method:"POST",headers:{origin,"content-type":"application/json"},body:"{}"}),{params:Promise.resolve({pin})});
async function main(){
 let r=await post();assert.equal(r.status,200);
 const j=await r.json();
 assert(j.hostToken.startsWith("test-cryptographic-token-"));
 assert.equal(dbState.previousHash,"sha256-"+j.hostToken);
 assert.equal(r.headers.get("Cache-Control"),"no-store");
 assert.equal(dbState.updates,1);
 const originalHash=dbState.previousHash;
 user={id:"wrong-user",email_confirmed_at:"2026-01-01T00:00:00Z"};
 assert.equal((await post()).status,409,"Wrong account is denied");assert.equal(dbState.previousHash,originalHash);
 user={id:"original-host",email_confirmed_at:null};
 assert.equal((await post()).status,403,"Unverified account is denied");assert.equal(dbState.previousHash,originalHash);
 user=null;
 assert.equal((await post()).status,401,"Unauthenticated visitor is denied");
 user={id:"original-host",email_confirmed_at:"2026-01-01T00:00:00Z"};
 assert.equal((await post("123456","https://evil.invalid")).status,403,"CSRF is denied");
 assert.equal((await post("not-a-pin")).status,400,"Invalid PIN is denied");
 dbState.ageHours=23;
 assert.equal((await post()).status,409,"Recently expired live game is denied");
 dbState.ageHours=50;dbState.status="finished";
 assert.equal((await post()).status,409,"Completed game is denied");
 dbState.status="playing";
 assert.equal((await post("654321")).status,409,"Guessing another PIN does not reveal host access");
 assert.equal(dbState.updates,1,"Denials never modify saved room state");
 console.log("ZOKIVO_RECOVER_HOST_MOCK_PASS: owner-only, email verified, age gated, origin checked, no room status changes.");
}
main().catch(e=>{console.error("ZOKIVO_RECOVER_HOST_MOCK_FAILED",e);process.exitCode=1});
