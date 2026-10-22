import type {QuizPartySnapshot} from "@/lib/quiz-party-snapshot";

/**
 * One immutable, non-personal JSON prefix per SQL room snapshot.
 * A player-specific suffix is generated only AFTER HMAC and room-membership
 * verification in GET. Never caches tokens or private answer keys in the
 * response prefix, and never shares one player's viewer/result with another.
 */
type CachedReply={
 prefix:string;
 players:Set<string>;
 answers:Map<string,{is_correct:boolean;points:number}>;
};
const replies=new WeakMap<QuizPartySnapshot,CachedReply>();
const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","Content-Type":"application/json; charset=utf-8"};

function compile(snapshot:QuizPartySnapshot):CachedReply{
 const {room:r,players,answers,submitted}=snapshot;
 const allAnswered=r.status==="playing"&&players.length>0&&submitted>=players.length;
 const expired=r.status==="playing"&&!!r.deadline&&new Date(r.deadline).getTime()<=new Date(r.server_time).getTime();
 const canShowResult=r.status==="finished"||expired||allAnswered;
 const safeQuestion=r.status==="playing"&&snapshot.question?{
  question:snapshot.question.question,
  choices:snapshot.question.choices,
  image_url:snapshot.question.image_url,
  audio_url:snapshot.question.audio_url,
  formula_text:snapshot.question.formula_text
 }:null;
 const common={
  status:r.status,index:r.current_index,deadline:r.deadline,gameMode:r.game_mode,
  muteSounds:r.mute_sounds,scoreGoal:r.score_goal,serverTime:r.server_time,
  allAnswered,roundReady:r.status==="playing"&&(expired||allAnswered),
  rewardsPending:false,scoreboardPhase:r.round_open?"previous-round":"settled",
  total:snapshot.total,question:safeQuestion,players,answeredCount:submitted
 };
 // Remove closing brace and append private fields in the caller.
 const prefix=JSON.stringify(common).slice(0,-1);
 const reply={
  prefix,
  players:new Set(players.map(player=>player.id)),
  answers:new Map(answers.map(answer=>[answer.player_id,{is_correct:answer.is_correct,points:answer.points}]))
 };
 replies.set(snapshot,reply);
 return reply;
}

/** Returns null when player no longer belongs to this room. No Host access. */
export function quizPartySignedPlayerResponse(snapshot:QuizPartySnapshot,playerId:string):Response|null{
 const reply=replies.get(snapshot)||compile(snapshot);
 if(!reply.players.has(playerId))return null;
 const own=reply.answers.get(playerId);
 const {room:r,players,submitted}=snapshot;
 const allAnswered=r.status==="playing"&&players.length>0&&submitted>=players.length;
 const expired=r.status==="playing"&&!!r.deadline&&new Date(r.deadline).getTime()<=new Date(r.server_time).getTime();
 const canShowResult=r.status==="finished"||expired||allAnswered;
 const viewer={host:false,playerId,mode:null,
  result:canShowResult&&own?{is_correct:own.is_correct,points:own.points}:null};
 const response=reply.prefix+',"answeredIds":'+(own?JSON.stringify([playerId]):"[]")+
  ',"viewer":'+JSON.stringify(viewer)+"}";
 return new Response(response,{headers});
}
