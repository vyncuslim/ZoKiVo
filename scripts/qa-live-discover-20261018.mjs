import {chromium} from "playwright";
import {writeFile,mkdir} from "node:fs/promises";
const BASE="https://zokivo.vercel.app";
const report={origin:BASE,executedAt:new Date().toISOString(),physicalDevices:0,productionDatabaseWrites:0,api:[],browser:[]};
await mkdir("discover-smoke-evidence",{recursive:true});
async function call(label,path,check){
 const res=await fetch(BASE+path,{cache:"no-store",signal:AbortSignal.timeout(18000),headers:{Accept:"application/json"}});
 const data=await res.json();
 const ok=res.status===200&&check(data);
 report.api.push({label,status:res.status,total:data.total,returned:data.quizzes?.length,pass:ok});
 if(!ok)throw Error(label+" failed "+res.status+" "+JSON.stringify({total:data.total,resultNames:data.quizzes?.map(x=>x.title)}));
}
await call("public 16 sets","/api/quizzes?limit=24&page=1",j=>j.total===16&&j.quizzes?.length===16&&j.quizzes.every(x=>x.status==="published"));
await call("IQ search","/api/quizzes?search=IQ&limit=24&page=1",j=>j.total===2&&j.quizzes?.some(x=>/Logic/.test(x.title))&&j.quizzes?.some(x=>/VEX/.test(x.title)));
await call("Maths category","/api/quizzes?subject=Mathematics&limit=24&page=1",j=>j.total===2&&j.quizzes.reduce((sum,x)=>sum+x.question_count,0)===60);
await call("Chinese category","/api/quizzes?subject="+encodeURIComponent("中文")+"&limit=24&page=1",j=>j.total===1&&j.quizzes[0].language==="zh");
await call("BM category","/api/quizzes?subject="+encodeURIComponent("Bahasa Melayu")+"&limit=24&page=1",j=>j.total===1&&j.quizzes[0].language==="ms");
let first=[];
await call("pagination first","/api/quizzes?limit=8&page=1",j=>{first=j.quizzes.map(x=>x.id);return j.total===16&&j.quizzes?.length===8&&j.hasMore===true});
await call("pagination second","/api/quizzes?limit=8&page=2",j=>j.total===16&&j.quizzes?.length===8&&j.hasMore===false&&j.quizzes.every(q=>!first.includes(q.id)));
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 for(const view of [{name:"desktop",width:1366,height:768},{name:"phone",width:390,height:844}]){
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},locale:"en-US"});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  let caseResult={view:view.name,pass:false};
  try{
   await page.goto(BASE+"/library",{waitUntil:"domcontentloaded",timeout:30000});
   await page.getByRole("heading",{name:/Discover something amazing/}).waitFor({timeout:25000});
   await page.locator(".zk-discover-card").first().waitFor({timeout:25000});
   const initial=await page.locator(".zk-discover-card").count();
   if(initial!==16)throw Error("Expected 16 cards but got "+initial);
   await page.locator("#zk-search-quizzes").fill("IQ");
   await page.getByRole("button",{name:/Search/}).click();
   await page.getByRole("status").filter({hasText:"2 public quizzes available"}).waitFor({timeout:25000});
   if(await page.locator(".zk-discover-card").count()!==2)throw Error("IQ cards did not filter");
   await page.getByRole("button",{name:/Clear filters/}).click();
   await page.locator(".zk-discover-card").first().waitFor({timeout:20000});
   await page.getByRole("combobox",{name:/Filter public quiz by subject/}).selectOption("Mathematics");
   await page.getByRole("status").filter({hasText:"2 public quizzes available"}).waitFor({timeout:25000});
   const mathCards=await page.locator(".zk-discover-card").count();
   if(mathCards!==2)throw Error("Math filter expected 2, got "+mathCards);
   if(await page.locator(".zk-quiz-card-actions a").count()!==4)throw Error("Host and Study links missing");
   const box=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,w:window.innerWidth}));
   if(box.scroll>box.w+3)throw Error("Horizontal overflow "+JSON.stringify(box));
   if(errors.length)throw Error("Uncaught JavaScript error "+errors.join("; "));
   await page.screenshot({path:"discover-smoke-evidence/discover-"+view.name+".png",fullPage:true});
   caseResult={view:view.name,pass:true,initialCards:initial,iqCards:2,mathCards:2,horizontalOverflow:false,jsErrors:0};
  }catch(e){caseResult.error=String(e.message||e).slice(0,500);}
  report.browser.push(caseResult);
  console.log("DISCOVER_BROWSER_CASE="+JSON.stringify(caseResult));
  await context.close();
 }
}finally{await browser.close()}
report.pass=report.api.every(x=>x.pass)&&report.browser.length===2&&report.browser.every(x=>x.pass);
await writeFile("discover-smoke-evidence/report.json",JSON.stringify(report,null,2));
console.log("DISCOVER_PRODUCTION_SMOKE_RESULT="+JSON.stringify({pass:report.pass,api:report.api,browser:report.browser}));
if(!report.pass)process.exitCode=1;
