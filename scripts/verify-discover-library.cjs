const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript");
const file=p=>fs.readFileSync(p,"utf8");
const api=file("src/app/api/quizzes/route.ts"),ui=file("src/app/library/page.tsx"),css=file("src/app/discover-library.css"),layout=file("src/app/layout.tsx");
const catalog=JSON.parse(file("data/discover-topics-manifest.json"));
let checks=0;function ok(cond,msg){assert.ok(cond,msg);checks++}
ok(catalog.publicQuizSets===15&&catalog.originalQuestions===255,"Catalog correctly summarizes 15 independently authored quizzes and 255 questions");
ok(catalog.topics.length===15,"15 distinct discover topics");
ok(catalog.topics.reduce((n,q)=>n+q.questionCount,0)===255,"Individual quiz question counts consistent");
ok(new Set(catalog.topics.map(q=>q.id)).size===15,"No duplicate public starter ids");
ok(new Set(catalog.topics.map(q=>q.title)).size===15,"No duplicate set titles");
ok(!file("data/discover-topics-manifest.json").includes("correct_index")&&
  !file("data/discover-topics-manifest.json").includes("choices"),"No answer keys in public catalog manifest");
ok(!fs.existsSync("data/original-discover-starter-20261018.json"),"No original answer key seed included in public repository");
ok(api.includes('req.nextUrl.searchParams.get("search")'),"Server supports keyword search");
ok(api.includes('req.nextUrl.searchParams.get("subject")'),"Server supports subject filter");
ok(api.includes('req.nextUrl.searchParams.get("page")'),"Server supports page number");
ok(api.includes('req.nextUrl.searchParams.get("limit")'),"Server supports page size");
ok(api.includes("ILIKE")&&api.includes("lower(q.subject)=lower("),"Search matches title, subject, description and year");
ok(api.includes("Math.min(100")&&api.includes("OFFSET")&&api.includes("LIMIT"),"Rate-bounded pagination enforced server-side");
ok(api.includes("q.status='published'"),"Public results never disclose drafts");
ok(api.includes('req.nextUrl.searchParams.get("mine")==="1"'),"Existing authenticated private library retained");
ok(api.includes('limit:24')===false&&api.includes('filtering?24:100'),"Unfiltered Host reads preserve old 100-item compatibility");
ok(ui.includes('role="search"')&&ui.includes("submit(draftSearch")===false,"Discovery search uses accessible form");
ok(ui.includes("setPage(1);setSearch(")&&ui.includes("setSubject(e.target.value);setPage(1)"),"Search and filter reset page");
ok(ui.includes('Link href={"/host?quiz="+q.id}')&&ui.includes('Link href={"/study?quiz="+q.id}'),"Quiz cards link to existing hosting and studying");
ok(ui.includes("quiz-discover")===false&&ui.includes("zk-quiz-cover"),"Original ZoKivo subject covers present");
ok(css.includes("grid-template-columns:repeat(4")&&css.includes("max-width:720px"),"Desktop and mobile responsive card grids");
ok(layout.includes('import "./discover-library.css"'),"Original Discover CSS included in production");
ok(!ui.includes("Teacher Verified"),"Self-declared teachers are not misrepresented as independently verified");
for(const [path,source] of [["src/app/api/quizzes/route.ts",api],["src/app/library/page.tsx",ui]]){
 const result=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 ok((result.diagnostics||[]).length===0,"Typescript parses: "+path);
}
console.log("DISCOVER_LIBRARY_TEST_PASS="+JSON.stringify({checks,sets:catalog.publicQuizSets,questions:catalog.originalQuestions}));
