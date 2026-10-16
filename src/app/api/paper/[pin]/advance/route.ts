import {emitRoomRefresh} from "@/lib/realtime";
import {NextRequest} from "next/server";
import {findUser,checkOrigin,noCache,authError} from "@/lib/mother-auth";
import {db,hash,same,bad} from "@/lib/store";
export const runtime="nodejs";
export async function POST(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 try{checkOrigin(req)}catch{return noCache({error:"Invalid request origin"},403)}
 const auth=await findUser(req).catch(()=>null);
 if(!auth)return noCache({error:"Authentication unavailable"},503);
 if(!auth.user)return noCache({error:"Sign in as the room host"},401);
 const{pin}=await params,t=req.headers.get("x-host-token");
 if(!/^\d{6}$/.test(pin)||!t)return bad("Host authorization required",401);
 try{
 const sql=db(),rows=await sql`SELECT quiz_set_id,status,current_index,host_token_hash,owner_user_id FROM paper_sessions WHERE pin=${pin}`;
 if(!rows.length||!same(rows[0].host_token_hash,hash(t)))return bad("Not authorized to control session",403);
 if(rows[0].owner_user_id&&rows[0].owner_user_id!==auth.user.id)return noCache({error:"Only the original host can control this room"},403);
 const s=rows[0];if(s.status==="finished")return bad("The Paper Mode session is finished",409);
 const next=s.current_index+1;
 const hasQuestion=await sql`SELECT 1 FROM questions WHERE quiz_set_id=${s.quiz_set_id} AND position=${next}`;
 const status=hasQuestion.length?"playing":"finished";
 const updated=await sql`UPDATE paper_sessions SET current_index=${status==="finished"?s.current_index:next},status=${status} WHERE pin=${pin} AND current_index=${s.current_index} AND status=${s.status} RETURNING pin`;
 if(!updated.length)return bad("Round already advanced. Refresh and retry.",409);
 await emitRoomRefresh('paper',pin);return Response.json({status,index:status==="finished"?s.current_index:next});
 }catch(e){console.error("paper advance",e);return bad("Unable to advance Paper Mode",503)}
}
