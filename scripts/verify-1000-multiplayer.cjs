/* 10-room × 100-client state machine verification, no network or real users.
 * This is NOT a latency or real-capacity certification.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
const rooms=new Map(),identities=new Map(),answers=new Map();
for(let i=0;i<10;i++){
 const pin=String(810000+i);
 rooms.set(pin,new Map());answers.set(pin,new Map());
}
let counter=0,events=0,checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++};
const store={
 db:()=>async(strings,...args)=>{
  const q=strings.join("?");
  if(q.includes("SELECT status,allow_late_joining,random_player_names"))
   return rooms.has(args[0])?[{status:"playing",allow_late_joining:true,random_player_names:false}]:[];
  if(q.includes("SELECT zokivo_join_room")){
   const [pin,nick,key]=args;const members=rooms.get(pin);
   if(!members)throw Error("Room not found");
   if(members.size>=100)throw Error("Room is full");
   if([...members.values()].some(p=>p.name===nick))throw Error("duplicate key violates unique constraint");
   const id=pin+":"+nick;
   members.set(id,{name:nick,token:key,id});
   identities.set(pin+":"+key,id);
   return [{id}];
  }
  if(q.includes("SELECT id FROM players")){
   const [pin,token]=args,id=identities.get(pin+":"+token);
   return id?[{id}]:[];
  }
  if(q.includes("WITH active AS")){
   const [activePin,actorPin,actorToken,answerPin,choice]=args;
   if(activePin!==actorPin||activePin!==answerPin)throw Error("Cross-room answer blocked");
   const id=identities.get(actorPin+":"+actorToken);
   if(!id)return [{authorized:false,accepted:false,goal:null}];
   const list=answers.get(activePin);
   if(!list||list.has(id))return [{authorized:true,accepted:false,goal:null}];
   list.set(id,choice);
   return [{authorized:true,accepted:true,goal:null}];
  }
  if(q.includes("UPDATE rooms SET status='finished'"))return [];
  throw Error("Unexpected SQL "+q);
 },
 token:()=>String(++counter).padStart(30,"Q"),
 hash:t=>t,
 bad:(message,status=400)=>Response.json({error:message},{status}),
 same:(a,b)=>a===b
};
function load(file,mocks){
 const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};
 new Function("require","module","exports",js)(name=>name in mocks?mocks[name]:require(name),m,m.exports);
 return m.exports;
}
const deps={
 "@/lib/store":store,
 "@/lib/mother-auth":{findUser:async()=>({user:null})},
 "@/lib/avatars":{avatarId:()=>"spark",avatarInfo:()=>({id:"spark",price:0})},
 "@/lib/realtime":{emitRoomRefresh:async()=>{events++;return true}},
 "@/lib/room-read-token":{issueRoomReadToken:()=>"signed-test-read"}
};
const join=load("src/app/api/rooms/[pin]/join/route.ts",deps);
const answer=load("src/app/api/rooms/[pin]/answer/route.ts",deps);
function request(pin,method,path,body,token){
 return new Request("https://qa.zokivo.example/api/rooms/"+pin+"/"+path,{
  method,headers:{"content-type":"application/json",...(token?{"x-player-token":token}:{})},
  body:JSON.stringify(body)
 });
}
(async()=>{
 const fixtures=[];
 for(const pin of rooms.keys()){
  const values=await Promise.all(Array.from({length:100},async(_,index)=>{
   const nick="QA-"+String(index).padStart(3,"0");
   const result=await join.POST(request(pin,"POST","join",{nickname:nick,avatar:"spark"}),{params:Promise.resolve({pin})});
   const payload=await result.json();
   return {status:result.status,token:payload.token,nick};
  }));
  ok(values.every(x=>x.status===200),"All 100 players join "+pin);
  fixtures.push({pin,players:values});
 }
 ok([...rooms.values()].reduce((acc,x)=>acc+x.size,0)===1000,"Ten rooms contain exactly 1,000 unique players");
 const attemptExtra=await join.POST(request("810000","POST","join",{nickname:"QA-101",avatar:"spark"}),{params:Promise.resolve({pin:"810000"})});
 ok(attemptExtra.status===409,"Room overflow rejected");
 const posted=await Promise.all(fixtures.flatMap(room=>room.players.map((player,index)=>
  answer.POST(request(room.pin,"POST","answer",{choice:index%2?0:1},player.token),{params:Promise.resolve({pin:room.pin})}).then(r=>r.status)
 )));
 ok(posted.length===1000&&posted.every(x=>x===200),"1,000 independent simulated answer submissions accepted");
 ok([...answers.values()].reduce((total,x)=>total+x.size,0)===1000,"Every simulated score recorded once");
 ok([...answers.values()].every(x=>x.size===100),"Exactly 100 answers for each classroom");
 const repeat=await answer.POST(request("810000","POST","answer",{choice:1},fixtures[0].players[0].token),{params:Promise.resolve({pin:"810000"})});
 ok(repeat.status===409,"Duplicate answer rejected");
 const unauth=await answer.POST(request("810000","POST","answer",{choice:1},"forged"),{params:Promise.resolve({pin:"810000"})});
 ok(unauth.status===403,"Forged player token rejected");
 ok(events===2000,"Accepted joins and answers emit update notices without duplicating rejected writes");
 console.log("MULTIPLAYER_1000_SYNTHETIC_PASS",JSON.stringify({rooms:10,players:1000,answers:1000,checks,syntheticOnly:true,latencyMeasured:false}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
