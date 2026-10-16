import {NextRequest} from "next/server";
import {AVATARS,avatarInfo} from "@/lib/avatars";
import {db} from "@/lib/store";
import {findUser,checkOrigin,noCache,authError,applyRenew} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
  const auth=await findUser(req);
  let unlocked:string[]=[],xp=0,tokens=0,equipped="spark";
  if(auth.user?.email_confirmed_at){
   const sql=db(),owner=auth.user.id;
   const profile=await sql`SELECT xp,tokens,equipped_avatar FROM avatar_profiles WHERE owner_user_id=${owner}`;
   const collected=await sql`SELECT avatar_id FROM avatar_unlocks WHERE owner_user_id=${owner}`;
   if(profile.length){xp=profile[0].xp;tokens=profile[0].tokens;equipped=profile[0].equipped_avatar}
   unlocked=collected.map(a=>a.avatar_id);
  }
  return applyRenew(noCache({signedIn:!!auth.user?.email_confirmed_at,xp,tokens,equipped,
   avatars:AVATARS.map(a=>({...a,unlocked:a.price===0||unlocked.includes(a.id)}))}),req,auth.renew);
 }catch(e){return authError(e)}
}
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  const auth=await findUser(req),user=auth.user;
  if(!user)return noCache({error:"Sign in to collect avatars"},401);
  if(!user.email_confirmed_at)return noCache({error:"Verify email to collect avatars"},403);
  const data=await req.json().catch(()=>null);
  const info=avatarInfo(data?.avatar);
  if(!info||!["unlock","equip"].includes(data?.action))return noCache({error:"Invalid avatar action"},400);
  const sql=db(),owner=user.id;
  await sql`INSERT INTO avatar_profiles(owner_user_id) VALUES(${owner}) ON CONFLICT DO NOTHING`;
  if(data.action==="unlock"){
   if(info.price===0)return noCache({error:"This avatar is already free"},409);
   const rows=await sql`WITH allowed AS(
     SELECT owner_user_id FROM avatar_profiles WHERE owner_user_id=${owner} AND tokens>=${info.price} FOR UPDATE
    ), unlocked AS(
     INSERT INTO avatar_unlocks(owner_user_id,avatar_id) SELECT owner_user_id,${info.id} FROM allowed
     ON CONFLICT DO NOTHING RETURNING owner_user_id
    ), paid AS(
     UPDATE avatar_profiles SET tokens=tokens-${info.price},updated_at=now()
     WHERE owner_user_id IN(SELECT owner_user_id FROM unlocked) RETURNING tokens
    ) SELECT tokens FROM paid`;
   if(!rows.length)return noCache({error:"Already unlocked or not enough Study tokens"},409);
   return applyRenew(noCache({ok:true,tokens:rows[0].tokens}),req,auth.renew);
  }
  const rows=await sql`UPDATE avatar_profiles SET equipped_avatar=${info.id},updated_at=now()
   WHERE owner_user_id=${owner} AND
    (${info.price}=0 OR EXISTS(SELECT 1 FROM avatar_unlocks WHERE owner_user_id=${owner} AND avatar_id=${info.id}))
   RETURNING equipped_avatar`;
  if(!rows.length)return noCache({error:"Unlock this avatar first"},403);
  return applyRenew(noCache({ok:true,equipped:rows[0].equipped_avatar}),req,auth.renew);
 }catch(e){return authError(e)}
}
