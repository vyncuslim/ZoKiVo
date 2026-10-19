/* ZoKivo real-network 10 x 100 classroom QA.
 * Run ONLY with QA-only rooms and their 1,000 privately issued player tokens.
 * Never publish or commit qa-1000-private.json.
 * Example: k6 run -e ZOKIVO_QA_CONFIRM=TEN_DEDICATED_ROOMS qa/k6-1000-multiplayer.js
 */
import http from "k6/http";
import {check,fail,sleep} from "k6";
import exec from "k6/execution";
import {Counter,Rate,Trend} from "k6/metrics";
const qa=JSON.parse(open("./qa-1000-private.json"));
const base=String(qa.baseUrl||"").replace(/\/$/,"");
if(__ENV.ZOKIVO_QA_CONFIRM!=="TEN_DEDICATED_ROOMS")fail("QA confirmation flag required");
if(!/^https:\/\//.test(base)||!qa.testRoomsOnly)fail("HTTPS and testRoomsOnly=true required");
if(/zokivo\.vynalthai\.com|zokivo\.xyz|zokivo\.vercel\.app/.test(base)&&__ENV.ZOKIVO_QA_ALLOW_PRODUCTION!=="YES")fail("Explicit production QA approval required");
if(!Array.isArray(qa.rooms)||qa.rooms.length!==10)fail("Exactly 10 dedicated QA rooms required");
const pins=new Set();
for(const r of qa.rooms){
 if(!/^\d{6}$/.test(r.pin)||pins.has(r.pin)||!Array.isArray(r.players)||r.players.length!==100)fail("Each unique room must have exactly 100 QA players");
 pins.add(r.pin);
 for(const p of r.players)if(typeof p.token!=="string"||p.token.length<20)fail("Missing isolated test-player token");
}
export const options={
 scenarios:{classrooms:{executor:"constant-vus",vus:1000,duration:"2m",gracefulStop:"10s"}},
 thresholds:{
  "http_req_duration{endpoint:room_state}":["p(95)<1000"],
  "http_req_duration{endpoint:answer_write}":["p(95)<1000"],
  "http_req_failed":["rate<0.001"],
  "checks":["rate>0.999"]
 }
};
const requests429=new Counter("zokivo_429");
const denied=new Counter("zokivo_5xx");
const gameplayErrors=new Rate("zokivo_gameplay_errors");
const apiLatency=new Trend("zokivo_gameplay_latency",true);
let lastAnsweredRound=-1;
export default function(){
 const slot=exec.vu.idInTest-1;
 const room=qa.rooms[Math.floor(slot/100)];
 const player=room.players[slot%100];
 const headers={"x-player-token":player.token};
 const get=http.get(base+"/api/rooms/"+room.pin,{headers,tags:{endpoint:"room_state"},timeout:"10s"});
 apiLatency.add(get.timings.duration);
 if(get.status===429)requests429.add(1);
 if(get.status>=500)denied.add(1);
 const valid=check(get,{"authorized room state":r=>r.status===200});
 if(!valid){gameplayErrors.add(1);sleep(3);return}
 let state;
 try{state=get.json()}catch{gameplayErrors.add(1);sleep(3);return}
 const correctRoom=state?.viewer?.playerId&&Array.isArray(state.players)&&state.players.length<=100;
 if(!check(state,{"correct room, capacity respected":()=>Boolean(correctRoom)})){gameplayErrors.add(1);sleep(3);return}
 // Host controls the question transitions. Each VU submits only once per round.
 // Run against TEST rooms that are already in the playing state.
 const ready=state.status==="playing"&&Number.isInteger(state.index)&&state.question&&
  Array.isArray(state.answeredIds)&&!state.answeredIds.includes(state.viewer.playerId)&&
  Number.isFinite(Date.parse(state.deadline))&&Date.parse(state.deadline)>Date.now()+3000;
 if(ready&&lastAnsweredRound!==state.index){
  const response=http.post(base+"/api/rooms/"+room.pin+"/answer",
   JSON.stringify({choice:slot%4}),{headers:{...headers,"content-type":"application/json"},
    tags:{endpoint:"answer_write"},timeout:"10s"});
  if(response.status===429)requests429.add(1);
  if(response.status>=500)denied.add(1);
  const accepted=response.status===200;
  if(!check(response,{"answer stored once":()=>accepted}))gameplayErrors.add(1);
  else lastAnsweredRound=state.index;
 }
 sleep(1.5+Math.random()*1.5);
}
