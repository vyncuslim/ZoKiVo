import {chromium,devices} from "playwright";
import {writeFile,mkdir} from "node:fs/promises";
import {performance} from "node:perf_hooks";

const ORIGIN="https://zokivo.vercel.app", PIN="991827";
const FIXTURE={title:"QA English Year 7",id:"b91f4600-1000-4000-8000-000000000001",question_count:4,subject:"English"};
const out={source:"PRODUCTION_UI_WITH_INTERCEPTED_QA_APIS",url:ORIGIN,startedAt:new Date().toISOString(),
 physicalDevices:0,accountLogins:0,realGameRoomsCreated:0,scenarios:[]};
await mkdir("ux-evidence",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});

async function setup(context,state){
 await context.route("**/api/quizzes",async r=>{
  if(r.request().method()==="GET")return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({quizzes:[FIXTURE]})});
  return r.continue();
 });
 await context.route("**/api/avatars",async r=>r.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({avatars:[{id:"spark",unlocked:true}],equipped:"spark"})}));
 await context.route("**/api/rooms/**",async route=>{
  const request=route.request(),method=request.method(),url=new URL(request.url());
  const path=url.pathname;
  if(!path.startsWith("/api/rooms/"+PIN))return route.continue();
  const respond=(status,obj)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(obj),
    headers:{"Cache-Control":"no-store"}});
  if(method==="GET"&&path.endsWith("/settings"))return respond(200,{acceptingPlayers:true,randomNames:false});
  if(method==="POST"&&path.endsWith("/join")){
   state.joined=true;
   return respond(200,{token:"qa-browser-player-token",nickname:"QA Student"});
  }
  if(method==="POST"&&path.endsWith("/start")){state.started=true;return respond(200,{ok:true})}
  if(method==="POST"&&path.endsWith("/answer")){
   const body=request.postDataJSON();state.answered=true;state.answerChoice=body.choice;
   return respond(200,{accepted:true});
  }
  if(method==="POST"&&path.endsWith("/reward")){
   state.rewardClaimed=true;state.rewardReady=false;
   return respond(200,{reward:{outcome:"Lucky Star",earned:10}});
  }
  if(method==="GET"&&path===("/api/rooms/"+PIN)){
   const host=Boolean(request.headers()["x-host-token"]);
   const playerId="qa-player-01";
   const started=state.started===true;
   const answered=state.answered===true;
   return respond(200,{
    status:started?"playing":"lobby",index:0,total:4,deadline:started?new Date(Date.now()+90000).toISOString():null,
    serverTime:new Date().toISOString(),scoreboardPhase:"previous-round",answeredCount:answered?1:0,
    gameMode:state.mode||"gold_quest",muteSounds:true,scoreGoal:null,
    question:started?{question:"Which word is an adjective?",choices:["Quickly","Wonderful","Run","Yesterday"]}:null,
    players:[{id:playerId,nickname:"QA Student",score:0,avatar_id:"spark",mode_score:0}],
    answeredIds:answered?[playerId]:[],
    viewer:{host,playerId:host?null:playerId,mode:host?null:{reward_ready:answered&&state.rewardReady!==false,
     credits:state.rewardClaimed?10:0,fish:0,served:0,cafe_level:1,defense_code:1}}
   });
  }
  return route.continue();
 });
 await context.route("**/api/rooms",async route=>{
  if(route.request().method()!=="POST")return route.continue();
  state.created=true;state.createSettings=route.request().postDataJSON();
  state.mode=state.createSettings.gameMode||"quiz_party";
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({pin:PIN,token:"qa-browser-host-token"})});
 });
}
function metrics(page){
 return page.evaluate(()=>{
  const input=document.querySelector("#game-pin");
  const pads=[...document.querySelectorAll(".zk-answer-pad")];
  return {viewport:{w:innerWidth,h:innerHeight},htmlWidth:document.documentElement.scrollWidth,
   bodyWidth:document.body.scrollWidth,visibleQuestion:!!document.querySelector(".zk-quiz-play h2"),
   answerButtons:pads.length,
   buttonSizes:pads.map(b=>{let x=b.getBoundingClientRect();return {w:Math.round(x.width),h:Math.round(x.height)}}),
   answerColorCount:new Set(pads.map(b=>getComputedStyle(b).backgroundColor)).size,
   missingInputLabels:[...document.querySelectorAll("#game-pin,#nickname")].filter(x=>!document.querySelector('label[for="'+x.id+'"]')).map(x=>x.id),
   links:[...document.querySelectorAll('a[href]')].filter(a=>a.getBoundingClientRect().width===0).slice(0,8).map(a=>a.textContent?.trim()?.slice(0,25)),
   pinValue:input?.value||""};
 });
}
async function record(label,callback,options={}){
 const state={mode:"gold_quest",started:false,answered:false,rewardReady:true};
 const viewport=options.viewport||{width:1440,height:900};
 const context=await browser.newContext({viewport,isMobile:!!options.mobile,hasTouch:!!options.mobile,deviceScaleFactor:options.mobile?2:1,locale:"en-US"});
 await setup(context,state);
 const page=await context.newPage();
 const errors=[],badHttp=[];
 page.on("pageerror",e=>errors.push(e.message.slice(0,220)));
 page.on("response",r=>{if(r.status()>=500||r.status()===429)badHttp.push({status:r.status(),path:new URL(r.url()).pathname})});
 const begin=performance.now();
 let entry={scenario:label,viewport:viewport,mobile:!!options.mobile};
 try{
  const details=await callback(page,state,label);
  entry={...entry,pass:true,elapsedMs:Math.round(performance.now()-begin),...details};
  if(errors.length||badHttp.length)throw Error("Unexpected script errors or 429/5xx");
 }catch(e){entry.pass=false;entry.error=String(e.message||e).slice(0,850);}
 entry.consoleErrors=errors;entry.serverErrors=badHttp;
 out.scenarios.push(entry);
 console.log("UX_CASE="+JSON.stringify(entry));
 await context.close();
}

async function teacher(page,state,label){
 await page.goto(ORIGIN+"/host",{waitUntil:"domcontentloaded",timeout:35000});
 await page.getByRole("heading",{name:"Host a game"}).waitFor({timeout:25000});
 await page.waitForTimeout(900);
 const before=await page.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 if(before.scrollWidth>before.innerWidth+3)throw Error("Teacher horizontal scroll overflow: "+JSON.stringify(before));
 const select=page.locator("#host-quiz-simple");
 await select.waitFor();await select.selectOption(FIXTURE.id);
 const radio=page.getByRole("radio",{name:/Gold Quest/});await radio.click();
 if(await radio.getAttribute("aria-checked")!=="true")throw Error("Gold Quest selection not reflected");
 await page.screenshot({path:"ux-evidence/"+label+"-host.png",fullPage:true});
 const advanced=page.locator(".zk-simple-advanced");
 if(await advanced.getAttribute("open")!==null)throw Error("Advanced settings should be collapsed");
 await advanced.locator("summary").click();
 await page.locator(".host-options select").first().selectOption("30");
 await page.getByRole("button",{name:/Create game room/}).click();
 await page.waitForURL(new RegExp("/game/"+PIN+"\\?host=1"),{timeout:25000});
 await page.getByText("PLAYERS READY").first().waitFor({timeout:16000}).catch(()=>{});
 if(!state.created||state.createSettings.questionSeconds!==30||state.createSettings.gameMode!=="gold_quest")
  throw Error("Host settings were not submitted to API: "+JSON.stringify(state.createSettings));
 const lobby=await metrics(page);
 await page.screenshot({path:"ux-evidence/"+label+"-lobby.png",fullPage:true});
 await page.getByRole("button",{name:/Start game/}).click();
 await page.locator(".zk-answer-pads .zk-answer-pad").first().waitFor({timeout:25000});
 const game=await metrics(page);
 if(game.htmlWidth>game.viewport.w+3)throw Error("Host game horizontal overflow "+JSON.stringify(game));
 if(game.answerButtons!==4||game.answerColorCount!==4)throw Error("Question choices not distinct");
 await page.screenshot({path:"ux-evidence/"+label+"-question.png",fullPage:true});
 return {hostSettingsPassed:true,mode:"gold_quest",advancedDefaultCollapsed:true,lobby,game};
}
async function student(page,state,label){
 state.started=true;
 await page.goto(ORIGIN+"/play",{waitUntil:"domcontentloaded",timeout:35000});
 await page.locator("#nickname").waitFor({timeout:20000});
 await page.waitForTimeout(900);
 await page.locator("#game-pin").fill(PIN);
 await page.locator("#nickname").fill("QA Student");
 const choices=page.locator(".zk-avatar-options");
 if(await choices.getAttribute("open")!==null)throw Error("Avatar options should start closed");
 await choices.locator("summary").click();
 if((await page.locator(".zokivo-avatar-option").count())<4)throw Error("Avatar picker missing");
 await choices.locator("summary").click();
 let before=await metrics(page);
 if(before.htmlWidth>before.viewport.w+3||before.bodyWidth>before.viewport.w+3)
   throw Error("Student join overflow "+JSON.stringify(before));
 await page.screenshot({path:"ux-evidence/"+label+"-join.png",fullPage:true});
 await page.getByRole("button",{name:/Join game/}).click();
 await page.waitForURL(new RegExp("/game/"+PIN+"(?:\\?|$)"),{timeout:26000});
 await page.locator(".zk-answer-pads .zk-answer-pad").first().waitFor({timeout:26000});
 const quiz=await metrics(page);
 if(quiz.htmlWidth>quiz.viewport.w+3||quiz.answerButtons!==4||quiz.answerColorCount!==4)
  throw Error("Question UI overflow or choices missing "+JSON.stringify(quiz));
 if(quiz.buttonSizes.some(x=>x.h<44||x.w<90))throw Error("Answer touch target too small");
 await page.screenshot({path:"ux-evidence/"+label+"-question.png",fullPage:true});
 await page.getByRole("button",{name:"Answer B: Wonderful"}).click();
 await page.getByRole("heading",{name:/Bonus unlocked!/}).waitFor({timeout:20000});
 await page.getByRole("button",{name:/Starlight pod/}).click();
 await page.getByRole("heading",{name:/Bonus collected!/}).waitFor({timeout:20000});
 await page.getByText(/You earned: Lucky Star · 10 virtual credits/).waitFor({timeout:20000});
 await page.screenshot({path:"ux-evidence/"+label+"-reward.png",fullPage:true});
 if(state.answerChoice!==1||!state.rewardClaimed)throw Error("Mocked answer and reward request not issued correctly");
 return {join:true,avatarOptional:true,question:quiz,answerChoice:state.answerChoice,correctSequence:true,rewardClaimed:true};
}
try{
 await record("teacher-desktop",teacher,{viewport:{width:1440,height:900}});
 await record("teacher-phone",teacher,{viewport:{width:390,height:844},mobile:true});
 await record("student-desktop",student,{viewport:{width:1366,height:768}});
 await record("student-phone",student,{viewport:{width:390,height:844},mobile:true});
 await record("student-small-phone",student,{viewport:{width:360,height:740},mobile:true});
}finally{await browser.close()}
out.completedAt=new Date().toISOString();
out.pass=out.scenarios.every(x=>x.pass)&&out.scenarios.length===5;
await writeFile("ux-evidence/qa-experience-results.json",JSON.stringify(out,null,2));
console.log("PRODUCTION_UI_EXPERIENCE_RESULT="+JSON.stringify({pass:out.pass,scenarios:out.scenarios.map(x=>({name:x.scenario,pass:x.pass,error:x.error}))}));
if(!out.pass)process.exitCode=1;
