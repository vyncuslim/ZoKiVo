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
  const {user,renew}=await authUser(req),sql=db();
  let ticket:string|null=null;
  try{
   // An atomic database trigger protects the 10-session limit (migration 024).
   // Reserve before contacting the provider, refund on failure.
   const booked=await sql`INSERT INTO ai_session_requests(owner_user_id,state,lease_expires_at)
    SELECT ${user!.id},'reserved',now()+interval '90 seconds'
    WHERE (SELECT count(*) FROM ai_session_requests WHERE owner_user_id=${user!.id}
      AND ((state='issued' AND created_at>now()-interval '24 hours')
        OR (state='reserved' AND lease_expires_at>now())))<10
    RETURNING id`;
   if(!booked.length)return noCache({error:"Daily AI test session limit reached. Try tomorrow."},429);
   ticket=String(booked[0].id);
   const target=new URL("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
   target.searchParams.set("agent_id",agent);
   let response:Response;
   try{
    response=await fetch(target,{headers:{"xi-api-key":apiKey},cache:"no-store",signal:AbortSignal.timeout(12000)});
   }catch{return noCache({error:"Unable to reach the AI provider."},503)}
   if(!response.ok)return noCache({error:"The ZoKivo AI Agent is not available. Please confirm its publication and private-agent authentication settings."},503);
   const payload=await response.json().catch(()=>({}));
   const signed=typeof payload.signed_url==="string"?payload.signed_url:"";
   let safe=false;
   try{
    const parsed=new URL(signed);
    safe=parsed.protocol==="wss:"&&parsed.hostname==="api.elevenlabs.io"&&
      !parsed.username&&!parsed.password&&!parsed.port;
   }catch{}
   if(!safe)return noCache({error:"The AI provider returned an invalid session."},503);
   const finalized=await sql`UPDATE ai_session_requests SET state='issued',
     lease_expires_at=NULL,created_at=now()
     WHERE id=${ticket}::uuid AND owner_user_id=${user!.id}
      AND state='reserved' AND lease_expires_at>now()
     RETURNING id`;
   if(!finalized.length)return noCache({error:"AI session reservation expired. Try again."},503);
   ticket=null;
   return applyRenew(noCache({signedUrl:signed}),req,renew);
  }catch(e){
   if(e instanceof Error&&e.message.includes("ZOKIVO_AI_SESSION_LIMIT"))
    return noCache({error:"Daily AI test session limit reached. Try tomorrow."},429);
   throw e;
  }finally{
   if(ticket){
    try{
     await sql`DELETE FROM ai_session_requests WHERE id=${ticket}::uuid
       AND owner_user_id=${user!.id} AND state='reserved'`;
    }catch(e){
     // Lease expires after 90 seconds even if the database connection fails.
     console.warn("AI quota reservation cleanup failed",e instanceof Error?e.name:"unknown");
    }
   }
  }
 }catch(e){return authError(e)}
}
