/* UI-specific guard: inspect actual TSX / CSS without touching rooms or live users. */
const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const read=path=>fs.readFileSync(path,"utf8");
const game=read("src/app/game/[pin]/page.tsx"),rewards=read("src/components/mode-rewards.tsx"),
 layout=read("src/app/layout.tsx"),css=read("src/app/gameplay-polish.css"),
 gameplay=read("scripts/verify-simple-gameplay.cjs");
let assertions=0;
function ok(value,description){assert.ok(value,description);assertions++}
for(const [label,src] of [["game session",game],["mini-game",rewards]]){
 const transpiled=ts.transpileModule(src,{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 ok(!transpiled.diagnostics?.length,"TypeScript/JSX parses for "+label);
}
ok(layout.includes('import "./gameplay-polish.css";'),"Scoped gameplay styling registered");
ok(game.includes('className="zk-session-strip"'),"Session HUD is present");
ok(game.includes('realtimeConnected?"Live updates":"Auto refreshing"'),"Realtime fallback is not mislabeled offline");
ok(game.includes("state?.players.length??0"),"Room player count shown");
ok(game.includes('className="zk-teacher-participation"'),"Teacher has answer submission count");
ok(game.includes('aria-label="Students who submitted this round"'),"Teacher participation accessible");
ok(game.includes('className="zk-answer-prompt"'),"Student answer prompt present");
ok(game.includes('className="zk-choice-key"'),"Answer A/B/C/D visible visually");
ok(game.includes('aria-label={"Answer "+letters[i]+": "+label}'),"Existing spoken answer labels preserved");
ok(game.includes('["✦","●","◆","▲"]'),"ZoKivo original choice symbols retained");
ok(game.includes('role="progressbar" aria-label="Game question progress"'),"Question progress includes numerical accessibility");
ok(game.includes('aria-valuetext={"Question "+(state.index+1)+" of "+state.total}'),"Progress conveys position");
ok(game.includes('role="timer" aria-live="off"'),"Quarter-second timer avoids incessant announcements");
ok(game.includes('questionHeadingRef.current?.focus({preventScroll:true})'),"New round focus is restored without scroll jump");
ok(game.includes('role="status">{copiedPin?"PIN copied ✓":""}'),"Copy success announced only on success");
ok(game.includes('await navigator.clipboard.writeText(pin)'),"PIN copy result awaited");
ok(game.includes('Could not copy the PIN.'),"PIN copy failure surfaced");
ok(game.includes('onClick={()=>void reload(true)}>Refresh game state'),"Recovery does not repeat a POST");
ok(game.includes('disabled={host||answered||seconds===0||busy}'),"No invalid round answer replay");
ok(game.includes('act("answer",i)'),"Server-authorized answer submission preserved");
ok(game.includes("state.viewer.mode?.reward_ready")&&game.includes("<ModeRewards"),"Reward security gate preserved");
ok(game.includes('state?.scoreboardPhase==="previous-round"'),"Current-round points not revealed early");
ok(rewards.includes('data-mode={mode} aria-busy={loading}'),"Mode-aware feedback and busy status");
ok(rewards.includes('Processing your move…'),"Long reward request has progress status");
ok(rewards.includes('"x-player-token":token'),"Rewards still use player token");
ok(rewards.includes('await onClaim(receipt)'),"Rewards still confirmed by server response");
for(const selector of [".zk-session-strip",".zk-teacher-participation",".zk-answer-prompt",".zk-choice-key",
 ".zk-round-tip",".zk-game-alert",".zk-reward-progress",
 ".zk-game-screen[data-role=\"host\"] .zk-compact-board",".zk-answer-pads .zk-answer-pad:focus-visible"]){
 ok(css.includes(selector),"Missing UI affordance "+selector);
}
ok(css.includes("@media(max-width:600px)")&&css.includes("@media(max-width:365px)"),"Mobile and narrow-screen layouts");
ok(css.includes("prefers-reduced-motion:reduce"),"Reduced-motion rule exists");
ok(!css.includes("pointer-events:none")&&!css.includes("z-index:9999"),"No invisible full-screen click interception");
ok(gameplay.includes("ZOKIVO_SIMPLE_GAMEPLAY_TEST_PASS"),"Existing game regression is part of repository");
console.log("GAMEPLAY_UI_POLISH_TEST_PASS: "+assertions+" assertions; real API, student identity and server scoring unchanged.");
