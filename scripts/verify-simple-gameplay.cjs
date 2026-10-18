const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript");
const file=p=>fs.readFileSync(p,"utf8");let assertions=0;
function ok(x,desc){assert.ok(x,desc);assertions++}
const host=file("src/app/host/page.tsx"),play=file("src/app/play/page.tsx"),
 game=file("src/app/game/[pin]/page.tsx"),reward=file("src/components/mode-rewards.tsx"),
 layout=file("src/app/layout.tsx"),css=file("src/app/easy-play.css");
for(const [path,src] of [
 ["src/app/host/page.tsx",host],["src/app/play/page.tsx",play],
 ["src/app/game/[pin]/page.tsx",game],["src/components/mode-rewards.tsx",reward],
 ["src/app/layout.tsx",layout]
]){
 const result=ts.transpileModule(src,{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 ok(!result.diagnostics?.length,"TSX parses: "+path);
}
ok(host.includes("Pick your quiz")&&host.includes("Choose how to play")&&host.includes("Invite your class"),"Host has three obvious steps");
ok(host.includes('<details className="zk-simple-advanced"'),"Host advanced controls default collapsed");
ok(host.includes("gameMode,randomQuestionOrder:shuffle"),"Room game mechanics submitted to existing API");
ok(host.includes("allowLateJoining:lateJoin"),"Host controls preserved");
ok(host.includes("setQuestionSeconds")&&host.includes("[10,15,20,30,45,60]"),"Host timer remains available");
ok(play.includes("game-pin")&&play.includes("nickname")&&play.includes("Join game"),"Student can join with PIN and name");
ok(play.includes('<details className="zk-simple-advanced zk-avatar-options"'),"Avatar options available without blocking joining");
ok(play.includes("!roomOpen")&&play.includes("sessionStorage.setItem"),"Join permission and session token flow preserved");
ok(game.includes("zk-answer-pads")&&game.includes('["✦","●","◆","▲"]'),"Original four-symbol choices");
ok(game.includes("aria-label={\"Answer \"+letters[i]+\": \"+label}"),"Each answer is screen-reader accessible");
ok(game.includes('disabled={host||answered||seconds===0||busy}'),"Cannot answer twice or after time limit from UI");
ok(game.includes('act("answer",i)'),"Real server answer submission preserved");
ok(game.includes("state.viewer.mode?.reward_ready")&&game.includes("<ModeRewards"),"Mini-games offered only after server indicates reward eligibility");
ok(game.includes('state.scoreboardPhase==="previous-round"'),"Current-round scores stay hidden");
ok(reward.includes('await onClaim()')&&reward.includes('"x-player-token":token'),"Minigame rewards use authenticated server endpoint");
ok(reward.includes('"chest"')&&reward.includes('"hack"')&&reward.includes('"fish"')&&reward.includes('"serve"'),"All four existing reward modes retained");
ok(reward.includes("<details")&&reward.includes("code challenge"),"Optional strategic controls do not overwhelm students");
ok(css.includes(".zk-answer-pads.answer-grid")&&css.includes("grid-template-columns:repeat(2"),"Two by two answer grid responsive");
ok(css.includes("prefers-reduced-motion"),"Respects reduced motion preference");
ok(layout.includes('import "./easy-play.css"'),"Simple original ZoKivo styles included");
ok(layout.includes('className="zk-more-menu"'),"Non-primary links kept in More menu");
ok(!host.includes("Blooket")&&!game.includes("Blooket")&&!reward.includes("Blooket"),"No competitor brand copied into ZoKivo game UI");
console.log("ZOKIVO_SIMPLE_GAMEPLAY_TEST_PASS="+JSON.stringify({assertions}));
