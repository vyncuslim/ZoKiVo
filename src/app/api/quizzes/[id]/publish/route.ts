import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser,isId,teacherApproved} from "@/lib/quizzes";
import {checkOrigin,AuthError,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  checkOrigin(req);
  const {id}=await params;if(!isId(id))throw new AuthError("Invalid quiz ID.");
  const {user,renew}=await authUser(req);
  if(!teacherApproved(user!))return noCache({error:"Teacher approval required. Contact the ZoKivo administrator to verify your educator role."},403);
  const data=await req.json().catch(()=>null);
  if(data?.confirm!==true)throw new AuthError("Confirm quiz publication explicitly.");
  const sql=db();
  const published=await sql`UPDATE quiz_sets SET status='published',updated_at=now()
   WHERE id=${id} AND owner_user_id=${user!.id} AND status='draft'
    AND (SELECT count(*) FROM questions WHERE quiz_set_id=${id}) BETWEEN 1 AND 40
   RETURNING id,status`;
  if(!published.length)return noCache({error:"Draft not found, already published, or empty."},409);
  return applyRenew(noCache({ok:true,id,status:"published"}),req,renew);
 }catch(e){return authError(e)}
}
