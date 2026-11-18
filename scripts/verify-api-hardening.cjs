// Static hardening regression; live concurrency still requires isolated QA Neon.
const fs=require("node:fs"),assert=require("node:assert/strict");
let n=0;const read=p=>fs.readFileSync(p,"utf8");
const caps={
 "src/app/api/study/[id]/answer/route.ts":1024,
 "src/app/api/ai/conversations/[id]/messages/route.ts":45000,
 "src/app/api/assignments/route.ts":4096,
 "src/app/api/auth/signin/route.ts":16384,
 "src/app/api/auth/signup/route.ts":16384,
 "src/app/api/auth/recover/route.ts":16384,
 "src/app/api/auth/reset/route.ts":16384,
 "src/app/api/auth/role/route.ts":1024,
 "src/app/api/avatars/route.ts":2048,
 "src/app/api/paper/route.ts":2048,
 "src/app/api/paper/[pin]/submit/route.ts":16384
};
for(const [path,cap] of Object.entries(caps)){
 const src=read(path);
 assert(src.includes("readBoundedJson(req,"+cap+")"),"Missing byte limit "+path);
 assert(!src.includes("await req.text()")&&!src.includes("await req.json()"),"Unbounded JSON "+path);
 n+=2;
}
const sql=read("migrations/023_atomic_feature_quotas.sql");
for(const marker of ["ZOKIVO_STUDY_RATE_LIMIT","ZOKIVO_AI_CONVERSATION_LIMIT","ZOKIVO_AI_MESSAGE_LIMIT","ZOKIVO_ASSIGNMENT_LIMIT"]){
 assert(sql.includes(marker),"Missing DB quota "+marker);n++;
}
assert((sql.match(/pg_advisory_xact_lock/g)||[]).length>=4,"Missing DB advisory-lock protections");n++;
const vercel=JSON.parse(read("vercel.json"));
assert(vercel.git?.deploymentEnabled?.main===true&&vercel.git.deploymentEnabled["**"]===false,"Disable PR preview");n++;
const announce=read("public/vynalth-gradient-announcement.js");
assert(!announce.includes("60% classic"),"Old cohort popup");n++;
assert(announce.includes("host === 'www.zokivo.xyz'")&&announce.includes("host === 'zokivo.vercel.app'"),"Public ZoKivo aliases must retain product palette");n++;
const quota24=read("migrations/024_quiz_ai_atomic_quotas.sql");
for(const tag of ["ZOKIVO_QUIZ_LIMIT","ZOKIVO_AI_SESSION_LIMIT","lease_expires_at","zokivo_quiz_count_guard","zokivo_ai_session_count_guard"]){assert(quota24.includes(tag),"Missing new quota "+tag);n++}
assert(read("src/app/api/ai/voice/session/route.ts").includes("finally"),"Reservation cleanup must be unconditional");n++;
assert(read("src/lib/use-room-realtime.ts").includes("refreshCoalesced(2500)"),"Broadcast must be rate bounded");n++;
console.log("ZOKIVO_API_HARDENING_PASS: "+n+" assertions.");
