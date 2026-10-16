import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser,isId} from "@/lib/quizzes";
import {checkOrigin,noCache,authError,AuthError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{checkOrigin(req);
  const {id}=await params;if(!isId(id))throw new AuthError("Invalid quiz ID");
  const raw=await req.text();if(raw.length>1024)throw new AuthError("Answer request too large",413);
  const data=JSON.parse(raw) as {position?:unknown;choice?:unknown};
  if(!data||typeof data.position!=="number"||!Number.isInteger(data.position)||data.position<0||
    typeof data.choice!=="number"||!Number.isInteger(data.choice)||data.choice<0||data.choice>3)
   throw new AuthError("Invalid study answer");
  const {user,renew}=await authUser(req);const sql=db();
  const question=await sql`SELECT q.correct_index,q.explanation FROM questions q
   JOIN quiz_sets s ON s.id=q.quiz_set_id
   WHERE s.id=${id} AND s.status='published' AND q.position=${data.position}`;
  if(!question.length)return noCache({error:"Question not available"},404);
  const count=await sql`SELECT count(*)::integer AS count FROM study_attempts WHERE owner_user_id=${user!.id} AND created_at>now()-interval '1 minute'`;
  if(count[0].count>=45)return noCache({error:"Too many answers. Please wait one minute."},429);
  const correct=data.choice===question[0].correct_index;
  await sql`INSERT INTO study_attempts(owner_user_id,quiz_set_id,question_position,chosen_index,correct)
    VALUES(${user!.id},${id},${data.position},${data.choice},${correct})`;
  return applyRenew(noCache({correct,correctIndex:question[0].correct_index,explanation:question[0].explanation||""}),req,renew);
 }catch(e){return authError(e)}
}
