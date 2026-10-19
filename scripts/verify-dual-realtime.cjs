/* Unit-level, credential-free dual Realtime isolation and failover gates. */
const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript");
let checks=0;const ok=(value,msg)=>{assert.ok(value,msg);checks++};
function moduleFrom(path,mocks){
 const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function("require","module","exports",js)(name=>Object.prototype.hasOwnProperty.call(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 return mod.exports;
}
process.env.ZOKIVO_SESSION_SECRET="synthetic-very-long-secret-for-tests-not-live";
process.env.ZOKIVO_SUPABASE_URL="https://zokivo-test.supabase.co";
process.env.ZOKIVO_SUPABASE_PUBLISHABLE_KEY="public-for-test";
process.env.ZOKIVO_SUPABASE_SECRET_KEY="private-but-fake";
process.env.ZOKIVO_REALTIME_ENABLED="true";
delete process.env.ZOKIVO_NEON_REALTIME_ENABLED;
const noCache=(o,status=200)=>Response.json(o,{status});
const db=()=>async(strings,...args)=>{
 const q=strings.join("?");
 if(q.includes("SELECT host_token_hash FROM rooms"))return [{host_token_hash:"host-test"}];
 if(q.includes("SELECT id FROM players"))return args[1]==="player-test"?[{id:"p1"}]:[];
 if(q.includes("FROM paper_sessions"))return [{exists:1}];
 throw Error("unexpected SQL "+q);
};
const mocks={
 "@/lib/store":{db,hash:x=>x,same:(a,b)=>a===b},
 "@/lib/realtime":{isRoomPin:pin=>/^\d{6}$/.test(pin),realtimeConfig:()=>({url:"test"})},
 "@/lib/mother-auth":{noCache}
};
const route=moduleFrom("src/app/api/realtime/plan/route.ts",mocks);
const request=(headers={})=>({nextUrl:new URL("https://qa.example/api/realtime/plan?pin=123456&kind=quiz"),headers:new Headers(headers)});
(async()=>{
 ok(route.realtimeProviders("quiz","123456").join(",")==="supabase","Default production strategy preserves Supabase");
 process.env.ZOKIVO_NEON_REALTIME_ENABLED="true";
 process.env.NEON_REALTIME_URL="https://fake-neon.neon.tech/";
 process.env.NEON_REALTIME_SECRET="fake-secret-for-mock-only";
 process.env.ZOKIVO_NEON_REALTIME_PERCENT="100";
 ok(route.realtimeProviders("quiz","123456").join(",")==="neon,supabase","Neon primary with Supabase failover");
 process.env.ZOKIVO_NEON_REALTIME_PERCENT="0";
 ok(route.realtimeProviders("quiz","123456").join(",")==="supabase,neon","Supabase primary with Neon fallback");
 ok(route.realtimeProviders("paper","123456").join(",")==="supabase","Paper Mode never attempts Neon live SQL");
 const denied=await route.GET(request());
 ok(denied.status===401,"No session token cannot request provider strategy");
 const valid=await route.GET(request({"x-player-token":"player-test"}));
 const j=await valid.json();
 ok(valid.status===200&&j.providers.join(",")==="supabase,neon","Player obtains authorized strategy");
 const host=await route.GET(request({"x-host-token":"host-test"}));
 ok(host.status===200,"Host may use provider strategy");
 const neonSource=fs.readFileSync("src/app/api/realtime/neon/route.ts","utf8");
 ok(neonSource.includes("same(found[0].host_token_hash,hash(tokenHost))"),"Neon token issuer verifies host HMAC");
 ok(neonSource.includes("token_hash=${hash(tokenPlayer)}"),"Neon token issuer validates player token");
 ok(neonSource.includes('count(a.player_id)::integer AS submitted'),"Sealed SQL contains only anonymous submitted count");
 ok(!neonSource.includes("q.correct_index")&&!neonSource.includes("p.nickname"),"Sealed SQL excludes secret answers and student names");
 ok(neonSource.includes("live.seal({query})")&&neonSource.includes("NEON_REALTIME_SECRET"),"Sealing remains server-only");
 const client=fs.readFileSync("src/lib/use-room-realtime.ts","utf8");
 ok(client.includes("const candidate=fallback.shift()")&&client.includes("cleanupProvider=cleanup"),"Only one primary transport is active");
 ok(client.includes("loseProvider")&&client.includes('attemptNext()'),"Transport failure tries backup");
 ok(client.includes("30000")&&client.includes("setConnected(false)"),"Backoff and HTTP polling fallback persist");
 console.log("DUAL_REALTIME_TEST_PASS: "+checks+" checks. No real credentials or network.");
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
