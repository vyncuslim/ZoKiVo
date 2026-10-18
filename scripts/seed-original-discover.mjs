/** Idempotent quiz seed. Run with DATABASE_URL on an authorized deployment. */
import {readFile} from "node:fs/promises";
import {neon} from "@neondatabase/serverless";
const source=JSON.parse(await readFile(new URL("../data/original-discover-starter-20261018.json",import.meta.url),"utf8"));
if(!process.env.DATABASE_URL)throw Error("DATABASE_URL required");
const sql=neon(process.env.DATABASE_URL);
let added=0;
for(const pack of source.sets){
 const q=await sql`INSERT INTO quiz_sets(id,title,subject,grade_level,language,description,status,owner_user_id)
   VALUES(${pack.id}::uuid,${pack.title},${pack.subject},${pack.grade_level},${pack.language},${pack.description},'published',NULL)
   ON CONFLICT(id) DO NOTHING RETURNING id`;
 if(!q.length)continue; // Never overwrite an existing quiz on re-run.
 const rows=pack.questions.map(x=>({position:x.position,question:x.question,choices:x.choices,correct_index:x.correct_index,explanation:x.explanation,point_value:x.point_value}));
 await sql`INSERT INTO questions(quiz_set_id,position,question,choices,correct_index,explanation,point_value)
 SELECT ${pack.id}::uuid,x.position,x.question,x.choices,x.correct_index,x.explanation,x.point_value
 FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
 AS x(position integer,question text,choices jsonb,correct_index smallint,explanation text,point_value integer)
 ON CONFLICT(quiz_set_id,position) DO NOTHING`;
 added++;
}
console.log(JSON.stringify({totalSets:source.sets.length,seededNewSets:added,sourceQuestions:source.sets.reduce((n,x)=>n+x.questions.length,0)}));
