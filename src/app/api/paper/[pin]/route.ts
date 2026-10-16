import {NextRequest} from "next/server";
import {db,hash,same,bad} from "@/lib/store";
import {findUser} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params;
 if(!/^\d{6}$/.test(pin))return bad("Invalid PIN");
 try{
  const sql=db();
  const sessions=await sql`SELECT pin,quiz_set_id,status,current_index,host_token_hash,owner_user_id FROM paper_sessions WHERE pin=${pin}`;
  if(!sessions.length)return bad("Paper session not found",404);
  const s=sessions[0],hostToken=req.headers.get("x-host-token");
  const auth=await findUser(req).catch(()=>({user:null}));
  const verifiedOwner=!!s.owner_user_id&&auth.user?.id===s.owner_user_id&&!!auth.user?.email_confirmed_at;
  const legacyHost=!s.owner_user_id&&!!auth.user?.email_confirmed_at&&!!hostToken&&same(s.host_token_hash,hash(hostToken));
  const host=verifiedOwner||legacyHost;
  const q=s.current_index>=0?await sql`SELECT question,choices FROM questions WHERE quiz_set_id=${s.quiz_set_id} AND position=${s.current_index}`:[];
  const total=await sql`SELECT count(*)::integer AS count FROM questions WHERE quiz_set_id=${s.quiz_set_id}`;
  const current=await sql`SELECT count(*)::integer AS count FROM paper_card_submissions WHERE session_pin=${pin} AND question_index=${s.current_index}`;
  const leaderboard=host?await sql`
    SELECT card_source,card_number,sum(points)::integer AS score,count(*)::integer AS submitted
    FROM paper_card_submissions WHERE session_pin=${pin}
    GROUP BY card_source,card_number ORDER BY score DESC,card_source,card_number
  `:[];
  return Response.json({
   pin,status:s.status,index:s.current_index,total:total[0].count,
   question:q[0]||null,submittedCount:current[0].count,
   leaderboard:host?leaderboard:undefined,isHost:host,
   requiresSignIn:!host
  },{headers:{"Cache-Control":"private, no-store","Vary":"Cookie, x-host-token"}});
 }catch(e){console.error("paper state",e);return bad("Unable to load Paper Mode session",503)}
}
