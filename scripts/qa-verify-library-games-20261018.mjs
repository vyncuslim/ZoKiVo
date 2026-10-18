import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
const ORIGIN="https://zokivo.vercel.app";
await mkdir("qa-release-evidence",{recursive:true});
const results={build:"4180f203",host:ORIGIN,at:new Date().toISOString(),physicalDevices:0,writeOperations:0,api:[],browser:[]};
async function api(label,path,validate){
 const r=await fetch(ORIGIN+path,{signal:AbortSignal.timeout(20000)});
 const j=await r.json();
 const ok=r.status===200&&validate(j);
 results.api.push({name:label,httpStatus:r.status,total:j.total,returned:j.quizzes?.length,pass:ok});
 if(!ok)throw Error("API "+label+" failed: "+JSON.stringify({status:r.status,total:j.total,items:j.quizzes?.map(q=>q.title)}));
}
await api("First Discover page of 40","/api/quizzes?limit=24&page=1",j=>j.total===40&&j.quizzes?.length===24&&j.hasMore&&j.quizzes.every(q=>q.status==="published"&&q.publisher_name==="ZoKivo"));
await api("Discover second page","/api/quizzes?limit=24&page=2",j=>j.total===40&&j.quizzes?.length===16&&!j.hasMore);
await api("Music subject","/api/quizzes?subject=Music&limit=24&page=1",j=>j.total===1&&j.quizzes?.[0]?.question_count===20&&j.quizzes[0].publisher_name==="ZoKivo");
await api("Original Art title search","/api/quizzes?search=Art%20%26%20Design&limit=24",j=>j.total===1&&j.quizzes[0].title==="Art & Design Basics");
const b=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 for(const view of [{name:"desktop",w:1366,h:768},{name:"mobile",w:390,h:844}]){
  const context=await b.newContext({viewport:{width:view.w,height:view.h},locale:"en-US"});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  try{
   await page.goto(ORIGIN+"/library",{waitUntil:"domcontentloaded",timeout:35000});
   await page.getByRole("heading",{name:/Find your next favorite quiz/}).waitFor({timeout:30000});
   await page.locator(".zk-discover-card").first().waitFor({timeout:25000});
   const label=await page.locator("label.zk-visually-hidden").evaluate(e=>({className:e.className,
    position:getComputedStyle(e).position,clip:getComputedStyle(e).clipPath,w:Math.round(e.getBoundingClientRect().width)}));
   if(label.position!=="absolute"||label.w>2)throw Error("Leaked visible search label "+JSON.stringify(label));
   let covers=await page.locator(".zk-discover-card").count();
   if(covers!==24)throw Error("Expected 24 visible cards, got "+covers);
   const publishers=await page.getByText("Published by ZoKivo").count();
   if(publishers!==24)throw Error("Expected 24 official publisher labels, got "+publishers);
   await page.getByRole("button",{name:"Music",exact:true}).click();
   await page.getByRole("status").filter({hasText:"1 public quiz available"}).waitFor({timeout:20000});
   if(await page.locator(".zk-discover-card").count()!==1)throw Error("Music subject chip failed");
   await page.locator("#zk-search-quizzes").fill("Art & Design");
   await page.getByRole("button",{name:"Search",exact:true}).click();
   // Combined filters are intentional. Reset subject and retain text query.
   await page.getByRole("button",{name:/Clear filters/}).click();
   await page.locator("#zk-search-quizzes").fill("Art & Design");
   await page.getByRole("button",{name:"Search",exact:true}).click();
   await page.getByRole("status").filter({hasText:"1 public quiz available"}).waitFor({timeout:20000});
   if((await page.locator(".zk-discover-card h3").first().innerText())!=="Art & Design Basics")throw Error("Search returned incorrect set");
   const lwidth=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
   if(lwidth.scroll>lwidth.w+3)throw Error("Library horizontal overflow "+JSON.stringify(lwidth));
   await page.screenshot({path:"qa-release-evidence/library-"+view.name+".png",fullPage:true});
   await page.goto(ORIGIN+"/games",{waitUntil:"domcontentloaded",timeout:35000});
   await page.getByRole("heading",{name:/What would you like to play/}).waitFor({timeout:20000});
   if(await page.locator(".zk-games-action").count()!==4||await page.locator(".zk-games-mode").count()!==5)throw Error("Games must show four primary actions and five playable modes");
   const links=await page.locator(".zk-games-action").evaluateAll(nodes=>nodes.map(x=>x.getAttribute("href")));
   for(const href of ["/library","/host","/play","/study"])if(!links.includes(href))throw Error("Missing main action "+href);
   const gwidth=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
   if(gwidth.scroll>gwidth.w+3)throw Error("Games horizontal overflow "+JSON.stringify(gwidth));
   if(errors.length)throw Error("Uncaught JS errors "+errors.join("; "));
   await page.screenshot({path:"qa-release-evidence/games-"+view.name+".png",fullPage:true});
   results.browser.push({viewport:view.name,pass:true,searchLabelHidden:true,officialLabels:publishers,firstPageCovers:covers,filteredMusic:1,searchWorks:true,gamesActions:4,availableModes:5,noOverflow:true,noJsErrors:true});
  }catch(e){
   results.browser.push({viewport:view.name,pass:false,error:String(e.message||e).slice(0,550)});
  }
  console.log("RELEASE_BROWSER="+JSON.stringify(results.browser.at(-1)));
  await context.close();
 }
}finally{await b.close()}
results.pass=results.browser.length===2&&results.browser.every(x=>x.pass)&&results.api.every(x=>x.pass);
await writeFile("qa-release-evidence/report.json",JSON.stringify(results,null,2));
console.log("RELEASE_ACCEPTANCE="+JSON.stringify({pass:results.pass,api:results.api,browser:results.browser}));
if(!results.pass)process.exitCode=1;
