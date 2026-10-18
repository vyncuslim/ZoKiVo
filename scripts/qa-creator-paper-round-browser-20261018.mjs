import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
const ORIGIN="https://zokivo.vynalthai.com",PIN="991828";
const result={url:ORIGIN,started:new Date().toISOString(),realDevices:0,productionWrites:0,checks:[]};
await mkdir("ux-browser-proof",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
function assert(c,msg){if(!c)throw Error(msg)}
const viewportSizes=[{name:"desktop",width:1366,height:768},{name:"phone",width:390,height:844}];
async function caseRun(name,viewport,run){
 const ctx=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},locale:"en-US"});
 const page=await ctx.newPage();const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 const outcome={name,viewport:viewport.name,pass:false};
 try{const values=await run(page,ctx);
  const dim=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert(dim.scroll<=dim.width+3,"Page overflows horizontally "+JSON.stringify(dim));
  assert(errors.length===0,"Uncaught browser exceptions "+errors.join("; "));
  Object.assign(outcome,values,{pass:true,noHorizontalOverflow:true,noJsErrors:true});
 }catch(e){outcome.error=String(e.message||e).slice(0,650)}
 result.checks.push(outcome);
 console.log("ZOKIVO_UX_CASE="+JSON.stringify(outcome));
 await ctx.close();
}
async function creator(page){
 await page.goto(ORIGIN+"/create",{waitUntil:"domcontentloaded",timeout:35000});
 await page.getByRole("heading",{name:/Make your next great quiz/}).waitFor({timeout:26000});
 await page.getByPlaceholder("e.g. Polar Worlds Challenge").fill("QA in browser - unsaved");
 const section=page.locator("details.zk-single-question").first();
 await section.locator("summary").click();
 await page.getByPlaceholder("Type your question here…").fill("Which number is even?");
 await page.getByRole("button",{name:"Mark answer B correct"}).click();
 assert(await page.getByRole("button",{name:"Mark answer B correct"}).getAttribute("aria-pressed")==="true","Correct answer button did not update");
 await page.locator(".zk-question-helpers button").nth(1).click();
 await page.locator(".zk-math-keys button").filter({hasText:"π"}).click();
 const formula=await page.locator(".quiz-media-editor input[placeholder*='frac']").inputValue().catch(async()=>page.locator(".quiz-media-editor input").last().inputValue());
 assert(formula.includes("pi"),"Math notation not inserted");
 assert(await page.locator(".zk-creator-answer").count()===4,"Four answer tiles missing");
 await page.screenshot({path:"ux-browser-proof/creator-"+(await page.evaluate(()=>innerWidth))+".png",fullPage:true});
 return{questionEditor:true,correctAnswerChooser:true,mathPalette:true,noDataSaved:true};
}
async function paper(page){
 await page.goto(ORIGIN+"/paper",{waitUntil:"domcontentloaded",timeout:35000});
 await page.getByRole("heading",{name:/One teacher\. A whole class/}).waitFor({timeout:27000});
 assert(await page.locator(".zk-paper-three article").count()===3,"Three classroom steps are not visible");
 assert(await page.getByRole("link",{name:/Get printable cards/}).count()===1,"Print link not found");
 assert(await page.getByRole("link",{name:/Try the camera first/}).count()===1,"Camera test link not found");
 await page.screenshot({path:"ux-browser-proof/paper-"+(await page.evaluate(()=>innerWidth))+".png",fullPage:true});
 await page.goto(ORIGIN+"/paper/check",{waitUntil:"domcontentloaded",timeout:35000});
 await page.getByRole("heading",{name:/Is your camera ready/}).waitFor({timeout:25000});
 await page.locator("#test-number").fill("2");
 await page.locator(".camera-choice-group button").nth(2).click();
 assert(await page.locator(".camera-choice-group button").nth(2).getAttribute("aria-pressed")==="true","C choice not selectable");
 assert(await page.locator(".camera-result-letters>div").count()===4,"Four-direction report missing");
 await page.screenshot({path:"ux-browser-proof/camera-check-"+(await page.evaluate(()=>innerWidth))+".png",fullPage:true});
 return{paperSteps:3,cameraCheckControls:true,cardNumberEditable:true,physicalCameraTest:false};
}
async function hostRound(page,ctx,advance){
 let calls=0,index=0;
 await ctx.addInitScript(pin=>{sessionStorage.setItem("host:"+pin,"qa-local-only")},PIN);
 await ctx.route("**/api/rooms/**",async route=>{
  const req=route.request(),pathname=new URL(req.url()).pathname;
  if(pathname!=="/api/rooms/"+PIN&&pathname!=="/api/rooms/"+PIN+"/start")return route.continue();
  if(req.method()==="POST"&&pathname.endsWith("/start")){
   calls++;index=1;
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"playing",index:1})});
  }
  const ready=advance&&index===0;
  const body={status:"playing",index,total:3,deadline:new Date(Date.now()+45000).toISOString(),
   serverTime:new Date().toISOString(),allAnswered:true,roundReady:ready,rewardsPending:!advance,
   scoreGoal:null,scoreboardPhase:"previous-round",answeredCount:2,muteSounds:true,
   gameMode:advance?"quiz_party":"gold_quest",
   players:[{id:"qa1",nickname:"Learner 1",avatar_id:"spark",score:100,mode_score:0},
            {id:"qa2",nickname:"Learner 2",avatar_id:"spark",score:150,mode_score:0}],
   question:{question:index===0?"What is the capital of Malaysia?":"What is 2 + 2?",choices:["Kuala Lumpur","Tokyo","Paris","Rome"]},
   answeredIds:[],viewer:{host:true,playerId:null,mode:null}};
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
 });
 await page.goto(ORIGIN+"/game/"+PIN+"?host=1",{waitUntil:"domcontentloaded",timeout:35000});
 await page.locator(".zk-answer-pads .zk-answer-pad").first().waitFor({timeout:28000});
 if(advance){
  await page.waitForFunction(()=>document.body.innerText.includes("What is 2 + 2?"),{timeout:9000});
  assert(calls===1,"Expected exactly one automatic host advance, got "+calls);
 }else{
  await page.waitForTimeout(2400);
  assert(calls===0,"Round skipped while owed bonuses were still pending");
  assert(await page.getByRole("button",{name:/Waiting for bonuses/}).isDisabled(),"Should disable host next while rewards pending");
 }
 await page.screenshot({path:"ux-browser-proof/host-"+(advance?"advance":"reward-pending")+"-"+(await page.evaluate(()=>innerWidth))+".png",fullPage:true});
 return{mockedHost:true,serverReadiness:advance,bonusSafeguard:!advance,actualHostStartPosts:calls};
}
async function studentWaiting(page,ctx){
 await ctx.addInitScript(pin=>sessionStorage.setItem("player:"+pin,"qa-local-only"),PIN);
 await ctx.route("**/api/rooms/**",async route=>{
  if(route.request().method()!=="GET")return route.continue();
  const body={status:"playing",index:0,total:3,deadline:new Date(Date.now()+4000).toISOString(),
   serverTime:new Date().toISOString(),allAnswered:false,roundReady:false,rewardsPending:false,
   gameMode:"quiz_party",scoreboardPhase:"previous-round",answeredCount:1,players:[
    {id:"qa1",nickname:"Learner 1",score:100,avatar_id:"spark"},
    {id:"qa2",nickname:"Learner 2",score:0,avatar_id:"spark"}],
   answeredIds:["qa1"],question:{question:"What is 1 + 1?",choices:["2","4","6","8"]},
   viewer:{host:false,playerId:"qa1",mode:null,result:null}};
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
 });
 await page.goto(ORIGIN+"/game/"+PIN,{waitUntil:"domcontentloaded",timeout:35000});
 await page.getByRole("heading",{name:/Answer sent!/}).waitFor({timeout:26000});
 const wait=await page.locator(".zk-wait-counter").innerText();
 assert(wait.includes("Waiting for classmates"),"Answered student still sees mandatory countdown: "+wait);
 assert(!/\ds left/i.test(wait),"Answered student still sees seconds: "+wait);
 await page.screenshot({path:"ux-browser-proof/student-wait-"+(await page.evaluate(()=>innerWidth))+".png",fullPage:true});
 return{noForcedCountdown:true,waitMessage:wait};
}
try{
 for(const view of viewportSizes){
  await caseRun("Creator editor",view,creator);
  await caseRun("Paper and camera check",view,paper);
  await caseRun("Host advances when all answers settled",view,(p,c)=>hostRound(p,c,true));
  await caseRun("Host waits for mini-game rewards",view,(p,c)=>hostRound(p,c,false));
  await caseRun("Student has no forced countdown",view,studentWaiting);
 }
}finally{await browser.close()}
result.pass=result.checks.length===10&&result.checks.every(x=>x.pass);
await writeFile("ux-browser-proof/report.json",JSON.stringify(result,null,2));
console.log("ZOKIVO_PRODUCTION_BROWSER_RESULT="+JSON.stringify({pass:result.pass,cases:result.checks.map(x=>({name:x.name,viewport:x.viewport,pass:x.pass,error:x.error}))}));
if(!result.pass)process.exitCode=1;
