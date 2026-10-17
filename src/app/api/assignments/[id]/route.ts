import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {isId} from "@/lib/quizzes";
import {noCache,authError} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  if(!isId(id))return noCache({error:"Invalid assignment link."},400);
  const sql=db();
  const rows=await sql`SELECT a.title,a.due_at,q.id AS quiz_id,q.title AS quiz_title
   FROM teacher_assignments a JOIN quiz_sets q ON q.id=a.quiz_set_id
   WHERE a.id=${id} AND q.status='published' LIMIT 1`;
  if(!rows.length)return noCache({error:"Assignment not found."},404);
  return noCache({assignment:{title:rows[0].title,quizId:rows[0].quiz_id,
   quizTitle:rows[0].quiz_title,dueAt:rows[0].due_at}});
 }catch(e){return authError(e)}
}
