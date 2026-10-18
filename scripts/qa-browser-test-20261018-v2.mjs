import {chromium} from "playwright";
import {writeFile} from "node:fs/promises";
const url="https://zokivo.vynalthai.com",pin="982600";
if(process.env.ZOKIVO_BROWSER_QA_PIN!==pin)throw Error("A dedicated QA room is required");
const browser=await chromium.launch();
const cases=[{label:"Desktop",viewport:{width:1366,height:768}},
 {label:"Mobile viewport",viewport:{width:390,height:844}}];
const records=[];
for(const [i,c] of cases.entries()){
 const context=await browser.newContext({viewport:c.viewport});
 try{
  const page=await context.newPage();
  await page.goto(url+"/play?pin="+pin,{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#game-pin").waitFor({timeout:25000});
  await page.waitForTimeout(1600);
  await page.locator("#game-pin").fill(pin);
  // Perform the same first-party Cloudflare region check as a visiting browser.
  const region=await page.evaluate(async()=>{
   const r=await fetch("/__shield/gps/region-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"})});
   return {status:r.status,ok:r.ok};
  });
  console.log("BROWSER_REGION="+JSON.stringify({case:c.label,...region}));
  await page.locator("#nickname").fill("BrowserQD"+pin+i);
  const button=page.locator(".entry-form button[type=submit]");
  await page.waitForTimeout(800);
  const diagnostics=await page.evaluate(()=>({
   pin:document.querySelector("#game-pin")?.value,
   nicknameLength:document.querySelector("#nickname")?.value?.length,
   joinButtonDisabled:document.querySelector(".entry-form button[type=submit]")?.disabled,
   error:(document.querySelector(".form-error")?.textContent||"").slice(0,120)
  }));
  console.log("BROWSER_ENTRY_PREFLIGHT="+JSON.stringify({case:c.label,...diagnostics}));
  if(diagnostics.joinButtonDisabled)throw Error("JOIN_BUTTON_DISABLED: "+JSON.stringify(diagnostics));
  await button.click({timeout:10000});
  await page.waitForURL(new RegExp("/game/"+pin),{timeout:30000});
  const buttons=page.locator(".question-card .answer-grid button");
  await buttons.first().waitFor({timeout:30000});
  await buttons.first().click();
  await page.locator(".answer-feedback").waitFor({timeout:20000});
  const ok=await page.locator(".leaderboard-card").isVisible();
  records.push({label:c.label,joined:true,answerClicked:true,leaderboardVisible:ok,pass:ok});
 }catch(e){records.push({label:c.label,pass:false,error:String(e).slice(0,200)})}
 finally{await context.close()}
}
await browser.close();
const result={rooms:1,physicalDevices:0,realBrowserContexts:2,cases:records,pass:records.every(x=>x.pass)};
await writeFile("zokivo-browser-check.json",JSON.stringify(result));
console.log("BROWSER_QA_RESULT="+JSON.stringify(result));
if(!result.pass)process.exitCode=1;
