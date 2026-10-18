import {emitRoomRefresh} from "@/lib/realtime";
import {NextRequest} from "next/server";
import {db,hash,same,bad} from "@/lib/store";
import {findUser,noCache,checkOrigin,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 try{
  checkOrigin(req);const {pin}=await params,hostToken=req.headers.get("x-host-token");
  if(!hostToken||!/^\d{6}$/.test(pin))return noCache({error:"Invalid host credentials."},401);
  const auth=await findUser(req);
  if(!auth.user)return noCache({error:"Host account sign-in required."},401);
  const sql=db(),rows=await sql`SELECT quiz_set_id,status,current_index,deadline,host_token_hash,owner_user_id,question_seconds,question_order,score_goal,game_mode FROM rooms WHERE pin=${pin}`;
  if(!rows.length||!same(rows[0].host_token_hash,hash(hostToken)))return noCache({error:"Not authorized."},403);
  const r=rows[0];
  if(r.owner_user_id&&r.owner_user_id!==auth.user.id)return noCache({error:"Only the original host account may control this room."},403);
  if(r.status==="finished")return noCache({error:"Game already finished."},409);
  // All connected participants may finish early. Correctly answered reward rounds
  // must wait for their bonus claims, even when every answer has been submitted.
  const readiness=r.status==="playing"?await sql`SELECT
    EXISTS(SELECT 1 FROM players p WHERE p.room_pin=${pin}) AS has_players,
    NOT EXISTS(SELECT 1 FROM players p WHERE p.room_pin=${pin} AND NOT EXISTS(
      SELECT 1 FROM answers a WHERE a.room_pin=${pin} AND a.player_id=p.id AND a.question_index=${r.current_index})) AS all_answered,
    NOT EXISTS(SELECT 1 FROM answers a WHERE a.room_pin=${pin} AND a.question_index=${r.current_index} AND a.is_correct
      AND NOT EXISTS(SELECT 1 FROM mode_events e WHERE e.room_pin=${pin} AND e.player_id=a.player_id AND e.question_index=${r.current_index})) AS rewards_settled`:[];
  const first=readiness[0];
  const eligibleEarly=Boolean(first?.has_players&&first?.all_answered&&(r.game_mode==="quiz_party"||first?.rewards_settled));
  const timedOut=r.status==="playing"&&(!r.deadline||new Date(r.deadline).getTime()<=Date.now());
  if(r.status==="playing"&&!timedOut&&!eligibleEarly)return noCache({error:"Waiting for other players or game rewards.",409);
  // Re-evaluate eligibility under the write guard to avoid racing a late join.
  // Advanced mini-games settle at the round boundary, not on the first correct answer.
  // Otherwise winning the quiz goal would close the room BEFORE the player can claim their reward.
  if(r.status==="playing"&&r.score_goal!==null&&r.score_goal!==undefined){
   const reached=await sql`SELECT 1 FROM players WHERE room_pin=${pin} AND score>=${r.score_goal} LIMIT 1`;
   if(reached.length){
    const finalized=await sql`UPDATE rooms SET status='finished',deadline=NULL
      WHERE pin=${pin} AND current_index=${r.current_index} AND status='playing'
        AND (deadline<=now() OR (EXISTS(SELECT 1 FROM players p WHERE p.room_pin=rooms.pin)
          AND NOT EXISTS(SELECT 1 FROM players p WHERE p.room_pin=rooms.pin AND NOT EXISTS(
           SELECT 1 FROM answers a WHERE a.room_pin=rooms.pin AND a.player_id=p.id AND a.question_index=rooms.current_index))
          AND (rooms.game_mode='quiz_party' OR NOT EXISTS(SELECT 1 FROM answers a WHERE a.room_pin=rooms.pin
            AND a.question_index=rooms.current_index AND a.is_correct AND NOT EXISTS(
             SELECT 1 FROM mode_events e WHERE e.room_pin=rooms.pin AND e.player_id=a.player_id AND e.question_index=rooms.current_index)))))
      RETURNING pin`;
    if(!finalized.length)return noCache({error:"The round was already changed. Refresh to continue."},409);
    await emitRoomRefresh("quiz",pin);
    return applyRenew(noCache({status:"finished"}),req,auth.renew);
   }
  }
  const next=r.status==="lobby"?0:r.current_index+1;
  const position=Array.isArray(r.question_order)?r.question_order[next]:next;
  const question=await sql`SELECT time_limit FROM questions WHERE quiz_set_id=${r.quiz_set_id} AND position=${position??next}`;
  if(!question.length){
   await sql`UPDATE rooms SET status='finished',deadline=NULL WHERE pin=${pin} AND status='playing'`;
   await emitRoomRefresh('quiz',pin);return applyRenew(noCache({status:"finished"}),req,auth.renew);
  }
  const updated=await sql`UPDATE rooms SET status='playing',current_index=${next},deadline=now()+make_interval(secs => ${question[0].time_limit??r.question_seconds})
   WHERE pin=${pin} AND current_index=${r.current_index} AND status=${r.status}
    AND (rooms.status='lobby' OR rooms.deadline<=now() OR
     (EXISTS(SELECT 1 FROM players p WHERE p.room_pin=rooms.pin)
      AND NOT EXISTS(SELECT 1 FROM players p WHERE p.room_pin=rooms.pin AND NOT EXISTS(
       SELECT 1 FROM answers a WHERE a.room_pin=rooms.pin AND a.player_id=p.id AND a.question_index=rooms.current_index))
      AND (rooms.game_mode='quiz_party' OR NOT EXISTS(SELECT 1 FROM answers a WHERE a.room_pin=rooms.pin AND a.question_index=rooms.current_index AND a.is_correct
        AND NOT EXISTS(SELECT 1 FROM mode_events e WHERE e.room_pin=rooms.pin AND e.player_id=a.player_id AND e.question_index=rooms.current_index)))))
   RETURNING pin`;
  if(!updated.length)return noCache({error:"Another request already advanced this round."},409);
  await emitRoomRefresh('quiz',pin);return applyRenew(noCache({index:next,status:"playing"}),req,auth.renew);
 }catch(e){return authError(e)}
}
