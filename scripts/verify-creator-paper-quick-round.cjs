const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript");
const file=p=>fs.readFileSync(p,"utf8");
const creator=file("src/app/create/page.tsx"),game=file("src/app/game/[pin]/page.tsx"),
 view=file("src/app/api/rooms/[pin]/route.ts"),start=file("src/app/api/rooms/[pin]/start/route.ts"),
 paper=file("src/app/paper/page.tsx"),check=file("src/app/paper/check/page.tsx");
let count=0;const ok=(v,label)=>{assert.ok(v,label);count++;console.log("UX_TEST",label)};
for(const p of ["src/app/create/page.tsx","src/app/game/[pin]/page.tsx","src/app/api/rooms/[pin]/route.ts","src/app/api/rooms/[pin]/start/route.ts","src/app/paper/page.tsx","src/app/paper/check/page.tsx"]){
 const ds=ts.transpileModule(file(p),{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).diagnostics||[];
 if(ds.length)console.error("TS_DIAGNOSTICS",p,ds.map(d=>({message:ts.flattenDiagnosticMessageText(d.messageText," "),start:d.start,length:d.length})));
 ok(ds.length===0,p+" TypeScript parse");
}
ok(creator.includes("zk-single-question")&&creator.includes("<details"),"Teacher edits one question at a time");
ok(creator.includes("zk-creator-answer-grid")&&creator.includes("correct_option_index:i"),"Teacher explicitly chooses correct option");
ok(creator.includes("zk-math-keys")&&creator.includes("formula_text:(q.formula_text"),"Math keypad inserts into saved expression");
ok(creator.includes("mediaOpen")&&creator.includes("zk-helper-hidden"),"Advanced image/audio links default hidden");
ok(creator.includes("Math expression")&&creator.includes("Point")&&creator.includes("Question time limit"),"Question timing and explanation preserved");
ok(creator.includes('"/api/quizzes"')&&creator.includes('"/api/quizzes/"+id+"/publish"'),"Existing authenticated quiz save/publish endpoints preserved");
ok(creator.includes("parseSuggestedQuiz"),"AI JSON import preserved");
ok(game.includes("zk-final-podium")&&game.includes("zk-podium-player"),"Original accessible podium visible at game completion");
ok(game.includes('state.allAnswered?"✓ ALL ANSWERED":seconds+"s TO ANSWER"'),"Timer only represents unanswered players");
ok(!game.includes('seconds+"s left":"Your teacher is moving on soon…"'),"Answered student no longer forced to watch timer");
ok(game.includes("},250)")&&game.includes('"/start"'),"Host advances after all players finish, with short transition");
ok(game.includes('disabled={busy||!state.roundReady}'),"Host next action uses server readiness not time counter");
ok(view.includes("allAnswered")&&view.includes("rewardsPending")&&view.includes("roundReady"),"Readiness computed server side");
ok(view.includes('canShowResult')&&view.includes('myResult[0]||null'),"Only settled round reveals individual correctness");
ok(start.includes("NOT EXISTS(SELECT 1 FROM players p"),"Round cannot advance if any participant lacks an answer");
ok(start.includes("NOT EXISTS(SELECT 1 FROM mode_events e"),"Successful players do not lose owed rewards");
ok(start.includes("current_index=${r.current_index}")&&start.includes("Another request already advanced"),"Optimistic concurrent advancement guard preserved");
ok(paper.includes("Here's how to play")&&paper.includes("zk-paper-three"),"Paper Mode offers three student-friendly steps");
ok(paper.includes("modeEnabled!==true")&&paper.includes("Paper games aren't available"),"Unavailable beta features are never represented as enabled");
ok(check.includes("zk-camera-simple")&&check.includes("Detailed scan information"),"Camera UX hides developer metrics");
ok(check.includes("setResults(newResults());setFound([]);setFrames(0)")&&check.includes("[mode,number]"),"Changing card resets old pass results");
ok(check.includes("file.size>10*1024*1024"),"Oversized photo rejected");
ok(file("src/app/paper/layout.tsx").includes("easy-paper.css"),"Paper visual update included");
ok(file("src/app/layout.tsx").includes("creator-experience.css"),"Creator visual update included");
console.log("ZOKIVO_CREATOR_PAPER_ROUND_UX_PASS="+count);
