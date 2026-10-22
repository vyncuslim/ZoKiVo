/* Verify ONE MILLION virtual routing decisions using ZoKivo's real provider policy.
 * Absolutely no HTTP, sockets, database writes, Cloudflare calls or production load.
 * This proves only deterministic distribution / fallback policy under synthetic IDs.
 */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
const {performance}=require("node:perf_hooks");
const original={...process.env};
const policies=fs.readFileSync("src/lib/realtime-provider-selection.ts","utf8");
const built=ts.transpileModule(policies,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText;
const moduleStub={exports:{}};
new Function("require","module","exports",built)(name=>{
 if(name==="@/lib/realtime")return {realtimeConfig:()=>({url:"simulation-only",anonKey:"simulation-only"})};
 if(name==="node:crypto")return require(name);
 throw Error("Unexpected routing policy import: "+name);
},moduleStub,moduleStub.exports);
const providers=moduleStub.exports.realtimeProviders;
const people=1_000_000;
const perRoom=100;
const numRooms=people/perRoom;
const pinFor=room=>String(100000+room);
let primaryNeon=0,primarySupabase=0,missingPrimary=0,dualPrimary=0;
let minNeonPerRoom=100,maxNeonPerRoom=0;
let roomsWithBoth=0;
let stable=0;
let fallbackOk=0;
let paperOk=0;
let invalidBucketFallsBack=0;
const started=performance.now();

try{
 process.env.ZOKIVO_NEON_REALTIME_ENABLED="true";
 process.env.ZOKIVO_NEON_REALTIME_PERCENT="50";
 // Literal, non-secret placeholders ONLY: there is no network call anywhere.
 process.env.NEON_REALTIME_URL="https://example.invalid/simulation";
 process.env.NEON_REALTIME_SECRET="simulation-only-not-a-secret";
 for(let room=0;room<numRooms;room++){
  const pin=pinFor(room);
  let perRoomNeon=0;
  for(let i=0;i<perRoom;i++){
   const n=room*perRoom+i;
   const identity="player:synthetic-"+String(n);
   const order=providers("quiz",pin,identity);
   if(!Array.isArray(order)||order.length!==2||order[0]===order[1]){
    if(!order[0])missingPrimary++;
    else dualPrimary++;
    continue;
   }
   if(order[0]==="neon"){primaryNeon++;perRoomNeon++;}
   else if(order[0]==="supabase")primarySupabase++;
   else missingPrimary++;
   // An unhealthy primary has exactly one alternative transport in policy.
   if(order[1]===(order[0]==="neon"?"supabase":"neon"))fallbackOk++;
   // Sample deterministic reconnects without doubling policy work for all users.
   if(n%100===0){
    assert.deepEqual(providers("quiz",pin,identity),order);
    stable++;
   }
  }
  if(perRoomNeon>0&&perRoomNeon<100)roomsWithBoth++;
  minNeonPerRoom=Math.min(minNeonPerRoom,perRoomNeon);
  maxNeonPerRoom=Math.max(maxNeonPerRoom,perRoomNeon);
 }
 assert.equal(missingPrimary,0);
 assert.equal(dualPrimary,0);
 assert.equal(primaryNeon+primarySupabase,people);
 assert.equal(fallbackOk,people);
 assert.equal(stable,numRooms);
 // Stable hashing should be close to 50:50 over a million independent identities.
 assert.ok(primaryNeon>490_000&&primaryNeon<510_000,"Excess routing imbalance");
 assert.ok(roomsWithBoth>9_900,"Room routing not distributed across players");
 for(let k=0;k<100;k++){
  const pin=pinFor(k);
  assert.deepEqual(providers("paper",pin,"player:s"+k),["supabase"]);
  paperOk++;
 }
 process.env.ZOKIVO_NEON_REALTIME_ENABLED="false";
 assert.deepEqual(providers("quiz","100001","player:any"),["supabase"]);
 process.env.ZOKIVO_NEON_REALTIME_ENABLED="true";
 process.env.ZOKIVO_NEON_REALTIME_PERCENT="invalid";
 assert.equal(providers("quiz","100001","player:any")[0],"supabase");
 invalidBucketFallsBack++;
 const report={
  kind:"OFFLINE VIRTUAL ROUTING SIMULATION — NOT A CAPACITY TEST",
  passed:true,realWebSocketConnections:0,realNetworkRequests:0,realAnswerWrites:0,
  simulatedPlayers:people,simulatedRooms:numRooms,playersPerRoom:perRoom,
  preferred:{neon:primaryNeon,supabase:primarySupabase},
  preferredSharePct:{neon:Number((100*primaryNeon/people).toFixed(3)),supabase:Number((100*primarySupabase/people).toFixed(3))},
  roomsWithBothProviders:roomsWithBoth,
  minNeonPreferencePerRoom:minNeonPerRoom,maxNeonPreferencePerRoom:maxNeonPerRoom,
  verifiedFailoverOrdering:fallbackOk,verifiedReconnectStability:stable,
  verifiedPaperSupabaseOnly:paperOk,invalidWeightFailSafe:invalidBucketFallsBack,
  elapsedSimulationMs:Math.round(performance.now()-started),
  zeroLagProven:false,productionReadyForOneMillion:false,
  capacityPlanning:{
   simultaneousConnectionsIfExactlyHalf:500000,
   roomsNeededAt100Players:10000,
   allPlayersPollEvery5sRps:200000,
   allPlayersPollEvery3sRps:Math.ceil(people/3),
   ifEveryoneSubmitsWithin2sAnswerWritesPerSecond:500000
  }
 };
 console.log("ZOKIVO_MILLION_OFFLINE_SIM="+JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  "### ZoKivo 1,000,000 virtual-player routing simulation (NOT live load)\n"+
  "\n- Policy distribution: Neon "+primaryNeon+" / Supabase "+primarySupabase+
  "\n- Modelled rooms: "+numRooms+" × 100 players; no sockets or API calls.\n"+
  "\n- **Production 1M capacity certification: NOT RUN / NOT CERTIFIED.**\n");
}catch(error){console.error("ZOKIVO_MILLION_OFFLINE_SIM_FAIL",error.message);process.exitCode=1}
finally{
 for(const key of ["ZOKIVO_NEON_REALTIME_ENABLED","ZOKIVO_NEON_REALTIME_PERCENT","NEON_REALTIME_URL","NEON_REALTIME_SECRET"]){
  if(Object.prototype.hasOwnProperty.call(original,key))process.env[key]=original[key];
  else delete process.env[key];
 }
}
