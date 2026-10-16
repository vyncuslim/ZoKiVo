import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser} from "@/lib/quizzes";
import {aiMessageId,validChatMessage,encryptMessage} from "@/lib/ai-history";
import {AuthError,checkOrigin,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{checkOrigin(req);const {id}=await params;if(!aiMessageId(id))return noCache({error:"Invalid conversation."},400);
  const {user,renew}=await authUser(req);
  const raw=await req.text();if(raw.length>14000)throw new AuthError("Message too large.",413);
  const msg=validChatMessage(JSON.parse(raw));const sql=db();
  const chat=await sql`SELECT id,title FROM ai_chat_conversations WHERE id=${id} AND owner_user_id=${user!.id}`;
  if(!chat.length)return noCache({error:"Conversation not found."},404);
  const limit=await sql`SELECT count(*)::integer AS n FROM ai_chat_messages WHERE conversation_id=${id}`;
  const existing=await sql`SELECT role FROM ai_chat_messages WHERE conversation_id=${id} AND client_message_id=${msg.clientMessageId}`;
  if(existing.length&&existing[0].role!==msg.role)return noCache({error:"Message identity conflict."},409);
  if(!existing.length&&limit[0].n>=200)return noCache({error:"Conversation has reached 200 messages. Start a new conversation."},429);
  const ciphertext=encryptMessage(msg.text,user!.id,id);
  const saved=await sql`INSERT INTO ai_chat_messages(conversation_id,client_message_id,role,ciphertext)
   VALUES(${id},${msg.clientMessageId},${msg.role},${ciphertext})
   ON CONFLICT(conversation_id,client_message_id) DO UPDATE SET
    ciphertext=EXCLUDED.ciphertext,updated_at=now()
    WHERE ai_chat_messages.role=EXCLUDED.role RETURNING id`;
  if(!saved.length)return noCache({error:"Message not saved."},409);
  if(msg.role==="user"&&chat[0].title==="New conversation")
   await sql`UPDATE ai_chat_conversations SET title=${msg.text.slice(0,100)},updated_at=now() WHERE id=${id} AND owner_user_id=${user!.id} AND title='New conversation'`;
  else await sql`UPDATE ai_chat_conversations SET updated_at=now() WHERE id=${id} AND owner_user_id=${user!.id}`;
  return applyRenew(noCache({ok:true,clientMessageId:msg.clientMessageId}),req,renew);
 }catch(e){return authError(e)}
}
