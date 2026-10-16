import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser} from "@/lib/quizzes";
import {noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest,{params}:{params:Promise<{pin:string}>}){
 try{
  const {pin}=await params,kind=req.nextUrl.searchParams.get("kind")==="paper"?"paper":"quiz";
  if(!/^\d{6}$/.test(pin))return noCache({error:"Invalid PIN"},400);
  const auth=await authUser(req),owner=auth.user!.id,sql=db();
  if(kind==="paper"){
   const room=await sql`SELECT s.pin,s.status,s.quiz_set_id,q.title FROM paper_sessions s JOIN quiz_sets q ON q.id=s.quiz_set_id WHERE s.pin=${pin} AND s.owner_user_id=${owner}`;
   if(!room.length)return noCache({error:"Report not found"},404);
   if(room[0].status!=="finished")return noCache({error:"Finish the session before viewing question answers"},409);
   const questions=await sql`SELECT q.position,q.question,q.choices,q.correct_index,q.explanation,
    count(a.session_pin)::integer AS submissions,count(a.session_pin) FILTER(WHERE a.correct)::integer AS correct,
    count(a.session_pin) FILTER(WHERE a.choice=0)::integer AS a,
    count(a.session_pin) FILTER(WHERE a.choice=1)::integer AS b,
    count(a.session_pin) FILTER(WHERE a.choice=2)::integer AS c,
    count(a.session_pin) FILTER(WHERE a.choice=3)::integer AS d
    FROM questions q LEFT JOIN paper_card_submissions a ON a.session_pin=${pin} AND a.question_index=q.position
    WHERE q.quiz_set_id=${room[0].quiz_set_id} GROUP BY q.id ORDER BY q.position`;
   const players=await sql`SELECT card_source||' #'||lpad(card_number::text,3,'0') AS nickname,
    sum(points)::integer AS score,count(*)::integer AS answered,count(*) FILTER(WHERE correct)::integer AS correct
    FROM paper_card_submissions WHERE session_pin=${pin} GROUP BY card_source,card_number ORDER BY score DESC`;
   return applyRenew(noCache({room:{...room[0],kind},questions,players}),req,auth.renew);
  }
  const room=await sql`SELECT r.pin,r.status,r.quiz_set_id,r.game_mode,q.title FROM rooms r
   JOIN quiz_sets q ON q.id=r.quiz_set_id WHERE r.pin=${pin} AND r.owner_user_id=${owner}`;
  if(!room.length)return noCache({error:"Report not found"},404);
  if(room[0].status!=="finished")return noCache({error:"Finish the game before accessing answer analytics"},409);
  const players=await sql`SELECT p.nickname,p.score,COUNT(a.id)::integer AS answered,
   COUNT(a.id) FILTER(WHERE a.is_correct)::integer AS correct
   FROM players p LEFT JOIN answers a ON a.player_id=p.id AND a.room_pin=${pin}
   WHERE p.room_pin=${pin} GROUP BY p.id,p.nickname,p.score,p.created_at
   ORDER BY p.score DESC,p.created_at`;
  const questions=await sql`SELECT q.position,q.question,q.choices,q.correct_index,q.explanation,
   count(a.id)::integer AS submissions,count(a.id) FILTER(WHERE a.is_correct)::integer AS correct,
   count(a.id) FILTER(WHERE a.chosen_index=0)::integer AS a,
   count(a.id) FILTER(WHERE a.chosen_index=1)::integer AS b,
   count(a.id) FILTER(WHERE a.chosen_index=2)::integer AS c,
   count(a.id) FILTER(WHERE a.chosen_index=3)::integer AS d
   FROM questions q JOIN rooms r ON r.pin=${pin} LEFT JOIN answers a ON a.room_pin=${pin}
    AND q.position=COALESCE((r.question_order->>a.question_index)::integer,a.question_index)
   WHERE q.quiz_set_id=${room[0].quiz_set_id} GROUP BY q.id ORDER BY q.position`;
  const rewards=await sql`SELECT action,count(*)::integer AS events,sum(delta)::integer AS earned
   FROM mode_events WHERE room_pin=${pin} GROUP BY action ORDER BY events DESC`;
  return applyRenew(noCache({room:{...room[0],kind},questions,players,rewards}),req,auth.renew);
 }catch(e){return authError(e)}
}
