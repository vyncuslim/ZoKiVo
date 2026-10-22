const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const js=ts.transpileModule(fs.readFileSync("src/lib/realtime.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function("require","module","exports",js)(name=>
 name==="@/lib/edge-realtime-auth"?{edgeRealtimeUrl:()=>null,signEdgeNotify:()=>"mock"}:require(name),
 mod,mod.exports);
const rt=mod.exports;
process.env.ZOKIVO_SESSION_SECRET="test-only-secret-which-is-longer-than-32-characters";
process.env.ZOKIVO_SUPABASE_URL="https://zokivo-test.supabase.co";
process.env.ZOKIVO_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test-only";
process.env.ZOKIVO_SUPABASE_SECRET_KEY="sb_secret_test-only";
delete process.env.ZOKIVO_REALTIME_ENABLED;
let passed=0;function ok(value,name){assert.ok(value,name);passed++}
ok(rt.isRoomPin("123456"),"accept six digit PIN");
ok(!rt.isRoomPin("12345")&&!rt.isRoomPin("ABCDEF"),"reject bad PIN");
const a=rt.roomTopic("quiz","123456"),b=rt.roomTopic("quiz","123457"),c=rt.roomTopic("paper","123456");
ok(a.startsWith("zk-quiz-")&&a.length>30,"topic uses keyed secret hash");
ok(!a.includes("123456"),"topic does not expose PIN");
ok(a!==b&&a!==c,"room and mode isolation");
ok(rt.roomTopic("quiz","123456")===a,"topic deterministic");
const conf=rt.realtimeConfig();
ok(conf.origin==="https://zokivo-test.supabase.co","valid endpoint");
let captured=null;const originalFetch=global.fetch;
global.fetch=async (url,opts)=>{captured={url:String(url),opts};return new Response("",{status:202})};
(async()=>{
 try{
  ok(await rt.emitRoomRefresh("quiz","123456")===true,"broadcast acknowledged");
  ok(captured.url.includes("/realtime/v1/api/broadcast/"+a+"/events/refresh"),"official REST endpoint");
  ok(captured.opts.headers.apikey==="sb_secret_test-only","server-only secret");
  ok(captured.opts.method==="POST","server-only POST");
  ok(JSON.stringify(JSON.parse(captured.opts.body))==='{"v":1}',"no PII, score, PIN or answer in payload");
  captured=null;process.env.ZOKIVO_REALTIME_ENABLED="false";
  ok(await rt.emitRoomRefresh("quiz","123456")===false&&captured===null,"disabled bridge sends nothing");
  process.env.ZOKIVO_REALTIME_ENABLED="true";
  process.env.ZOKIVO_SUPABASE_URL="http://untrusted.example";
  ok(rt.realtimeConfig()===null,"reject non-HTTPS provider URL");
  process.env.ZOKIVO_SUPABASE_URL="https://wrong-origin.example";
  ok(rt.realtimeConfig()===null,"reject invalid provider origin");
  process.env.ZOKIVO_SUPABASE_URL="https://zokivo-test.supabase.co";
  global.fetch=async()=>new Response("unavailable",{status:503});
  ok(await rt.emitRoomRefresh("paper","123456")===false,"Broadcast failure does not break game");
  console.log("REALTIME_BRIDGE_TEST_PASS: "+passed+" assertions; no live credentials or network.");
 }finally{global.fetch=originalFetch}
})().catch(e=>{console.error("REALTIME_BRIDGE_TEST_FAILED",e.stack||e);process.exitCode=1});
