import {db} from "@/lib/store";

type PublicPlayer={id:string;nickname:string;avatar_id:string;score:number;mode_score:number};
type CurrentQuestion={
 question:string;choices:string[];image_url:string;audio_url:string;
 formula_text:string;correct_index:number;
};
type ClassAnswer={player_id:string;chosen_index:number;is_correct:boolean};
export type QuizPartySnapshot={
 players:PublicPlayer[];
 question:CurrentQuestion|null;
 total:number;
 submitted:number;
 answers:ClassAnswer[];
};

// Per-isolate, ephemeral cache: no tokens, private user fields, or host secrets.
// Shared status is stale for at most 200ms, not an HTTP/browser public cache.
const ttlMs=200;
const cache=new Map<string,{until:number;pending:Promise<QuizPartySnapshot>}>();

export async function quizPartySnapshot(pin:string,key:string):Promise<QuizPartySnapshot>{
 const cacheKey=pin+":"+key;
 const now=Date.now(),item=cache.get(cacheKey);
 if(item&&item.until>now)return item.pending;
 if(item)cache.delete(cacheKey);
 // The first reader pays for the query; classmates in the same isolate await
 // the same promise rather than creating a separate scoreboard aggregation.
 const promise=readSharedSnapshot(pin).catch(error=>{
  if(cache.get(cacheKey)?.pending===promise)cache.delete(cacheKey);
  throw error;
 });
 cache.set(cacheKey,{until:now+ttlMs,pending:promise});
 // Bound memory in busy multi-room deployments; never cache negative auth.
 if(cache.size>128){
  for(const [k,v] of cache){if(v.until<=now)cache.delete(k)}
  while(cache.size>128)cache.delete(cache.keys().next().value!);
 }
 return promise;
}

async function readSharedSnapshot(pin:string):Promise<QuizPartySnapshot>{
 const sql=db();
 // ONE database round trip for current question, 100-player leaderboard and
 // submission aggregates, instead of several identical queries per student.
 const rows=await sql`
 WITH room AS(
  SELECT r.pin,r.quiz_set_id,r.status,r.current_index,r.deadline,r.question_order,
   (r.status='playing' AND r.deadline>now()) AS round_open
  FROM rooms r WHERE r.pin=${pin}
 ),prior_scores AS(
  SELECT a.player_id,SUM(a.points)::integer AS points
  FROM answers a JOIN room r ON r.pin=a.room_pin
  WHERE r.round_open AND a.question_index<r.current_index
  GROUP BY a.player_id
 ),ranked AS(
  SELECT p.id,p.nickname,p.avatar_id,p.created_at,
   (CASE WHEN r.round_open THEN COALESCE(pr.points,0) ELSE p.score END)::integer AS score
  FROM players p JOIN room r ON r.pin=p.room_pin
  LEFT JOIN prior_scores pr ON pr.player_id=p.id
 ),current_answers AS(
  SELECT a.player_id,a.chosen_index,a.is_correct
  FROM answers a JOIN room r ON r.pin=a.room_pin AND a.question_index=r.current_index
 )
 SELECT
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',p.id,'nickname',p.nickname,'avatar_id',p.avatar_id,
   'score',p.score,'mode_score',0
  ) ORDER BY p.score DESC,p.created_at ASC) FROM ranked p),'[]'::jsonb) AS players,
  (SELECT jsonb_build_object(
   'question',q.question,'choices',q.choices,'image_url',q.image_url,
   'audio_url',q.audio_url,'formula_text',q.formula_text,
   'correct_index',q.correct_index
  ) FROM questions q JOIN room r ON r.quiz_set_id=q.quiz_set_id
   WHERE q.position=COALESCE((r.question_order->>r.current_index)::integer,r.current_index)
   LIMIT 1) AS question,
  (SELECT count(*)::integer FROM questions q JOIN room r ON r.quiz_set_id=q.quiz_set_id) AS total,
  (SELECT count(*)::integer FROM current_answers) AS submitted,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'player_id',a.player_id,'chosen_index',a.chosen_index,'is_correct',a.is_correct
  )) FROM current_answers a),'[]'::jsonb) AS answers
 `;
 const result=rows[0];
 if(!result)throw Error("Room snapshot missing");
 return {
  players:result.players||[],
  question:result.question||null,
  total:Number(result.total||0),
  submitted:Number(result.submitted||0),
  answers:result.answers||[]
 };
}
