import {db,hash,same,bad} from "@/lib/store";
export const runtime="nodejs";
export async function GET(req:Request,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params;if(!/^\d{6}$/.test(pin))return bad("Invalid PIN");
 try{
  const sql=db();
  const sessions=await sql`SELECT pin,quiz_set_id,status,current_index,host_token_hash FROM paper_sessions WHERE pin=${pin}`;
  if(!sessions.length)return bad("Paper session not found",404);
  const s=sessions[0],hostToken=req.headers.get("x-host-token");
  const host=!!hostToken&&same(s.host_token_hash,hash(hostToken));
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
    question:q[0]||null,submittedCount:current[0].count,leaderboard:host?leaderboard:undefined,isHost:host
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("paper state",e);return bad("Unable to load Paper Mode session",503)}
}
