// Static fallback regression for host-visible, read-only stale-room recovery.
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=path=>fs.readFileSync(path,"utf8");
let n=0;function ok(condition,message){assert(condition,message);n++}
const api=read("src/app/api/rooms/[pin]/route.ts");
ok((api.match(/needsHostReview/g)||[]).length>=4,"Fast and slow game state both report stale rounds");
ok(api.includes("86400000"),"Only rounds with deadline >24h old need review");
const game=read("src/app/game/[pin]/page.tsx");
ok(game.includes("||state.needsHostReview)return"),"Stale host room never advances automatically");
ok(game.includes('state?.status!=="finished"&&!state?.needsHostReview'),"Stale realtime closed");
ok(game.includes('if(state?.status==="finished"||state?.needsHostReview)return'),"Stale HTTP polling stops");
ok(game.includes("use Finish game to unlock your report"),"Original host gets recovery instructions");
const reports=read("src/app/api/reports/route.ts");
ok(reports.includes("AS needs_host_review")&&reports.includes("r.deadline<now()-interval '24 hours'"),"Only original host receives expired room flag");
const ui=read("src/app/reports/page.tsx");
ok(ui.includes("Review old classroom")&&ui.includes('r.needs_host_review&&r.kind==="quiz"'),"Reports offer safe host recovery link");
ok(!api.includes("UPDATE rooms SET status='finished'"),"GET remains read-only; no automated production write");
const recoveryRoute=read("src/app/api/rooms/[pin]/recover-host/route.ts");
ok(recoveryRoute.includes("checkOrigin(req)")&&recoveryRoute.includes("email_confirmed_at"),"Recovery requires same origin and verified account");
ok(recoveryRoute.includes("owner_user_id=")&&recoveryRoute.includes("deadline<now()-interval '24 hours'"),"Recovery is scoped by owner and 24-hour age");
ok(recoveryRoute.includes("SET host_token_hash=")&&!recoveryRoute.includes("SET status="),"Recovery only rotates host credential, never changes scores or room status");
ok(ui.includes("Lost host token? Recover access")&&ui.includes('sessionStorage.setItem("host:"+pin,data.hostToken)'),"Original host explicitly stores recovered token in sessionStorage");
console.log("ZOKIVO_STALE_ROOM_RECOVERY_STATIC_PASS: "+n+" checks; no production state modified.");
