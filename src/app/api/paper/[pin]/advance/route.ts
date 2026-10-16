import {db,hash,same,bad} from "@/lib/store";
export const runtime="nodejs";
export async function POST(req:Request,{params}:{params:Promise<{pin:string}>}){
 const{pin}=await params,t=req.headers.get("x-host-token");
 if(!/^\d{6}$/.test(pin)||!t)return bad("Host authorization required",401);
 try{
 const sql=db(),rows=await sql`SELECT quiz_set_id,status,current_index,host_token_hash FROM paper_sessions WHERE pin=${pin}`;
 if(!rows.length||!same(rows[0].host_token_hash,hash(t)))return bad("Not authorized to control session",403);
 const s=rows[0];if(s.status==="finished")return bad("The Paper Mode session is finished",409);
 const next=s.current_index+1;
 const hasQuestion=await sql`SELECT 1 FROM questions WHERE quiz_set_id=${s.quiz_set_id} AND position=${next}`;
 const status=hasQuestion.length?"playing":"finished";
 const updated=await sql`UPDATE paper_sessions SET current_index=${status==="finished"?s.current_index:next},status=${status} WHERE pin=${pin} AND current_index=${s.current_index} AND status=${s.status} RETURNING pin`;
 if(!updated.length)return bad("Round already advanced. Refresh and retry.",409);
 return Response.json({status,index:status==="finished"?s.current_index:next});
 }catch(e){console.error("paper advance",e);return bad("Unable to advance Paper Mode",503)}
}
