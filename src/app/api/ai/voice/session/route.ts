import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser} from "@/lib/quizzes";
import {checkOrigin,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  if(process.env.ZOKIVO_AI_ENABLED!=="true")return noCache({error:"ZoKivo AI is in private testing. Live sessions are not enabled yet."},503);
  const apiKey=process.env.ELEVENLABS_API_KEY,agent=process.env.ELEVENLABS_AGENT_ID;
  if(!apiKey||!agent?.startsWith("agent_"))return noCache({error:"ZoKivo AI provider is not configured."},503);
  const {user,renew}=await authUser(req);
  const sql=db();
  const issued=await sql`INSERT INTO ai_session_requests(owner_user_id)
   SELECT ${user!.id} WHERE (
    SELECT count(*) FROM ai_session_requests WHERE owner_user_id=${user!.id} AND created_at>now()-interval '24 hours'
   )<10 RETURNING id`;
  if(!issued.length)return noCache({error:"Daily AI test session limit reached. Try tomorrow."},429);
  const target=new URL("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
  target.searchParams.set("agent_id",agent);
  let response:Response;
  try{response=await fetch(target,{headers:{"xi-api-key":apiKey},cache:"no-store",signal:AbortSignal.timeout(12000)})}
  catch{return noCache({error:"Unable to reach the AI provider."},503)}
  if(!response.ok)return noCache({error:"The ZoKivo AI Agent is not available. Please confirm its publication and private-agent authentication settings."},503);
  const payload=await response.json().catch(()=>({}));
  if(typeof payload.signed_url!=="string"||!payload.signed_url.startsWith("wss://api.elevenlabs.io/"))return noCache({error:"The AI provider returned an invalid session."},503);
  return applyRenew(noCache({signedUrl:payload.signed_url}),req,renew);
 }catch(e){return authError(e)}
}
