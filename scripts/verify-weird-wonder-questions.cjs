const fs=require("node:fs"),assert=require("node:assert/strict");
const files=[1,2,3].map(n=>"content/curated-weird-wonder-20261105-part"+n+".json");
const schema="zokivo-weird-wonder-2026-11-05-v1";
const packs=files.flatMap(file=>{const o=JSON.parse(fs.readFileSync(file,"utf8"));assert.equal(o.schema,schema);return o.packs;});
const ids=new Set(),titles=new Set(),subjects=new Set(),stems=new Set(),answers=[0,0,0,0],languages={};let questions=0;
for(const p of packs){
 assert.match(p.id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
 assert(!ids.has(p.id),"duplicate pack id");ids.add(p.id);
 assert(p.title.length>=3&&p.title.length<=140);
 assert(!titles.has(p.title),"duplicate pack title");titles.add(p.title);
 assert(p.subject.length>=2&&p.subject.length<=80);subjects.add(p.subject);
 assert(["en","zh","ms"].includes(p.language));languages[p.language]=(languages[p.language]||0)+p.questions.length;
 assert(p.grade_level.length>=3&&p.grade_level.length<=40);
 assert(p.description.length>=15&&p.description.length<=600);
 assert.equal(p.questions.length,20,"Each funny quiz should have exactly 20 questions");
 for(const q of p.questions){
  questions++;
  assert(q.question.trim().length>=4&&q.question.length<=750,"invalid question length");
  const stem=q.question.normalize("NFKC").toLowerCase().trim().replace(/\s+/g," ");
  assert(!stems.has(stem),"duplicate question: "+q.question);stems.add(stem);
  assert(Array.isArray(q.options)&&q.options.length===4);
  assert(q.options.every(x=>typeof x==="string"&&x.trim().length>0&&x.length<=250));
  assert.equal(new Set(q.options.map(x=>x.normalize("NFKC").toLowerCase().trim())).size,4,"duplicate answers: "+q.question);
  assert(Number.isInteger(q.correct_option_index)&&q.correct_option_index>=0&&q.correct_option_index<=3);
  answers[q.correct_option_index]++;
  assert(typeof q.explanation==="string"&&q.explanation.trim().length>=10&&q.explanation.length<=800,"missing explanation: "+q.question);
 }
}
assert.equal(packs.length,12);assert.equal(subjects.size,12);assert.equal(questions,240);
assert.deepEqual(answers,[60,60,60,60]);
assert.deepEqual(languages,{zh:80,en:120,ms:40});
const sql=fs.readFileSync("migrations/022_weird_wonder_question_bank.sql","utf8");
for(const term of ["BEGIN;","COMMIT;","ON CONFLICT (id) DO NOTHING","WHERE NOT EXISTS","RAISE EXCEPTION 'Weird Wonder content integrity failed","overlap<>0"])assert(sql.includes(term),"SQL integrity requirement missing "+term);
const match=sql.match(/WITH payload AS \(SELECT '([\s\S]*?)'::jsonb AS packs\)/);
assert(match,"SQL content bundle missing");
assert.deepEqual(JSON.parse(match[1].replaceAll("''","'")),packs,"JSON and SQL content must be byte-for-byte equivalent after parsing");
for(const id of ids)assert(sql.includes(id),"SQL missing pack "+id);
const ui=fs.readFileSync("src/app/library/page.client.tsx","utf8");
for(const subject of subjects)assert(ui.includes('"'+subject+'"'),"Quiz discovery missing category "+subject);
console.log("WEIRD_WONDER_QUIZ_PASS: 12 packs, 240 unique questions, balanced answers, 80 Chinese / 120 English / 40 Malay, explanations, SQL parity, subject filters; no live writes.");
