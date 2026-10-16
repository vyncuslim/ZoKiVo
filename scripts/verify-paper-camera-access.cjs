const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const page=fs.readFileSync("src/app/paper/scan/[pin]/page.tsx","utf8");
const state=fs.readFileSync("src/app/api/paper/[pin]/route.ts","utf8");
const advance=fs.readFileSync("src/app/api/paper/[pin]/advance/route.ts","utf8");
const submit=fs.readFileSync("src/app/api/paper/[pin]/submit/route.ts","utf8");
let count=0;function ok(v,msg){assert.ok(v,msg);count++}
function reject(fn,msg){assert.throws(fn,undefined,msg);count++}
ok(page.includes("navigator.mediaDevices.getUserMedia"),"Native camera API is invoked from explicit click handler");
ok(page.includes('onClick={()=>void startCamera()}'),"Camera button calls startCamera");
ok(page.includes("cameraRequesting"),"Permission request provides pending UI state");
ok(page.includes('window.isSecureContext'),"HTTPS preflight");
ok(page.includes("NotAllowedError")&&page.includes("NotFoundError")&&page.includes("NotReadableError"),"Camera errors distinguish permission / device / busy");
ok(page.includes('session.status==="finished"'),"Camera unavailable when session finished");
ok(!page.includes('disabled={cameraActive||session.status!=="playing"}'),"Camera access no longer gated to live question");
ok(page.includes('cameraGeneration.current'),"Async permission result stops late streams");
ok(page.includes("getTracks().forEach(t=>t.stop())"),"Camera tracks released");
ok(page.includes("Sign in with the original Vynalth AI account"),"Cross-device signed-in host guidance");
ok(state.includes("owner_user_id")&&state.includes("findUser(req)"),"Paper scanner reads original host identity");
ok(state.includes("verifiedOwner||legacyHost"),"Owner can restore access on another device");
ok(advance.includes("owner_user_id!==auth.user.id")&&submit.includes("owner_user_id!==auth.user.id"),"Only original host can control or submit");
ok(advance.includes("checkOrigin(req)")&&submit.includes("checkOrigin(req)"),"Mutations check request origin");
const out=ts.transpileModule(state,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let currentUser=null,ownerId="teacher-1";
const db=()=>async(strings)=>{const q=strings.join("?");if(q.includes("SELECT pin,quiz_set_id,status"))return [{pin:"995777",quiz_set_id:"test",status:"playing",current_index:0,host_token_hash:"original-token",owner_user_id:ownerId}];if(q.includes("SELECT question,choices"))return [{question:"Example question",choices:["A","B","C","D"]}];if(q.includes("count(*)"))return [{count:4}];if(q.includes("SELECT card_source"))return [{card_source:"zokivo",card_number:1,score:100,submitted:1}];throw Error("Unknown query: "+q)};
const bad=(x,s=400)=>Response.json({error:x},{status:s});
const mod={exports:{}};
new Function("require","module","exports",out)((name)=>name==="@/lib/store"?{db,hash:x=>x,same:(x,y)=>x===y,bad}:name==="@/lib/mother-auth"?{findUser:async()=>({user:currentUser})}:require(name),mod,mod.exports);
async function run(headers={}){const r=await mod.exports.GET(new Request("https://zokivo.vynalthai.com/api/paper/995777",{headers}),{params:Promise.resolve({pin:"995777"})});return r.json()}
(async()=>{
 currentUser={id:"teacher-1",email_confirmed_at:"2026-10-16"};
 const teacher=await run();ok(teacher.isHost===true&&teacher.leaderboard?.length===1,"Original teacher on NEW browser gets scanner");
 currentUser={id:"other",email_confirmed_at:"2026-10-16"};
 const stranger=await run({"x-host-token":"original-token"});
 ok(stranger.isHost===false&&stranger.leaderboard===undefined,"Stolen token cannot authorize another account");
 currentUser=null;
 const anonymous=await run();ok(anonymous.isHost===false,"Anonymous classroom visitor cannot host");
 ownerId=null;currentUser={id:"teacher-1",email_confirmed_at:"2026-10-16"};
 const old=await run({"x-host-token":"original-token"});ok(old.isHost===true,"Old sessions may use their token after sign-in");
 console.log("PAPER_CAMERA_ACCESS_TEST_PASS: "+count+" assertions.");
})().catch(e=>{console.error(e);process.exitCode=1});
