import {newQaCookieJar} from "./qa-cookie-jar.mjs";
const BASE="https://zokivo.vynalthai.com",pin=process.env.ZOKIVO_TEST_ROOM_PIN;
if(!new Set(["982501","982502","982503","982504"]).has(pin))throw Error("Non-isolated room rejected");
const jar=newQaCookieJar();
const hs=await fetch(BASE+"/__shield/gps/region-check",{
 method:"POST",headers:{Origin:BASE,"Sec-Fetch-Site":"same-origin","Content-Type":"application/json"},
 body:JSON.stringify({timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}),
 signal:AbortSignal.timeout(12000)
});
jar.capture(hs.headers);
const check=await fetch(BASE+"/api/rooms/"+pin+"/settings",{
 headers:{Cookie:jar.header(),Accept:"application/json"},signal:AbortSignal.timeout(12000)
});
const data=await check.json().catch(()=>({}));
const valid=hs.status===200&&jar.has("__Host-vynalth-region")&&check.status===200&&data.acceptingPlayers===true;
console.log("LIVE_ROOM_PREFLIGHT="+JSON.stringify({pin,regionStatus:hs.status,hasRegionCookie:jar.has("__Host-vynalth-region"),
 roomStatus:check.status,acceptingPlayers:data.acceptingPlayers,ready:valid}));
if(!valid)process.exitCode=1;
