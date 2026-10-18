import {NextRequest} from "next/server";
import {authFetch,beginFlow,checkOrigin,noCache,authError,emailValue,publicOrigin,AuthError,captchaSecurity} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);const body=await req.json().catch(()=>({})),email=emailValue(body.email);
  if(!email)throw new AuthError("Please provide a valid email.");
  const res=noCache({ok:true,message:"If this account exists, a password-reset email has been sent. Open it in this browser."});
  const challenge=beginFlow(req,res,"recover","/auth/reset");
  await authFetch("recover",{method:"POST",query:{redirect_to:publicOrigin(req)+"/auth/callback"},body:{email,gotrue_meta_security:captchaSecurity(body.captchaToken),code_challenge:challenge,code_challenge_method:"s256"}});
  return res;
 }catch(e){return authError(e)}
}
