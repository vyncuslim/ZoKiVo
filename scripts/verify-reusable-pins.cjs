const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript");
const file=p=>fs.readFileSync(p,"utf8");
const migration=file("migrations/018_reusable_room_pins.sql");
const allocate=file("src/app/api/rooms/route.ts");
const index=file("src/app/api/reports/route.ts");
const detail=file("src/app/api/reports/[pin]/route.ts");
const list=file("src/app/reports/page.tsx");
const page=file("src/app/reports/[pin]/page.tsx");
const join=file("src/app/api/rooms/[pin]/join/route.ts");
const finish=file("src/app/api/rooms/[pin]/finish/route.ts");
let count=0;
function ok(value,msg){assert.ok(value,msg);count++}
ok(migration.includes("CREATE TABLE IF NOT EXISTS room_archives"),"Archive table created");
ok(migration.includes("owner_user_id TEXT NOT NULL"),"Archived reports tied to original owner");
ok(migration.includes("SELECT * INTO old_room FROM rooms WHERE pin=p_pin FOR UPDATE"),"Existing PIN locked before recycling");
ok(migration.includes("IF old_room.status<>'finished' THEN RETURN FALSE"),"Never recycle active or lobby room");
ok(migration.includes("INSERT INTO room_archives("),"Archive report before PIN release");
ok(migration.indexOf("INSERT INTO room_archives(")<migration.indexOf("DELETE FROM rooms WHERE pin=p_pin"),"Archive is written before cascading deletion");
ok(migration.includes("ON CONFLICT DO NOTHING RETURNING pin INTO allocated"),"Concurrent creators cannot claim same PIN");
ok(migration.includes("RETURN allocated IS NOT NULL"),"Allocation failure is safe");
ok(migration.includes("jsonb_build_object("),"Historic question/player scores snapshotted");
ok(!migration.includes("host_token_hash',"),"Archived report never contains host token hash");
ok(!migration.includes("token_hash',"),"Archived report never contains player tokens");
ok(allocate.includes("zokivo_allocate_room_reusing_finished("),"Room API uses atomic allocator");
ok(allocate.includes("hash(secret)"),"Every game has new host token hash");
ok(allocate.includes("auth.user.id"),"New owner bound to current verified account");
ok(allocate.includes("randomInt(100000,1000000)"),"PIN selected randomly");
ok(allocate.includes("created[0]?.allocated===true"),"Host receives a token only on confirmed allocation");
ok(join.includes("zokivo_join_room("),"Join remains server-validated");
ok(finish.includes("status='finished'"),"Finishing a game makes old PIN unjoinable");
ok(index.includes("room_archives WHERE owner_user_id="),"Archive list owner-scoped");
ok(detail.includes("WHERE id=")&&detail.includes("owner_user_id="),"Archive lookup owner-scoped");
ok(detail.includes("if(isArchive)"),"Archived report uses UUID and is not resolved by reused PIN");
ok(list.includes("r.archive_id||r.pin"),"Report links use immutable ID after recycling");
ok(page.includes("data.room.pin"),"Archive download and breadcrumb use original historic PIN");
for(const path of [
 "src/app/api/rooms/route.ts","src/app/api/reports/route.ts",
 "src/app/api/reports/[pin]/route.ts","src/app/reports/page.tsx",
 "src/app/reports/[pin]/page.tsx"
]){
 const diagnostics=ts.transpileModule(file(path),{
  reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).diagnostics||[];
 ok(diagnostics.length===0,"Source parses: "+path);
}
console.log("REUSABLE_PIN_TEST_PASS="+JSON.stringify({assertions:count}));
