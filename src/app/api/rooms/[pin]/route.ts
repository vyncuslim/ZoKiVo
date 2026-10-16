import {db,hash,same,bad} from "@/lib/store";
export const runtime="nodejs";
/** All viewers see one authoritative score snapshot. Current-round points stay hidden until timeout. */
export async function GET(req:Request,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params;
 if(!/^\d{6}$/.test(pin))return bad("Invalid PIN");
 try{
  const sql=db();
  const found=await sql`SELECT pin,quiz_set_id,status,current_index,deadline,host_token_hash,game_mode,question_order,mute_sounds,score_goal,now() AS server_time,
   (status='playing' AND deadline>now()) AS round_open FROM rooms WHERE pin=${pin}`;
  if(!found.length)return bad("Room not found",404);
  const r=found[0],hostKey=req.headers.get("x-host-token"),playerKey=req.headers.get("x-player-token");
  const host=!!hostKey&&same(r.host_token_hash,hash(hostKey));
  const me=playerKey?await sql`SELECT id FROM players WHERE room_pin=${pin} AND token_hash=${hash(playerKey)} LIMIT 1`:[];
  if(!host&&!me.length)return bad("Unauthorized",401);
  // Identical score policy for host and player. Do not leak correct answers via current-round score changes.
  const players=await sql`SELECT p.id,p.nickname,p.avatar_id,
   CASE WHEN r.game_mode='quiz_party' THEN 0 ELSE
    COALESCE((SELECT sum(CASE WHEN e.player_id=p.id THEN e.delta ELSE e.target_delta END)
      FROM mode_events e WHERE e.room_pin=r.pin AND (e.player_id=p.id OR e.target_player_id=p.id)
       AND (r.status='finished' OR r.deadline<=now() OR e.question_index<r.current_index)),0)
   END::integer AS mode_score,
   (CASE WHEN r.status='playing' AND r.deadline>now() THEN
    COALESCE((SELECT SUM(a.points) FROM answers a WHERE a.player_id=p.id AND a.room_pin=r.pin
      AND a.question_index<r.current_index),0)
    ELSE p.score END)::integer AS score
   FROM players p INNER JOIN rooms r ON r.pin=p.room_pin
   WHERE p.room_pin=${pin} ORDER BY score DESC,p.created_at ASC`;
  const position=Array.isArray(r.question_order)?r.question_order[r.current_index]:r.current_index;
  const question=r.status==="playing"?await sql`SELECT question,choices,image_url,audio_url,formula_text FROM questions
   WHERE quiz_set_id=${r.quiz_set_id} AND position=${position??r.current_index}`:[];
  const count=await sql`SELECT count(*)::integer AS n FROM questions WHERE quiz_set_id=${r.quiz_set_id}`;
  const ownMode=me.length&&r.game_mode!=="quiz_party"?await sql`SELECT
    EXISTS(SELECT 1 FROM answers WHERE player_id=${me[0].id} AND room_pin=${pin} AND question_index=${r.current_index} AND is_correct) AND
    NOT EXISTS(SELECT 1 FROM mode_events WHERE player_id=${me[0].id} AND question_index=${r.current_index}) AS reward_ready,
    COALESCE((SELECT credits FROM mode_wallets WHERE player_id=${me[0].id}),0)::integer AS credits,
    COALESCE((SELECT fish_count FROM mode_wallets WHERE player_id=${me[0].id}),0)::integer AS fish,
    COALESCE((SELECT served_count FROM mode_wallets WHERE player_id=${me[0].id}),0)::integer AS served,
    COALESCE((SELECT cafe_level FROM mode_wallets WHERE player_id=${me[0].id}),1)::integer AS cafe_level,
    (SELECT defense_code FROM players WHERE id=${me[0].id}) AS defense_code`:[];
  const answers=await sql`SELECT player_id FROM answers WHERE room_pin=${pin} AND question_index=${r.current_index}`;
  return Response.json({
   status:r.status,index:r.current_index,deadline:r.deadline,gameMode:r.game_mode,muteSounds:r.mute_sounds,scoreGoal:r.score_goal,
   serverTime:r.server_time,scoreboardPhase:r.round_open?"previous-round":"settled",
   total:count[0].n,question:question[0]||null,players,answeredCount:answers.length,
   answeredIds:answers.filter(a=>host||a.player_id===me[0]?.id).map(a=>a.player_id),
   viewer:{host,playerId:me[0]?.id||null,mode:ownMode[0]||null}
  },{headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
 }catch(e){console.error("Game status unavailable",e);return bad("Game unavailable",503)}
}
