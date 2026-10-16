import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {isId,authUser,validateQuiz,questionRows} from "@/lib/quizzes";
import {findUser,checkOrigin,noCache,authError,AuthError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
type Args={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Args){
 try{
  const {id}=await params;if(!isId(id))throw new AuthError("Invalid quiz ID.");
  const auth=await findUser(req),sql=db();
  const quizzes=await sql`SELECT * FROM quiz_sets WHERE id=${id}`;
  if(!quizzes.length)return noCache({error:"Quiz not found"},404);
  const quiz=quizzes[0],owner=!!auth.user&&quiz.owner_user_id===auth.user.id;
  if(!owner&&quiz.status!=="published")return noCache({error:"Quiz not found"},404);
  const data=await sql`SELECT position,question,choices,correct_index,explanation FROM questions
   WHERE quiz_set_id=${id} ORDER BY position`;
  return applyRenew(noCache({quiz:{id:quiz.id,title:quiz.title,subject:quiz.subject,
    grade_level:quiz.grade_level,language:quiz.language,description:quiz.description,
    status:quiz.status,editable:owner&&quiz.status==="draft",
    questions:data.map(q=>({question:q.question,options:q.choices,
      ...(owner?{correct_option_index:q.correct_index,explanation:q.explanation}:{})}))}}),req,auth.renew);
 }catch(e){return authError(e)}
}
export async function PATCH(req:NextRequest,{params}:Args){
 try{
  checkOrigin(req);const {id}=await params;if(!isId(id))throw new AuthError("Invalid quiz ID.");
  const {user,renew}=await authUser(req),quiz=validateQuiz(await req.json().catch(()=>null)),sql=db();
  const owns=await sql`SELECT id FROM quiz_sets WHERE id=${id} AND owner_user_id=${user!.id} AND status='draft'`;
  if(!owns.length)return noCache({error:"Only your own drafts can be edited."},403);
  const json=questionRows(quiz);
  const statements=[
   sql`DELETE FROM questions WHERE quiz_set_id=${id} AND EXISTS(
     SELECT 1 FROM quiz_sets WHERE id=${id} AND owner_user_id=${user!.id} AND status='draft')`,
   sql`INSERT INTO questions(quiz_set_id,position,question,choices,correct_index,explanation)
     SELECT ${id},x.position,x.question,x.choices,x.correct_index,x.explanation
     FROM jsonb_to_recordset(${json}::jsonb) AS x(position integer,question text,choices jsonb,correct_index smallint,explanation text)
     WHERE EXISTS(SELECT 1 FROM quiz_sets WHERE id=${id} AND owner_user_id=${user!.id} AND status='draft')`,
   sql`UPDATE quiz_sets SET title=${quiz.title},subject=${quiz.subject},grade_level=${quiz.grade_level},
     language=${quiz.language},description=${quiz.description},updated_at=now()
     WHERE id=${id} AND owner_user_id=${user!.id} AND status='draft'`
  ];
  await sql.transaction(statements);
  return applyRenew(noCache({ok:true,id,status:"draft"}),req,renew);
 }catch(e){return authError(e)}
}
