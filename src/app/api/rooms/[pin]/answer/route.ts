import {emitRoomRefresh} from "@/lib/realtime";
import {db,hash,bad} from "@/lib/store";
export const runtime="nodejs";
function rejectCrossSite(req:Request){
 const origin=req.headers.get("origin");
 return (origin!==null&&origin!==new URL(req.url).origin)||req.headers.get("sec-fetch-site")==="cross-site";
}
async function smallJson(req:Request,maxBytes=4096):Promise<{ok:true;value:Record<string,unknown>}|{ok:false;error:string;status:number}>{
 if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers.get("content-type")||""))return {ok:false,error:"JSON content type required",status:415};
 const length=req.headers.get("content-length");
 if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes))return {ok:false,error:"Request body too large",status:413};
 const body=await req.text();
 if(Buffer.byteLength(body,"utf8")>maxBytes)return {ok:false,error:"Request body too large",status:413};
 try{
  const parsed:unknown=JSON.parse(body);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return {ok:false,error:"Invalid JSON object",status:400};
  return {ok:true,value:parsed as Record<string,unknown>};
 }catch{return {ok:false,error:"Invalid JSON",status:400}}
}


export async function POST(req:Request,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params,t=req.headers.get("x-player-token");
 if(!t||!/^\d{6}$/.test(pin))return bad("Invalid player",401);
 if(rejectCrossSite(req))return bad("Cross-site answers are not allowed.",403);
 const parsed=await smallJson(req);
 if(!parsed.ok)return bad(parsed.error,parsed.status);
 try{
  const body=parsed.value;
  if(!Number.isInteger(body.choice)||typeof body.choice!=="number"||body.choice<0||body.choice>3)return bad("Invalid choice");
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
    WHERE true
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
