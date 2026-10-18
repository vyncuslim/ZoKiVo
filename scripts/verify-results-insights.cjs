/* Deterministic, no live credentials/database. */
const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const {NextRequest}=require("next/server");
const source=fs.readFileSync("src/app/api/rooms/[pin]/insights/route.ts","utf8");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let finished=true,signedIn=true,queries=[];
const rows=[{question_index:0,question:"9 - 8 =",choices:["0","1","2","3"],correct_index:1,chosen_index:0,
 is_correct:false,points:0,explanation:"9 - 8 is 1"},
 {question_index:1,question:"17 - 14 =",choices:["3","4","5","6"],correct_index:0,chosen_index:0,
 is_correct:true,points:100,explanation:"17 minus 14 is 3"}];
const db=()=>async(strings,...args)=>{
 const q=strings.join("?");queries.push(q);
 if(q.includes("SELECT r.status,r.quiz_set_id"))return [{status:finished?"finished":"playing",quiz_set_id:"quiz-1",
  current_index:1,question_order:null,host_token_hash:"good-host",owner_user_id:"teacher-1",
  game_mode:"quiz_party",title:"Math"}];
 if(q.includes("SELECT id,nickname,score,avatar_id FROM players"))return args.some(x=>x==="good-player")?
  [{id:"student-1",nickname:"Sam",score:100,avatar_id:"fox"}]:[];
 if(q.includes("SELECT a.question_index,q.question,q.choices"))return rows;
 if(q.includes("SELECT p.id,p.nickname,p.avatar_id,p.score"))return [{id:"student-1",nickname:"Sam",avatar_id:"fox",score:100,answered:2,correct:1}];
 if(q.includes("SELECT q.position,q.question,q.choices"))return [{position:0,question:"9 - 8 =",choices:["0","1","2","3"],
  correct_index:1,explanation:"9 - 8 is 1",submissions:1,correct:0,a:1,b:0,c:0,d:0}];
 throw Error("Unexpected SQL: "+q);
};
const store={db,hash:x=>x,same:(a,b)=>a===b,bad:(message,status=400)=>Response.json({error:message},{status})};
const auth={findUser:async()=>({user:signedIn?{id:"teacher-1"}:null}),noCache:(v,status=200)=>Response.json(v,{status}),
 applyRenew:r=>r,authError:e=>Response.json({error:String(e)},{status:503})};
const mod={exports:{}};
new Function("require","module","exports",code)(name=>{
 if(name==="@/lib/store")return store;
 if(name==="@/lib/mother-auth")return auth;
 return require(name);
},mod,mod.exports);
let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++};
async function request(headers={},suffix=""){
 const req=new NextRequest("https://zokivo.example/api/rooms/123456/insights"+suffix,{headers});
 const r=await mod.exports.GET(req,{params:Promise.resolve({pin:"123456"})});
 return {status:r.status,result:await r.json()};
}
(async()=>{
 let unauth=await request();ok(unauth.status===401,"PIN alone cannot read results");
 let player=await request({"x-player-token":"good-player"});
 ok(player.status===200&&player.result.scope==="player","Valid player can read only personal results");
 ok(player.result.review.length===2&&player.result.player.wrong===1,"Wrong and correct answers included after finish");
 ok(player.result.review[0].correctAnswer==="1"&&player.result.review[0].yourAnswer==="0","Exact corrected answers included");
 ok(!("players" in player.result)&&!("questions" in player.result),"No class-level detail in student response");
 let leaked=await request({"x-player-token":"good-player"},"?player=student-2");
 ok(leaked.status===200&&leaked.result.scope==="player"&&!("student" in leaked.result),"Query cannot elevate player");
 let denied=await request({"x-player-token":"invalid"});
 ok(denied.status===403,"Forged token rejected");
 let report=await request({"x-host-token":"good-host"});
 ok(report.status===200&&report.result.scope==="host","Signed-in host can read classroom results");
 ok(report.result.metrics.accuracy===50&&report.result.questions[0].wrong===1,"Host metrics are accurate");
 let detail=await request({"x-host-token":"good-host"},"?player=student-1");
 ok(detail.status===200&&detail.result.scope==="host-student"&&detail.result.review.length===2,
  "Host can request student answer review");
 let missing=await request({"x-host-token":"good-host"},"?player=other-student");
 ok(missing.status===404,"Host cannot invent a student");
 signedIn=false;
 let unowned=await request({"x-host-token":"good-host"});
 ok(unowned.status===403,"Host token without authenticated owner is denied");
 signedIn=true;finished=false;
 ok((await request({"x-player-token":"good-player"})).status===409,"Player cannot read before finish");
 ok((await request({"x-host-token":"good-host"})).status===409,"Host cannot read before finish");
 ok(queries.some(q=>q.includes("a.player_id=")),"Personal detail query uses player UUID filter");
 ok(source.includes('room.owner_user_id!==signedIn.user.id'),"Original host ownership verified");
 console.log("RESULTS_INSIGHTS_TEST_PASS: "+checks+" checks. No real player data used.");
})().catch(e=>{console.error(e);process.exitCode=1});
