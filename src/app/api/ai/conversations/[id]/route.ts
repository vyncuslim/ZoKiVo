import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser} from "@/lib/quizzes";
import {aiMessageId,decryptMessage} from "@/lib/ai-history";
import {checkOrigin,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
type Args={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Args){
 try{const {id}=await params;if(!aiMessageId(id))return noCache({error:"Invalid conversation."},400);
  const {user,renew}=await authUser(req),sql=db();
  const chat=await sql`SELECT id,title,created_at,updated_at FROM ai_chat_conversations WHERE id=${id} AND owner_user_id=${user!.id}`;
  if(!chat.length)return noCache({error:"Conversation not found."},404);
  const records=await sql`SELECT client_message_id,role,ciphertext,created_at FROM ai_chat_messages WHERE conversation_id=${id} ORDER BY created_at,id LIMIT 200`;
  const messages=records.map(m=>({id:m.client_message_id,role:m.role,text:decryptMessage(m.ciphertext,user!.id,id),created_at:m.created_at}));
  return applyRenew(noCache({conversation:chat[0],messages}),req,renew);
 }catch(e){return authError(e)}
}
export async function DELETE(req:NextRequest,{params}:Args){
 try{checkOrigin(req);const {id}=await params;if(!aiMessageId(id))return noCache({error:"Invalid conversation."},400);
  const {user,renew}=await authUser(req),sql=db();
  const rows=await sql`DELETE FROM ai_chat_conversations WHERE id=${id} AND owner_user_id=${user!.id} RETURNING id`;
  if(!rows.length)return noCache({error:"Conversation not found."},404);
  return applyRenew(noCache({ok:true}),req,renew);
 }catch(e){return authError(e)}
}
