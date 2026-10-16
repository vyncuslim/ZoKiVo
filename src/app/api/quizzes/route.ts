import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser,validateQuiz,questionRows} from "@/lib/quizzes";
import {checkOrigin,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
  const sql=db(),mine=req.nextUrl.searchParams.get("mine")==="1";
  if(mine){
   const {user,renew}=await authUser(req);
   const rows=await sql`SELECT q.id,q.title,q.subject,q.grade_level,q.language,q.description,q.status,q.created_at,q.updated_at,
     count(a.id)::integer AS question_count FROM quiz_sets q LEFT JOIN questions a ON a.quiz_set_id=q.id
     WHERE q.owner_user_id=${user!.id} GROUP BY q.id ORDER BY q.updated_at DESC LIMIT 100`;
   return applyRenew(noCache({quizzes:rows}),req,renew);
  }
  const rows=await sql`SELECT q.id,q.title,q.subject,q.grade_level,q.language,q.description,q.status,
   count(a.id)::integer AS question_count FROM quiz_sets q LEFT JOIN questions a ON a.quiz_set_id=q.id
   WHERE q.status='published' GROUP BY q.id ORDER BY q.created_at DESC LIMIT 100`;
  return noCache({quizzes:rows});
 }catch(e){return authError(e)}
}
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  const {user,renew}=await authUser(req);
  const quiz=validateQuiz(await req.json().catch(()=>null)),sql=db();
  const counts=await sql`SELECT count(*)::integer AS total FROM quiz_sets WHERE owner_user_id=${user!.id}`;
  if(counts[0].total>=100)return noCache({error:"Maximum 100 quizzes per account."},429);
  const json=questionRows(quiz);
  const rows=await sql`WITH new_quiz AS(
   INSERT INTO quiz_sets(title,owner_user_id,status,subject,grade_level,language,description)
   VALUES(${quiz.title},${user!.id},'draft',${quiz.subject},${quiz.grade_level},${quiz.language},${quiz.description}) RETURNING id
  ), new_questions AS(
   INSERT INTO questions(quiz_set_id,position,question,choices,correct_index,explanation)
   SELECT new_quiz.id,entry.position,entry.question,entry.choices,entry.correct_index,entry.explanation
   FROM new_quiz CROSS JOIN jsonb_to_recordset(${json}::jsonb)
   AS entry(position integer,question text,choices jsonb,correct_index smallint,explanation text) RETURNING id
  ) SELECT id FROM new_quiz`;
  if(!rows.length)return noCache({error:"Could not save quiz."},503);
  return applyRenew(noCache({ok:true,id:rows[0].id,status:"draft"},201),req,renew);
 }catch(e){return authError(e)}
}
