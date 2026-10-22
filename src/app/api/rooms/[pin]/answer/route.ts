import {emitRoomRefresh} from "@/lib/realtime";
import {db,hash,bad} from "@/lib/store";
export const runtime="nodejs";

export async function POST(req:Request,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params,t=req.headers.get("x-player-token");
 if(!t||!/^\d{6}$/.test(pin))return bad("Invalid player",401);
 try{
  const body=await req.json().catch(()=>null);
  if(!body||!Number.isInteger(body.choice)||body.choice<0||body.choice>3)return bad("Invalid choice");
  const sql=db();
  // Verify session + insert unique answer + award points atomically in ONE
  // database request. No pre-auth SELECT, and no empty score-goal UPDATE.
  const rows=await sql`WITH active AS (
    SELECT current_index,quiz_set_id,score_goal,
     COALESCE((question_order->>current_index)::integer,current_index) AS question_position
    FROM rooms WHERE pin=${pin} AND status='playing' AND deadline>now()
   ), actor AS (
    SELECT id FROM players WHERE room_pin=${pin} AND token_hash=${hash(t)}
   ), q AS (
    SELECT a.current_index,q.correct_index,q.point_value,a.score_goal
    FROM questions q JOIN active a ON q.quiz_set_id=a.quiz_set_id AND q.position=a.question_position
   ), saved AS (
    INSERT INTO answers(player_id,room_pin,question_index,chosen_index,is_correct,points)
    SELECT actor.id,${pin},q.current_index,${body.choice},q.correct_index=${body.choice},
     CASE WHEN q.correct_index=${body.choice} THEN q.point_value ELSE 0 END
    FROM q CROSS JOIN actor
    ON CONFLICT(player_id,question_index) DO NOTHING
    RETURNING player_id,points,is_correct
   ),awarded AS (
    UPDATE players SET score=players.score+saved.points FROM saved
    WHERE players.id=saved.player_id
    RETURNING players.id
   )
   SELECT EXISTS(SELECT 1 FROM actor) AS authorized,
    EXISTS(SELECT 1 FROM awarded) AS accepted,
    (SELECT score_goal FROM active LIMIT 1) AS goal`;
  if(!rows[0]?.authorized)return bad("Invalid player",403);
  if(!rows[0]?.accepted)return bad("Answer already submitted or round closed",409);
  // Most Quiz Party rounds have no score goal; do not send another DB request.
  if(rows[0].goal!==null&&rows[0].goal!==undefined){
   await sql`UPDATE rooms SET status='finished',deadline=NULL WHERE pin=${pin}
    AND game_mode='quiz_party' AND score_goal IS NOT NULL
    AND EXISTS(SELECT 1 FROM players WHERE room_pin=${pin} AND score>=rooms.score_goal)`;
  }
  await emitRoomRefresh("quiz",pin);
  return Response.json({accepted:true});
 }catch(e){console.error("Answer unavailable",e);return bad("Answer failed",503)}
}
