const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
let n=0;function ok(value,message){assert.ok(value,message);n++}
function load(path,mocks){
 const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const m={exports:{}};
 new Function("require","module","exports",js)(name=>name in mocks?mocks[name]:require(name),m,m.exports);
 return m.exports;
}
let sqlCalls=0,submitted=1,open=true,finished=false;
const expectedPlayers=[{id:"p1",nickname:"One",avatar_id:"spark",score:0,mode_score:0},{id:"p2",nickname:"Two",avatar_id:"spark",score:0,mode_score:0}];
const answers=[{player_id:"p1",chosen_index:1,is_correct:true},{player_id:"p2",chosen_index:0,is_correct:false}];
const store={
 db:()=>async(strings,...vars)=>{
  sqlCalls++;
  const q=strings.join("?");
  if(q.includes("SELECT pin,quiz_set_id,status"))return [{
   pin:"123456",quiz_set_id:"q1",status:finished?"finished":"playing",
   current_index:1,host_token_hash:"host-token",game_mode:"quiz_party",
   mute_sounds:false,score_goal:null,round_open:open,
   deadline:open?new Date(Date.now()+20000).toISOString():new Date(Date.now()-20000).toISOString(),
   server_time:new Date().toISOString()
  }];
  if(q.includes("FROM players p JOIN rooms r")){
   if(vars[1]!=="player-token")return [];
   return [{id:"p1",answered:true,is_correct:true,points:100}];
  }
  if(q.includes("WITH room AS("))return [{
   players:expectedPlayers,
   total:2,submitted,
   question:{question:"Which?",choices:["A","B","C","D"],correct_index:1,
    image_url:"",audio_url:"",formula_text:""},
   answers:submitted===2?answers:answers.slice(0,1)
  }];
  throw Error("Unexpected SQL "+q);
 },
 hash:value=>value,
 same:(a,b)=>a===b,
 bad:(message,status=400)=>Response.json({error:message},{status})
};
const snapshot=load("src/lib/quiz-party-snapshot.ts",{"@/lib/store":store});
const api=load("src/app/api/rooms/[pin]/route.ts",{
 "@/lib/store":store,"@/lib/quiz-party-snapshot":snapshot
});
const fetchRoom=async(headers={})=>{
 const r=await api.GET(new Request("https://qa.example/api/rooms/123456",{headers}),
  {params:Promise.resolve({pin:"123456"})});
 return {status:r.status,json:await r.json()};
};
(async()=>{
 process.env.ZOKIVO_ROOM_FAST_PATH_ENABLED="true";
 const unauth=await fetchRoom();
 ok(unauth.status===401,"Anonymous viewer rejected before cache");
 const before=sqlCalls;
 const concurrent=await Promise.all(Array.from({length:80},()=>fetchRoom({"x-player-token":"player-token"})));
 ok(concurrent.every(r=>r.status===200),"80 authorized player snapshots");
 const after=sqlCalls;
 ok(after-before<=81,"Room aggregation is coalesced across 80 users");
 const first=concurrent[0].json;
 ok(first.answeredCount===1&&first.answeredIds.length===1,"Player only sees own submission");
 ok(first.scoreboardPhase==="previous-round","Open question previous-round grade policy preserved");
 ok(!Object.hasOwn(first.question,"correct_index"),"No correct index leaked in public question");
 ok(!Object.hasOwn(first,"hostResults"),"No host-only grading leaked");
 ok(first.viewer.result===null,"Current-round grading withheld");
 const host=await fetchRoom({"x-host-token":"host-token"});
 ok(host.status===200&&host.json.hostResults===null,"Host grading hidden before question closes");
 open=false;
 const afterClosed=await fetchRoom({"x-player-token":"player-token"});
 ok(afterClosed.json.viewer.result?.is_correct===true,"Own result visible after deadline");
 ok(!Object.hasOwn(afterClosed.json,"hostResults"),"Closed question still hides host grading from player");
 const afterHost=await fetchRoom({"x-host-token":"host-token"});
 ok(afterHost.json.hostResults?.correctIndex===1,"Closed-round correct answer shown only to host");
 finished=true;
 const final=await fetchRoom({"x-host-token":"host-token"});
 ok(final.json.hostResults?.correctAnswer==="B","Host final-round grading remains available");
 ok(final.json.question===null,"Finished room does not send question to gameplay UI");
 ok(after-before>0,"Mock executed real fast route integration logic");
 console.log("QUIZ_FAST_PATH_TEST_PASS: "+n+" checks, "+(after-before)+" SQL operations for 80 simultaneous player reads");
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
