import {db,hash,same,bad} from "@/lib/store";
export const runtime="nodejs";
/** All viewers see one authoritative score snapshot. Current-round points stay hidden until timeout. */
export async function GET(req:Request,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params;
 if(!/^\d{6}$/.test(pin))return bad("Invalid PIN");
 try{
  const sql=db();
  const found=await sql`SELECT pin,quiz_set_id,status,current_index,deadline,host_token_hash,now() AS server_time,
   (status='playing' AND deadline>now()) AS round_open FROM rooms WHERE pin=${pin}`;
  if(!found.length)return bad("Room not found",404);
  const r=found[0],hostKey=req.headers.get("x-host-token"),playerKey=req.headers.get("x-player-token");
  const host=!!hostKey&&same(r.host_token_hash,hash(hostKey));
  const me=playerKey?await sql`SELECT id FROM players WHERE room_pin=${pin} AND token_hash=${hash(playerKey)} LIMIT 1`:[];
  if(!host&&!me.length)return bad("Unauthorized",401);
  // Identical score policy for host and player. Do not leak correct answers via current-round score changes.
  const players=await sql`SELECT p.id,p.nickname,
   (CASE WHEN r.status='playing' AND r.deadline>now() THEN
    COALESCE((SELECT SUM(a.points) FROM answers a WHERE a.player_id=p.id AND a.room_pin=r.pin
      AND a.question_index<r.current_index),0)
    ELSE p.score END)::integer AS score
   FROM players p INNER JOIN rooms r ON r.pin=p.room_pin
   WHERE p.room_pin=${pin} ORDER BY score DESC,p.created_at ASC`;
  const question=r.status==="playing"?await sql`SELECT question,choices FROM questions
   WHERE quiz_set_id=${r.quiz_set_id} AND position=${r.current_index}`:[];
  const count=await sql`SELECT count(*)::integer AS n FROM questions WHERE quiz_set_id=${r.quiz_set_id}`;
  const answers=await sql`SELECT player_id FROM answers WHERE room_pin=${pin} AND question_index=${r.current_index}`;
  return Response.json({
   status:r.status,index:r.current_index,deadline:r.deadline,
   serverTime:r.server_time,scoreboardPhase:r.round_open?"previous-round":"settled",
   total:count[0].n,question:question[0]||null,players,answeredCount:answers.length,
   answeredIds:answers.filter(a=>host||a.player_id===me[0]?.id).map(a=>a.player_id),
   viewer:{host,playerId:me[0]?.id||null}
  },{headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
 }catch(e){console.error("Game status unavailable",e);return bad("Game unavailable",503)}
}
