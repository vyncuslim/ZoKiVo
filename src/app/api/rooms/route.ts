import {emitRoomRefresh} from "@/lib/realtime";
import {NextRequest} from "next/server";
import {db,token,hash} from "@/lib/store";
import {findUser,noCache,applyRenew,checkOrigin,authError,AuthError} from "@/lib/mother-auth";
import {isId} from "@/lib/quizzes";
import {randomInt} from "node:crypto";
export const runtime="nodejs";
const SAMPLE="b91f4600-1000-4000-8000-000000000001";
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  const auth=await findUser(req);
  if(!auth.user)return noCache({error:"Sign in with Vynalth AI to host a game.",code:"AUTH_REQUIRED"},401);
  if(!auth.user.email_confirmed_at)return noCache({error:"Confirm your email before hosting.",code:"EMAIL_UNVERIFIED"},403);
  const body=await req.json().catch(()=>({})),id=body?.quizId||SAMPLE;
  const gameMode=body?.gameMode||"quiz_party";
  if(!["quiz_party","gold_quest","crypto_hack","fishing_frenzy","cafe"].includes(gameMode))throw new AuthError("Invalid game mode.");
  const questionSeconds=body?.questionSeconds===undefined?15:body.questionSeconds;
  const allowLateJoining=body?.allowLateJoining===undefined?false:body.allowLateJoining;
  const randomPlayerNames=body?.randomPlayerNames===undefined?false:body.randomPlayerNames;
  if(typeof allowLateJoining!=="boolean"||typeof randomPlayerNames!=="boolean")throw new AuthError("Invalid host settings.");
  if(![10,15,20,30,45,60].includes(questionSeconds))throw new AuthError("Invalid question timer.");
  if(typeof id!=="string"||!isId(id))throw new AuthError("Choose a valid quiz.");
  const sql=db(),secret=token();
  const available=await sql`SELECT id FROM quiz_sets WHERE id=${id} AND status='published'
    AND EXISTS(SELECT 1 FROM questions WHERE quiz_set_id=${id})`;
  if(!available.length)return noCache({error:"Quiz is not published or no longer available."},409);
  for(let i=0;i<6;i++){
   const pin=String(randomInt(100000,1000000));
   const created=await sql`INSERT INTO rooms(pin,quiz_set_id,host_token_hash,owner_user_id,question_seconds,allow_late_joining,random_player_names,game_mode)
     VALUES(${pin},${id},${hash(secret)},${auth.user.id},${questionSeconds},${allowLateJoining},${randomPlayerNames},${gameMode})
     ON CONFLICT DO NOTHING RETURNING pin`;
   if(created.length){await emitRoomRefresh('quiz',pin);return applyRenew(noCache({pin,token:secret}),req,auth.renew)}
  }
  return noCache({error:"Could not allocate a game PIN."},503);
 }catch(e){return authError(e)}
}
