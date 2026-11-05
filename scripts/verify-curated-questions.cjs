const fs=require("node:fs"),assert=require("node:assert/strict");
const files=[1,2,3].map(n=>"content/curated-questions-20261105-part"+n+".json");
const packs=files.flatMap(file=>{const data=JSON.parse(fs.readFileSync(file,"utf8"));assert.equal(data.schema,"zokivo-curated-2026-11-05-v1");return data.packs});
let count=0;const ids=new Set(),all=new Set(),subjects={};
for(const p of packs){
 assert.match(p.id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
 assert(!ids.has(p.id),"Duplicate pack ID");ids.add(p.id);
 assert(p.title.length>=3&&p.title.length<=140);
 assert(["en","zh","ms"].includes(p.language));assert.equal(p.questions.length,20);
 assert(p.description.length<=600&&p.subject.length>=2);
 subjects[p.subject]=(subjects[p.subject]||0)+p.questions.length;
 for(const q of p.questions){
  count++;
  assert(typeof q.question==="string"&&q.question.trim().length>=4&&q.question.length<=750);
  assert(Array.isArray(q.options)&&q.options.length===4);
  assert(q.options.every(x=>typeof x==="string"&&x.trim().length>=1&&x.length<=250));
  assert.equal(new Set(q.options.map(x=>x.normalize("NFKC").trim().toLowerCase())).size,4,"Ambiguous answer options");
  assert(Number.isInteger(q.correct_option_index)&&q.correct_option_index>=0&&q.correct_option_index<=3);
  assert(typeof q.explanation==="string"&&q.explanation.length>=12&&q.explanation.length<=800);
  const normalized=q.question.normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();
  assert(!all.has(normalized),"Repeated question across packs: "+q.question);all.add(normalized);
 }
}
assert.equal(packs.length,10);assert.equal(count,200);
assert.equal(subjects["中文"],40);assert.equal(subjects["Bahasa Melayu"],40);
const sql=fs.readFileSync("migrations/020_curated_multilingual_question_bank.sql","utf8");
assert(sql.includes("ON CONFLICT (id) DO NOTHING")&&sql.includes("WHERE NOT EXISTS")&&sql.includes("ROLLBACK")===false);
assert(sql.includes("RAISE EXCEPTION 'ZoKivo curated library integrity mismatch"));
for(const id of ids)assert(sql.includes(id),"SQL migration missing ID "+id);
const embedded=sql.match(/WITH payload AS \\(SELECT '([\\s\\S]*?)'::jsonb AS packs\\)/);
assert(embedded,"SQL must embed the exact content bundle");
assert.deepEqual(JSON.parse(embedded[1].replaceAll("''","'")),packs,
 "SQL seed must exactly match all 200 reviewed questions and answers");

console.log("CURATED_QUESTION_BANK_TEST_PASS: 10 independent multilingual sets / 200 unique items, non-empty explanations, unique options, idempotent SQL + integrity guard; no live database mutation.");