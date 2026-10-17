import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser,isId} from "@/lib/quizzes";
import {chosenRole,checkOrigin,AuthError,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
  const {user,renew}=await authUser(req);
  if(chosenRole(user!)!=="teacher")throw new AuthError("Switch to Teacher Account to manage your assignments.",403);
  const sql=db();
  const rows=await sql`SELECT a.id,a.title,a.due_at,a.created_at,q.title AS quiz_title
   FROM teacher_assignments a JOIN quiz_sets q ON q.id=a.quiz_set_id
   WHERE a.owner_user_id=${user!.id} ORDER BY a.created_at DESC LIMIT 100`;
  return applyRenew(noCache({assignments:rows}),req,renew);
 }catch(e){return authError(e)}
}
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  const {user,renew}=await authUser(req);
  if(chosenRole(user!)!=="teacher")throw new AuthError("Switch to Teacher Account to create assignments.",403);
  const raw=await req.json().catch(()=>({}));
  const title=typeof raw.title==="string"?raw.title.trim():"";
  if(title.length<3||title.length>120||!isId(raw.quizId))throw new AuthError("Choose a published quiz and a title between 3 and 120 characters.");
  let due:string|null=null;
  if(raw.dueAt!==undefined&&raw.dueAt!==null&&raw.dueAt!==""){
   const ms=typeof raw.dueAt==="string"?Date.parse(raw.dueAt):NaN;
   if(!Number.isFinite(ms)||ms<=Date.now()||ms>Date.now()+365*86400000)throw new AuthError("Due date must be in the next 365 days.");
   due=new Date(ms).toISOString();
  }
  const sql=db();
  const created=await sql`INSERT INTO teacher_assignments(owner_user_id,quiz_set_id,title,due_at)
   SELECT ${user!.id},q.id,${title},${due}::timestamptz FROM quiz_sets q
   WHERE q.id=${raw.quizId} AND q.status='published'
   AND (SELECT count(*) FROM teacher_assignments WHERE owner_user_id=${user!.id})<100
   RETURNING id,title,due_at,created_at`;
  if(!created.length)return noCache({error:"Quiz must be published, or your 100-assignment limit was reached."},409);
  return applyRenew(noCache({assignment:created[0]},201),req,renew);
 }catch(e){return authError(e)}
}
