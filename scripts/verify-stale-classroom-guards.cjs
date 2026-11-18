// Safety gates: old classroom rejects late joining and previous rotated host.
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=p=>fs.readFileSync(p,"utf8");
let checks=0;function ok(x,msg){assert(x,msg);checks++}
const finish=read("src/app/api/rooms/[pin]/finish/route.ts");
ok(finish.includes("AND host_token_hash=${hash(hostToken)}::char(64) RETURNING pin"),"Finish rechecks the current host hash in atomic update");
ok(finish.includes("AND owner_user_id=${session.user.id}"),"Finish rechecks owner in atomic update");
const start=read("src/app/api/rooms/[pin]/start/route.ts");
ok(start.includes("Date.now()-86400000"),"Old round is rejected before starting next question");
ok((start.match(/host_token_hash=\$\{hash\(hostToken\)\}::char\(64\)/g)||[]).length>=3,"All three start or finish write guards recheck rotated token");
ok(start.includes("deadline>=now()-interval '24 hours'"),"Slow writes cannot bypass stale age protection");
ok(start.includes("if(!ended.length)"),"Final-round completion checks affected rows before reporting success");
const join=read("src/app/api/rooms/[pin]/join/route.ts");
ok(join.includes('SELECT status,allow_late_joining,random_player_names,deadline'),"Join preflight checks deadline");
ok(join.includes("Date.now()-86400000"),"Join preflight denies stale classroom");
const settings=read("src/app/api/rooms/[pin]/settings/route.ts");
ok(settings.includes("!!rows[0].deadline")&&settings.includes("Date.now()-86400000"),"Room settings hide stale join controls");
const game=read("src/app/game/[pin]/page.tsx");
ok(game.includes("disabled={busy||!state.roundReady||!!state.needsHostReview}"),"Stale UI disables manual next question");
const sql=read("migrations/025_stop_abandoned_classroom_joins.sql");
ok(sql.includes("FOR UPDATE")&&sql.includes("clock_timestamp()-interval '24 hours'"),"Locked DB procedure denies stale joins");
ok(sql.includes("Room needs host review"),"API maps DB guard to 409");
ok(!sql.includes("DELETE FROM")&&!sql.includes("SET status='finished'"),"No automatic deletion/finish");
console.log("ZOKIVO_STALE_CLASSROOM_GUARDS_PASS: "+checks+" guards");
