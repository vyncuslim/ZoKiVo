const fs=require("node:fs"),assert=require("node:assert/strict");
const read=p=>fs.readFileSync(p,"utf8");let n=0;function ok(v,m){assert.ok(v,m);n++}
const schema=read("migrations/015_host_advanced.sql"),host=read("src/app/host/page.tsx"),create=read("src/app/api/rooms/route.ts");
ok(schema.includes("question_order JSONB")&&schema.includes("score_goal"),"Question shuffle and score-goal columns");
ok(host.includes("setShuffle")&&host.includes("setMuteSounds")&&host.includes("setScoreGoal"),"Host can control ordering, sounds and finish condition");
ok(create.includes("ORDER BY random()")&&create.includes("orderJson"),"Server chooses random order");
ok(create.includes('typeof body.randomQuestionOrder!=="boolean"'),"Host options typed server-side");
ok(create.includes("score_goal)"),"Room persists end condition");
const start=read("src/app/api/rooms/[pin]/start/route.ts"),state=read("src/app/api/rooms/[pin]/route.ts"),answer=read("src/app/api/rooms/[pin]/answer/route.ts");
ok(start.includes("r.question_order"),"Host displays shuffled question indexes");
ok(state.includes("r.question_order"),"Players see shuffled question");
ok(answer.includes("question_position")&&answer.includes("q.position=a.question_position"),"Server grades logical round's real question");
ok(answer.includes("score>=rooms.score_goal"),"Score-based finish checked by server");
const legacy=read("src/app/api/rooms/[pin]/report/route.ts"),historical=read("src/app/api/reports/[pin]/route.ts");
ok(legacy.includes("r.question_order")&&historical.includes("r.question_order"),"Reports use physical question index after shuffling");
const game=read("src/app/game/[pin]/page.tsx");
ok(game.includes("state?.muteSounds")&&game.includes("window.AudioContext"),"Audio effects respect host mute");
ok(game.includes("state.scoreGoal"),"Score goal is visible on host display");
console.log("ZOKIVO_ADVANCED_HOST_TEST_PASS: "+n+" checks.");
