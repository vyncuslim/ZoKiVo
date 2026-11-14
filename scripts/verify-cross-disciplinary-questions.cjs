const fs=require("node:fs"),assert=require("node:assert/strict");
const src=[1,2,3].map(i=>"content/curated-cross-disciplinary-20261105-part"+i+".json");
const schema="zokivo-curated-cross-disciplinary-2026-11-05-v1";
const packs=src.flatMap(path=>{const data=JSON.parse(fs.readFileSync(path,"utf8"));assert.equal(data.schema,schema,"Unexpected source schema");return data.packs});
const keys=new Set(),packIds=new Set(),names=new Set(),subjects=new Set(),answerCounts=[0,0,0,0];let n=0;
for(const p of packs){
 assert.match(p.id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
 assert(!packIds.has(p.id),"Duplicate pack ID");packIds.add(p.id);
 assert(typeof p.title==="string"&&p.title.length>=3&&p.title.length<=140);assert(!names.has(p.title));names.add(p.title);
 assert(["en","zh","ms"].includes(p.language));assert(typeof p.subject==="string"&&p.subject.length>=2&&p.subject.length<=80);subjects.add(p.subject);
 assert(typeof p.grade_level==="string"&&p.grade_level.length>=3&&p.grade_level.length<=40);
 assert(p.description.length>=20&&p.description.length<=600);
 assert.equal(p.questions.length,20,"Every pack must be classroom-sized");
 for(const q of p.questions){
  n++;
  assert(typeof q.question==="string"&&q.question.trim().length>=4&&q.question.length<=750);
  const key=q.question.normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");
  assert(!keys.has(key),"Duplicate question in curated set: "+q.question);keys.add(key);
  assert(Array.isArray(q.options)&&q.options.length===4);
  assert(q.options.every(o=>typeof o==="string"&&o.trim().length>=1&&o.length<=250));
  assert.equal(new Set(q.options.map(o=>o.normalize("NFKC").trim().toLowerCase())).size,4,"Duplicate/ambiguous choices: "+q.question);
  assert(Number.isInteger(q.correct_option_index)&&q.correct_option_index>=0&&q.correct_option_index<=3,"Invalid correct index");
  answerCounts[q.correct_option_index]++;
  assert(typeof q.explanation==="string"&&q.explanation.length>=12&&q.explanation.length<=800,"Missing explanation: "+q.question);
 }
}
assert.equal(packs.length,12);assert.equal(subjects.size,12);assert.equal(n,240);
for(const c of answerCounts)assert.equal(c,60,"A/B/C/D positions must be balanced");
const migration=fs.readFileSync("migrations/021_cross_disciplinary_question_bank.sql","utf8");
assert(migration.includes("BEGIN;")&&migration.includes("COMMIT;"));
assert(migration.includes("ON CONFLICT (id) DO NOTHING")&&migration.includes("WHERE NOT EXISTS"),"Idempotency protections absent");
assert(migration.includes("RAISE EXCEPTION 'ZoKivo cross-disciplinary QA mismatch"),"Integrity guard missing");
const hit=migration.match(/WITH bundle AS \(SELECT '([\s\S]*?)'::jsonb AS packs\)/);
assert(hit,"Migration must embed exact reviewed data");
const embedded=JSON.parse(hit[1].replaceAll("''","'"));
assert.deepEqual(embedded,packs,"Source JSON and deployable migration must match exactly");
for(const p of packs)assert(migration.includes(p.id),"Pack ID missing in SQL");
const ui=fs.readFileSync("src/app/library/page.client.tsx","utf8");
for(const subject of subjects)assert(ui.includes('"'+subject+'"'),"New subject missing from filter: "+subject);
console.log("CROSS_DISCIPLINARY_QUESTION_BANK_PASS: 12 packs, 240 original questions, 12 categories, explanations, balanced answer keys, migration/source parity, discovery mapping. No live DB writes.");
