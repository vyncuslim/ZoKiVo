const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript");
const read=p=>fs.readFileSync(p,"utf8");const ui=read("src/app/library/page.tsx"),css=read("src/app/discover-library.css"),
games=read("src/app/games/page.tsx"),gcss=read("src/app/simple-games.css"),api=read("src/app/api/quizzes/route.ts"),
manifest=JSON.parse(read("data/discover-20261018-expansion-manifest.json"));let total=0;
function ok(x,msg){assert.ok(x,msg);total++;console.log("UI_ACCEPTANCE "+msg)}
ok(manifest.sets.length===24&&manifest.questionCount===480,"24 new sets and 480 original questions in expansion catalog");
ok(manifest.sets.reduce((n,x)=>n+x.questions,0)===480,"Manifest counts add up");
ok(new Set(manifest.sets.map(x=>x.id)).size===24,"No duplicate seed IDs");
ok(!read("data/discover-20261018-expansion-manifest.json").includes("correct_index"),"No correct answers committed to public repository");
ok(api.includes("CASE WHEN q.owner_user_id IS NULL THEN 'ZoKivo' ELSE 'Community teacher' END AS publisher_name"),"ZoKivo official publisher shown only for official rows");
ok(api.includes("q.status='published'"),"Only published quizzes discoverable");
ok(ui.includes('Published by {q.publisher_name||"Community teacher"}'),"Cards display honest publisher labels");
ok(ui.includes('className="zk-visually-hidden"')&&css.includes(".zk-discover-page .zk-visually-hidden"),"Accessible search label visually hidden");
ok(css.includes("clip-path:inset(50%)")&&css.includes("position:absolute!important"),"Label cannot overlap search input at desktop or phone sizes");
ok(ui.includes("zk-popular-subjects")&&ui.includes('setSubject(s);setPage(1)'),"Popular subject chips work");
ok(ui.includes("setPage(1);setSearch(draftSearch.trim())"),"Keyword search changes fetched results");
ok(ui.includes("zk-discover-pagination")&&api.includes("OFFSET"),"Bounded server pagination preserved");
ok(ui.includes('Link href={"/host?quiz="+q.id}')&&ui.includes('Link href={"/study?quiz="+q.id}'),"Public quiz cards support Host and Study");
ok(games.includes("Discover quizzes")&&games.includes("Host a game")&&games.includes("Join with PIN")&&games.includes("Study solo"),"Games page has four simple pathways");
ok(games.includes('id:"quiz_party"')&&games.includes('id:"gold_quest"')&&games.includes('id:"crypto_hack"')&&games.includes('id:"fishing_frenzy"')&&games.includes('id:"cafe"'),"All five playable modes remain available");
ok(games.includes("Team Clash and Speed Run are in development"),"Future modes are not misrepresented as playable");
ok(gcss.includes("@media(max-width:650px)")&&css.includes("@media(max-width:600px)"),"Mobile responsive styles exist for both pages");
ok(read("src/app/layout.tsx").includes('import "./simple-games.css"'),"Games style imported in production layout");
for(const p of ["src/app/library/page.tsx","src/app/api/quizzes/route.ts","src/app/games/page.tsx"]){
 const d=ts.transpileModule(read(p),{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).diagnostics||[];
 ok(d.length===0,p+" TSX parses");
}
console.log("DISCOVER_AND_GAMES_20261018_PASS="+total);
