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
   // Discovery search is server-side, bounded, and uses parameterized SQL.
  // Unfiltered calls keep the 100-item response expected by Host/Study.
  const search=(req.nextUrl.searchParams.get("search")||"").trim().slice(0,80);
  const subject=(req.nextUrl.searchParams.get("subject")||"").trim().slice(0,60);
  const filtering=req.nextUrl.searchParams.has("search")||req.nextUrl.searchParams.has("subject")||
   req.nextUrl.searchParams.has("page")||req.nextUrl.searchParams.has("limit");
  const rawPage=Number(req.nextUrl.searchParams.get("page")||1);
  const rawLimit=Number(req.nextUrl.searchParams.get("limit")||(filtering?24:100));
  const page=Number.isSafeInteger(rawPage)?Math.min(100,Math.max(1,rawPage)):1;
  const limit=Number.isSafeInteger(rawLimit)?Math.min(100,Math.max(1,rawLimit)):24;
  const offset=(page-1)*limit;
  const total=await sql`SELECT count(*)::integer AS n FROM quiz_sets q
    WHERE q.status='published'
    AND (${search}='' OR q.title ILIKE '%'||${search}||'%' OR q.subject ILIKE '%'||${search}||'%'
         OR q.description ILIKE '%'||${search}||'%' OR q.grade_level ILIKE '%'||${search}||'%')
    AND (${subject}='' OR lower(q.subject)=lower(${subject}))`;
  const rows=await sql`SELECT q.id,q.title,q.subject,q.grade_level,q.language,q.description,q.status,
   count(a.id)::integer AS question_count FROM quiz_sets q LEFT JOIN questions a ON a.quiz_set_id=q.id
   WHERE q.status='published'
   AND (${search}='' OR q.title ILIKE '%'||${search}||'%' OR q.subject ILIKE '%'||${search}||'%'
        OR q.description ILIKE '%'||${search}||'%' OR q.grade_level ILIKE '%'||${search}||'%')
   AND (${subject}='' OR lower(q.subject)=lower(${subject}))
   GROUP BY q.id ORDER BY q.created_at DESC,q.id LIMIT ${limit} OFFSET ${offset}`;
  return noCache({quizzes:rows,total:total[0]?.n||0,page,limit,hasMore:offset+rows.length<(total[0]?.n||0)});
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
   INSERT INTO questions(quiz_set_id,position,question,choices,correct_index,explanation,image_url,audio_url,formula_text,point_value,time_limit)
   SELECT new_quiz.id,entry.position,entry.question,entry.choices,entry.correct_index,entry.explanation,entry.image_url,entry.audio_url,entry.formula_text,entry.point_value,entry.time_limit
   FROM new_quiz CROSS JOIN jsonb_to_recordset(${json}::jsonb)
   AS entry(position integer,question text,choices jsonb,correct_index smallint,explanation text,image_url text,audio_url text,formula_text text,point_value integer,time_limit integer) RETURNING id
  ) SELECT id FROM new_quiz`;
  if(!rows.length)return noCache({error:"Could not save quiz."},503);
  return applyRenew(noCache({ok:true,id:rows[0].id,status:"draft"},201),req,renew);
 }catch(e){return authError(e)}
}
