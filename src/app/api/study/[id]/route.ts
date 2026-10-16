import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {isId} from "@/lib/quizzes";
import {findUser,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;if(!isId(id))return noCache({error:"Invalid quiz ID"},400);
  const sql=db();const quiz=await sql`SELECT id,title,subject,grade_level,language FROM quiz_sets WHERE id=${id} AND status='published'`;
  if(!quiz.length)return noCache({error:"Published quiz not found"},404);
  const items=await sql`SELECT position,question,choices,image_url,audio_url,formula_text FROM questions WHERE quiz_set_id=${id} ORDER BY position`;
  const result=await findUser(req);
  let mistakes:number[]=[],completed=0,correct=0;
  if(result.user){
   const stats=await sql`SELECT count(*)::integer AS total,count(*) FILTER(WHERE correct)::integer AS correct FROM study_attempts WHERE owner_user_id=${result.user.id} AND quiz_set_id=${id}`;
   completed=stats[0].total;correct=stats[0].correct;
   const wrong=await sql`SELECT question_position FROM (
    SELECT DISTINCT ON(question_position) question_position,correct FROM study_attempts
    WHERE owner_user_id=${result.user.id} AND quiz_set_id=${id}
    ORDER BY question_position,created_at DESC,id DESC
   ) latest WHERE NOT correct`;
   mistakes=wrong.map(w=>w.question_position);
  }
  return applyRenew(noCache({quiz:quiz[0],questions:items.map(q=>({position:q.position,question:q.question,options:q.choices,image_url:q.image_url,audio_url:q.audio_url,formula_text:q.formula_text})),
   progress:{completed,correct,mistakes},signedIn:!!result.user}),req,result.renew);
 }catch(e){return authError(e)}
}
