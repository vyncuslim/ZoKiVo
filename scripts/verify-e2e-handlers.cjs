/**
 * Behavioral API regression with simulated independent clients.
 * Executes real Next route handlers, stubbing only auth, persistence and broadcast.
 * NOT a network load test, physical camera test, or proof of realtime scalability.
 */
const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
let checks=0;function ok(v,msg){assert.ok(v,msg);checks++}
function load(path,mocks){
 const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{
   compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const module={exports:{}};
 new Function("require","module","exports",js)((name)=>Object.prototype.hasOwnProperty.call(mocks,name)?mocks[name]:require(name),module,module.exports);
 return module.exports;
}
const bad=(msg,status=400)=>Response.json({error:msg},{status});
const noCache=(obj,status=200)=>Response.json(obj,{status});
let principal={id:"qa-teacher",email_confirmed_at:"verified"};
const auth={findUser:async()=>({user:principal}),checkOrigin:()=>{},noCache,authError:e=>bad(e.message,e.status||503),
 applyRenew:r=>r,AuthError:class AuthError extends Error{constructor(m,status=400){super(m);this.status=status}}};
const mockStore={token:()=>"synthetic-test-token",hash:()=>"synthetic-hash",same:(a,b)=>a===b,bad};
const quizzes={isId:x=>typeof x==="string"&&/^[0-9a-f-]{36}$/.test(x),authUser:async()=>({user:principal})};
const realtime={emitRoomRefresh:async()=>true};
const params={params:Promise.resolve({pin:"123456"})};
function req(path,body,headers={}){
 return new Request("https://zokivo.example"+path,{method:"POST",headers:{"origin":"https://zokivo.example","content-type":"application/json",...headers},body:JSON.stringify(body)});
}
async function json(r){return {status:r.status,...await r.json()}}
const sample="b91f4600-1000-4000-8000-000000000001";
async function main(){
 // Host sign-in, verification, 12-column SQL insert and shuffled room creation.
 const createDb=()=>async(strings,...vars)=>{
  const sql=strings.join("?");
  if(sql.includes("SELECT id FROM quiz_sets"))return [{id:sample}];
  if(sql.includes("ORDER BY random()"))return [2,1,3,0].map(position=>({position}));
  if(sql.includes("zokivo_allocate_room_reusing_finished(")){
    ok(vars.length===12,"All 12 room creation settings bound to the atomic allocator");
    ok(vars[8]==="[2,1,3,0]"&&vars[9]===true,"Randomized question mapping persists");
    ok(vars[11]===1000,"Score goal still persists with recycled PIN");
    return [{allocated:true}];
  }
  throw Error("Unexpected room creation query "+sql);
 };
 const hostRoute=load("src/app/api/rooms/route.ts",{"@/lib/store":{...mockStore,db:createDb},"@/lib/mother-auth":auth,"@/lib/quizzes":quizzes,"@/lib/realtime":realtime});
 principal=null;
 ok((await json(await hostRoute.POST(req("/api/rooms",{})))).status===401,"Anonymous users cannot create rooms");
 principal={id:"qa-teacher",email_confirmed_at:null};
 ok((await json(await hostRoute.POST(req("/api/rooms",{})))).status===403,"Unverified teacher cannot create rooms");
 principal={id:"qa-teacher",email_confirmed_at:"verified"};
 const body={quizId:sample,questionSeconds:30,allowLateJoining:true,randomPlayerNames:false,
  gameMode:"gold_quest",randomQuestionOrder:true,muteSounds:false,scoreGoal:1000};
 const rooms=await Promise.all(Array.from({length:18},()=>hostRoute.POST(req("/api/rooms",body))));
 ok(rooms.every(r=>r.status===200),"18 concurrent simulated teacher host creations succeed");
 ok((await json(await hostRoute.POST(req("/api/rooms",{...body,scoreGoal:"1000"})))).status===400,"Untrusted score goal rejected");
 // 120 independent concurrent players try to enter a 100-player room. A simulated DB procedure enforces capacity.
 const joined=new Map();
 const avatars=load("src/lib/avatars.ts",{});
 const joinDb=()=>async(strings,...vars)=>{
  const sql=strings.join("?");
  if(sql.includes("SELECT status,allow_late_joining,random_player_names"))return [{status:"lobby",allow_late_joining:true,random_player_names:false}];
  if(sql.includes("SELECT zokivo_join_room")){
   const name=vars[1];
   if(joined.size>=100)throw Error("Room is full");
   if(joined.has(name))throw Error("duplicate key value violates unique constraint");
   const id="player-"+name;joined.set(name,id);return [{id}];
  }
  throw Error("Unexpected join query "+sql);
 };
 const join=load("src/app/api/rooms/[pin]/join/route.ts",{"@/lib/store":{...mockStore,db:joinDb},
  "@/lib/mother-auth":auth,"@/lib/realtime":realtime,"@/lib/avatars":avatars});
 const statuses=await Promise.all(Array.from({length:120},(_,i)=>join.POST(req("/api/rooms/123456/join",{nickname:"QA-"+String(i).padStart(3,"0"),avatar:"spark"}),params).then(r=>r.status)));
 ok(statuses.filter(s=>s===200).length===100&&statuses.filter(s=>s===409).length===20,"100 simulated players accepted, extra 20 rejected");
 ok(joined.size===100,"No overflow or duplicate player identities");
 const duplicate=await join.POST(req("/api/rooms/123456/join",{nickname:"QA-000",avatar:"spark"}),params);
 ok(duplicate.status===409,"Duplicated nickname is rejected");
 // Concurrent duplicate answer attempts: the unique answer constraint is modelled in the persistence mock.
 const player={id:"p-001"};let answers=0;
 const answerDb=()=>async(strings,...vars)=>{
  const s=strings.join("?");
  if(s.includes("SELECT id FROM players"))return [player];
  if(s.includes("WITH active AS")){
   if(answers++)return [];
   return [{points:100,is_correct:true,score:100}];
  }
  if(s.includes("UPDATE rooms SET status="))return [];
  throw Error("Unexpected answer query "+s);
 };
 const answer=load("src/app/api/rooms/[pin]/answer/route.ts",{"@/lib/store":{...mockStore,db:answerDb},"@/lib/realtime":realtime});
 const a=await Promise.all(Array.from({length:16},()=>answer.POST(req("/api/rooms/123456/answer",{choice:1},{"x-player-token":"student-token"}),params).then(r=>r.status)));
 ok(a.filter(x=>x===200).length===1&&a.filter(x=>x===409).length===15,"16 simultaneous repeated answers yield exactly one accepted attempt");
 let rewarded=false;
 const rewardDb=()=>async(strings,...vars)=>{
  const s=strings.join("?");
  if(s.includes("SELECT id FROM players"))return [player];
  if(s.includes("SELECT zokivo_claim_reward")){
   if(rewarded)throw Error("Reward already claimed");
   rewarded=true;return [{reward:{credits:100,earned:100,outcome:"Test treasure chest"}}];
  }
  throw Error("Unexpected reward query "+s);
 };
 const reward=load("src/app/api/rooms/[pin]/reward/route.ts",{"@/lib/store":{...mockStore,db:rewardDb},"@/lib/mother-auth":auth,"@/lib/realtime":realtime});
 const b=await Promise.all(Array.from({length:12},()=>reward.POST(req("/api/rooms/123456/reward",{action:"chest",option:0},{"x-player-token":"student-token"}),params).then(r=>r.status)));
 ok(b.filter(x=>x===200).length===1&&b.filter(x=>x===409).length===11,"12 simultaneous reward claims award once");
 let done=false;
 const finishDb=()=>async(strings,...vars)=>{
  const s=strings.join("?");
  if(s.includes("SELECT host_token_hash"))return [{host_token_hash:"synthetic-hash",owner_user_id:"qa-teacher",status:done?"finished":"playing"}];
  if(s.includes("UPDATE rooms SET status='finished'")){if(done)return [];done=true;return [{pin:"123456"}]}
  throw Error("Unexpected finish query "+s);
 };
 const finish=load("src/app/api/rooms/[pin]/finish/route.ts",{"@/lib/store":{...mockStore,db:finishDb},"@/lib/mother-auth":auth,"@/lib/realtime":realtime});
 principal={id:"qa-teacher",email_confirmed_at:"verified"};
 ok((await finish.POST(req("/api/rooms/123456/finish",{},{"x-host-token":"teacher-token"}),params)).status===200,"Original signed-in host finishes game");
 ok((await finish.POST(req("/api/rooms/123456/finish",{},{"x-host-token":"teacher-token"}),params)).status===409,"Finishing twice cannot change results");
 principal={id:"imposter",email_confirmed_at:"verified"};
 ok((await finish.POST(req("/api/rooms/123456/finish",{},{"x-host-token":"teacher-token"}),params)).status===403,"A different teacher cannot end the room");
 // Paper Mode accepts two brands sharing card #1; rejects duplicate within one brand or 121 cards.
 principal={id:"qa-teacher",email_confirmed_at:"verified"};
 const paperDb=()=>async(strings,...vars)=>{
  const s=strings.join("?");
  if(s.includes("SELECT host_token_hash,owner_user_id"))return [{host_token_hash:"synthetic-hash",owner_user_id:"qa-teacher"}];
  if(s.includes("WITH active AS"))return [{saved:120}];
  throw Error("Unexpected Paper query "+s);
 };
 const paper=load("src/app/api/paper/[pin]/submit/route.ts",{"@/lib/store":{...mockStore,db:paperDb},
  "@/lib/mother-auth":auth,"@/lib/realtime":realtime});
 const cards=["zokivo","wayground"].flatMap(source=>Array.from({length:60},(_,i)=>({card_source:source,card:i+1,choice:i%4})));
 ok((await paper.POST(req("/api/paper/123456/submit",{index:0,responses:cards}),params)).status===200,"Paper API accepts all 120 unique two-brand card identities");
 ok((await paper.POST(req("/api/paper/123456/submit",{index:0,responses:[cards[0],cards[0]]}),params)).status===400,"Same-brand duplicate card is refused");
 ok((await paper.POST(req("/api/paper/123456/submit",{index:0,responses:[...cards,cards[0]]}),params)).status===400,"More than 120 scanned responses refused");
 principal={id:"another-teacher",email_confirmed_at:"verified"};
 ok((await paper.POST(req("/api/paper/123456/submit",{index:0,responses:[cards[0]]}),params)).status===403,"Paper score submissions restricted to original teacher");
 console.log("ZOKIVO_E2E_HANDLER_TEST_PASS: "+checks+" assertions; simulated 18 hosts, 120 players, 16 duplicate answers, 12 reward races and 120 mixed paper cards.");
}
main().catch(e=>{console.error("ZOKIVO_E2E_HANDLER_TEST_FAILED",e.stack||e);process.exitCode=1});
