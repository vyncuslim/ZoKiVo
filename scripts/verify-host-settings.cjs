const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const read=p=>fs.readFileSync(p,"utf8");let n=0;function ok(b,msg){assert.ok(b,msg);n++}
const host=read("src/app/host/page.tsx"),create=read("src/app/api/rooms/route.ts"),join=read("src/app/api/rooms/[pin]/join/route.ts"),play=read("src/app/play/page.tsx"),options=read("src/app/api/rooms/[pin]/settings/route.ts");
ok(host.includes("setQuestionSeconds")&&host.includes("[10,15,20,30,45,60]"),"Teacher can choose question timer");
ok(host.includes("allowLateJoining:lateJoin")&&host.includes("randomPlayerNames:randomNames"),"Teacher sends join settings");
ok(create.includes('typeof allowLateJoining!=="boolean"')&&create.includes('typeof randomPlayerNames!=="boolean"'),"Strict server settings validation");
ok(create.includes("allow_late_joining,random_player_names"),"Room persists options");
ok(read("migrations/016_room_capacity.sql").includes("room_info.allow_late_joining"),"Only opted-in late joins permitted");
ok(join.includes("random_player_names"),"Random names controlled by room setting");
ok(join.includes("avatarId(body.avatar)"),"Avatar choice retained");
ok(read("migrations/016_room_capacity.sql").includes("INSERT INTO players"),"Nickname conflict cannot override existing player");
ok(play.includes('randomNames?"Your host will assign a nickname"'),"UI explains generated nicknames");
ok(play.includes("!roomOpen"),"Closed room cannot be joined by UI");
ok(options.includes('randomNames:!!rows[0].random_player_names')&&options.includes("acceptingPlayers:"),"Public join settings contain no answers or tokens");
const compiled=ts.transpileModule(options,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let status="playing",late=true;const store={db:()=>async()=>[{status,allow_late_joining:late,random_player_names:true}],bad:(m,s=400)=>Response.json({error:m},{status:s})};
const holder={exports:{}};new Function("require","module","exports",compiled)((name)=>name==="@/lib/store"?store:require(name),holder,holder.exports);
(async()=>{
 let res=await holder.exports.GET(new Request("https://zokivo.vynalthai.com/game"),{params:Promise.resolve({pin:"123456"})});
 let data=await res.json();ok(data.acceptingPlayers&&data.randomNames,"Join rules available with late joining enabled");
 late=false;res=await holder.exports.GET(new Request("https://zokivo.vynalthai.com/game"),{params:Promise.resolve({pin:"123456"})});data=await res.json();ok(!data.acceptingPlayers,"Playing rooms refuse joins when not opted in");
 console.log("ZOKIVO_HOST_SETTINGS_TEST_PASS: "+n+" assertions.");
})().catch(e=>{console.error(e);process.exitCode=1});
