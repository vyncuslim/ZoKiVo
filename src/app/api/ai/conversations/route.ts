import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser} from "@/lib/quizzes";
import {checkOrigin,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{const {user,renew}=await authUser(req),sql=db();
  const rows=await sql`SELECT id,title,created_at,updated_at FROM ai_chat_conversations WHERE owner_user_id=${user!.id} ORDER BY updated_at DESC LIMIT 40`;
  return applyRenew(noCache({conversations:rows}),req,renew);
 }catch(e){return authError(e)}
}
export async function POST(req:NextRequest){
 try{checkOrigin(req);const {user,renew}=await authUser(req),sql=db();
  const rows=await sql`WITH count_existing AS(SELECT count(*) AS n FROM ai_chat_conversations WHERE owner_user_id=${user!.id}), new_chat AS(
   INSERT INTO ai_chat_conversations(owner_user_id) SELECT ${user!.id} WHERE (SELECT n FROM count_existing)<40 RETURNING id,title,created_at,updated_at
  ) SELECT * FROM new_chat`;
  if(!rows.length)return noCache({error:"Maximum of 40 saved chats reached. Delete an old chat to create another."},429);
  return applyRenew(noCache({conversation:rows[0]},201),req,renew);
 }catch(e){return authError(e)}
}
