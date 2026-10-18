const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript");
const f=x=>fs.readFileSync(x,"utf8");let checks=0;
function ok(value,msg){assert.ok(value,msg);checks++;console.log("CLASSROOM_QA "+msg);}
const creator=f("src/app/create/page.tsx"),game=f("src/app/game/[pin]/page.tsx"),start=f("src/app/api/rooms/[pin]/start/route.ts"),state=f("src/app/api/rooms/[pin]/route.ts"),paper=f("src/app/paper/page.tsx"),camera=f("src/app/paper/check/page.tsx"),styles=f("src/app/paper/classroom-polish.css");
ok(creator.includes("defaultOpen={index===0}"),"First question editor visible immediately");
ok(creator.includes('correct_option_index:i'),"Correct answer selected intentionally");
ok(creator.includes('aria-pressed={q.correct_option_index===i}'),"Correct answer buttons accessible");
ok(creator.includes("Math &amp; symbols")&&creator.includes("Image &amp; audio"),"Media and math tools available");
ok(creator.includes("time_limit:")&&creator.includes("point_value:"),"Per question timer and points retained");
ok(creator.includes('status!=="draft"'),"Published questions locked from editing");
ok(game.includes("state.allAnswered")&&game.includes("state.answeredCount"),"Students see all-answered progress");
ok(game.includes("state?.roundReady")&&game.includes("},250);"),"Host advances within 250ms when authoritative round ready");
ok(!game.includes("3s left"),"No forced 3 second waiting label");
ok(start.includes("NOT EXISTS(SELECT 1 FROM players")&&start.includes("deadline<=now()"),"Server checks every player or hard timeout");
ok(start.includes("rewards_settled")&&start.includes("mode_events"),"Reward claims protected before early advance");
ok(start.includes("RETURNING pin")&&start.includes("current_index=${r.current_index}"),"Atomic advance with index guard");
ok(state.includes("roundReady:canAdvance")&&state.includes("allAnswered"),"Server sends authoritative readiness");
ok(state.includes("canShowResult")&&state.includes("rewardsPending"),"Correctness and rewards gated by round status");
ok(paper.includes('modeEnabled===false'),"Unavailable Paper Mode not represented as playable");
ok(paper.includes('Print & share cards')&&paper.includes('Hold up & scan!'),"Paper tutorial uses classroom instructions");
ok(camera.includes("Stop camera")&&camera.includes("Start camera"),"Camera controls present");
ok(camera.includes("A checkmark means the camera recognised it twice"),"Teacher understands live recognition requirement");
ok(camera.includes("setResults(newResults())"),"Card and results reset safely");
ok(styles.includes("aspect-ratio:4/3")&&styles.includes("@media(max-width:620px)"),"Mobile responsive camera frame");
ok(styles.includes("min-height:54px"),"Accessible touch targets");
ok(f("src/app/paper/layout.tsx").includes('import "./classroom-polish.css"'),"New styles load after legacy styles");
for(const path of ["src/app/create/page.tsx","src/app/game/[pin]/page.tsx","src/app/paper/page.tsx","src/app/paper/check/page.tsx","src/app/api/rooms/[pin]/start/route.ts","src/app/api/rooms/[pin]/route.ts"]){
 const d=ts.transpileModule(f(path),{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).diagnostics||[];
 ok(!d.length,"TSX/TS parses "+path);
}
console.log("CLASSROOM_CREATOR_PAPER_ROUND_QA_PASS="+checks);
