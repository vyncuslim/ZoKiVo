/* Read-only dual-role sync tester. Requires deliberately supplied test-game credentials.
 * Run: ZOKIVO_TEST_PIN=123456 ZOKIVO_TEST_HOST_TOKEN=... ZOKIVO_TEST_PLAYER_TOKEN=... npm run qa:realtime
 * Uses two independent HTTP clients, not an actual second physical device.
 */
const base=(process.env.ZOKIVO_TEST_URL||"https://zokivo.vynalthai.com").replace(/\/$/,"");
const pin=process.env.ZOKIVO_TEST_PIN||"",host=process.env.ZOKIVO_TEST_HOST_TOKEN||"",player=process.env.ZOKIVO_TEST_PLAYER_TOKEN||"";
if(!/^\d{6}$/.test(pin)||!host||!player){
 console.error("Set ZOKIVO_TEST_PIN, ZOKIVO_TEST_HOST_TOKEN and ZOKIVO_TEST_PLAYER_TOKEN for a dedicated test room.");
 process.exit(2);
}
const rounds=Math.max(1,Math.min(60,Number(process.env.ZOKIVO_TEST_ROUNDS)||12));
const results=[];
async function check(kind,token){
 const start=performance.now();
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
 try{
  const r=await fetch(base+"/api/rooms/"+pin,{headers:{[kind==="host"?"x-host-token":"x-player-token"]:token},signal:abort.signal,cache:"no-store"});
  const payload=await r.json();
  return {kind,status:r.status,elapsed:performance.now()-start,payload};
 }finally{clearTimeout(timeout)}
}
async function main(){
 for(let i=0;i<rounds;i++){
  const values=await Promise.allSettled([check("host",host),check("player",player)]);
  if(values.some(v=>v.status==="rejected")){results.push({round:i,error:"Network or timeout"});continue}
  const [h,p]=values.map(v=>v.value);
  const samePhase=h.payload.scoreboardPhase===p.payload.scoreboardPhase&&h.payload.index===p.payload.index;
  const identical=JSON.stringify(h.payload.players?.map(x=>[x.id,x.score,x.mode_score]))===
    JSON.stringify(p.payload.players?.map(x=>[x.id,x.score,x.mode_score]));
  results.push({round:i,hostStatus:h.status,playerStatus:p.status,phase:samePhase?"same":"transition",identical,
   latencyMs:Math.round(Math.max(h.elapsed,p.elapsed))});
  await new Promise(done=>setTimeout(done,500));
 }
 const comparable=results.filter(x=>x.phase==="same"&&x.hostStatus===200&&x.playerStatus===200);
 const mismatches=comparable.filter(x=>!x.identical),errors=results.filter(x=>x.error||x.hostStatus!==200||x.playerStatus!==200);
 const timings=results.filter(x=>Number.isFinite(x.latencyMs)).map(x=>x.latencyMs).sort((a,b)=>a-b);
 const p95=timings[Math.min(timings.length-1,Math.ceil(.95*timings.length)-1)]??null;
 console.log(JSON.stringify({rounds,comparable:comparable.length,mismatches:mismatches.length,errors:errors.length,p95Ms:p95,
  note:"Real HTTP with separate credentials; not a physical two-device or peak-load validation."},null,2));
 if(errors.length||mismatches.length||!comparable.length)process.exitCode=1;
}
main().catch(e=>{console.error(String(e));process.exitCode=1});
