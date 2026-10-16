import {NextRequest} from "next/server";
import {db} from "@/lib/store";
import {authUser} from "@/lib/quizzes";
import {noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
  const auth=await authUser(req),owner=auth.user!.id,sql=db();
  const rooms=await sql`SELECT r.pin,r.created_at,r.status,r.game_mode,q.title,
   (SELECT count(*)::integer FROM players p WHERE p.room_pin=r.pin) AS players,
   (SELECT count(*)::integer FROM answers a WHERE a.room_pin=r.pin) AS submissions,
   (SELECT count(*) FILTER(WHERE is_correct)::integer FROM answers a WHERE a.room_pin=r.pin) AS correct
   FROM rooms r JOIN quiz_sets q ON q.id=r.quiz_set_id
   WHERE r.owner_user_id=${owner} ORDER BY r.created_at DESC LIMIT 100`;
  const paper=await sql`SELECT s.pin,s.created_at,s.status,q.title,
   (SELECT count(DISTINCT(card_source,card_number))::integer FROM paper_card_submissions a WHERE a.session_pin=s.pin) AS players,
   (SELECT count(*)::integer FROM paper_card_submissions a WHERE a.session_pin=s.pin) AS submissions,
   (SELECT count(*) FILTER(WHERE correct)::integer FROM paper_card_submissions a WHERE a.session_pin=s.pin) AS correct
   FROM paper_sessions s JOIN quiz_sets q ON q.id=s.quiz_set_id
   WHERE s.owner_user_id=${owner} ORDER BY s.created_at DESC LIMIT 100`;
  const all=[...rooms.map(r=>({...r,kind:"quiz"})),...paper.map(r=>({...r,kind:"paper",game_mode:"paper"}))]
   .sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,100);
  return applyRenew(noCache({reports:all}),req,auth.renew);
 }catch(e){return authError(e)}
}
