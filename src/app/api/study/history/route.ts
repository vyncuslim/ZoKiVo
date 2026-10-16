import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser} from "@/lib/quizzes";
import {noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{const {user,renew}=await authUser(req),sql=db();
  const rows=await sql`SELECT q.id,q.title,q.subject,count(a.id)::integer AS attempts,
    count(a.id) FILTER(WHERE a.correct)::integer AS correct,max(a.created_at) AS last_practiced
    FROM study_attempts a JOIN quiz_sets q ON q.id=a.quiz_set_id
    WHERE a.owner_user_id=${user!.id} GROUP BY q.id,q.title,q.subject ORDER BY max(a.created_at) DESC LIMIT 40`;
  return applyRenew(noCache({history:rows}),req,renew);
 }catch(e){return authError(e)}
}
