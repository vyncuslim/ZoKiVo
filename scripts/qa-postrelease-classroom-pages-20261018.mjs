import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
const base="https://zokivo.vynalthai.com";
const report={url:base,kind:"REAL_DEPLOYED_FRONTEND_READ_ONLY",physicalCameraTests:0,realRoomWrites:0,scenarios:[]};
await mkdir("qa-classroom-evidence",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 for(const v of [{label:"desktop",width:1366,height:768},{label:"phone",width:390,height:844}]){
  const ctx=await browser.newContext({viewport:{width:v.width,height:v.height},hasTouch:v.label==="phone",isMobile:v.label==="phone"});
  const page=await ctx.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  for(const screen of [
   {path:"/create",required:".zk-creator-studio",check:async()=>{
    await page.locator(".zk-single-question").first().waitFor({timeout:25000});
    if(!(await page.locator(".zk-single-question").first().evaluate(e=>e.open)))throw Error("First question editor is not open");
    if(await page.getByRole("button",{name:/Mark answer B correct/}).count()!==1)throw Error("Correct-answer control absent");
    await page.getByRole("button",{name:/Math & symbols/}).first().click();
    if(await page.locator(".zk-math-keys button").count()<6)throw Error("Math symbols missing");
   }},
   {path:"/paper",required:".zk-paper-simple",check:async()=>{
    await page.getByRole("heading",{name:/how to play/i}).waitFor({timeout:15000});
    if(await page.getByRole("link",{name:/Try the camera first/}).count()!==1)throw Error("Camera route missing");
    if(await page.getByRole("link",{name:/Get printable cards/}).count()!==1)throw Error("Cards route missing");
   }},
   {path:"/paper/check",required:".zk-camera-simple",check:async()=>{
    await page.locator(".camera-test-preview video").waitFor({timeout:15000});
    if(await page.locator(".camera-choice").count()!==4)throw Error("Need A/B/C/D");
    const buttons=await page.locator(".camera-choice").evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().height)));
    if(buttons.some(h=>h<44))throw Error("Touch targets smaller than 44px: "+JSON.stringify(buttons));
    if(await page.locator(".camera-test-preview video").count()!==1)throw Error("Camera video element missing");
   }}
  ]){
   const result={view:v.label,path:screen.path,pass:false};
   try{
    await page.goto(base+screen.path,{waitUntil:"domcontentloaded",timeout:40000});
    await page.locator(screen.required).waitFor({timeout:25000});
    await screen.check();
    const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    if(dimensions.scroll>dimensions.width+3)throw Error("Horizontal overflow "+JSON.stringify(dimensions));
    if(errors.length)throw Error("Uncaught JS error: "+errors.join("; "));
    await page.screenshot({path:"qa-classroom-evidence/"+v.label+"-"+screen.path.replaceAll("/","-")+".png",fullPage:true});
    result.pass=true;result.noHorizontalOverflow=true;result.javascriptErrors=0;
   }catch(e){result.error=String(e.message||e).slice(0,650);}
   report.scenarios.push(result);
   console.log("CLASSROOM_REAL_BROWSER="+JSON.stringify(result));
  }
  await ctx.close();
 }
}finally{await browser.close()}
report.pass=report.scenarios.length===6&&report.scenarios.every(x=>x.pass);
await writeFile("qa-classroom-evidence/result.json",JSON.stringify(report,null,2));
console.log("CLASSROOM_FRONTEND_POSTRELEASE="+JSON.stringify({pass:report.pass,scenarios:report.scenarios}));
if(!report.pass)process.exitCode=1;
