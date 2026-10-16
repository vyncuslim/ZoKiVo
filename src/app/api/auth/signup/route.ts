import {NextRequest} from "next/server";
import {authFetch,beginFlow,clearFlow,parseTokens,setTokens,checkOrigin,noCache,authError,emailValue,passwordValue,publicOrigin,AuthError} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  const body=await req.json().catch(()=>({}));
  const email=emailValue(body.email),password=passwordValue(body.password,8);
  const name=typeof body.name==="string"?body.name.trim().slice(0,100):"";
  if(!email)throw new AuthError("Please provide a valid email.");
  if(!password)throw new AuthError("Password must contain at least 8 characters.");
  if(!name||name.length<2)throw new AuthError("Please enter your name (at least 2 characters).");
  const res=noCache({ok:true,needsEmailConfirmation:true,message:"Check your email to confirm your account. Return to this browser to finish signing in."});
  const challenge=beginFlow(req,res,"signup");
  const data=await authFetch("signup",{method:"POST",query:{redirect_to:publicOrigin(req)+"/auth/callback"},body:{email,password,data:{full_name:name},code_challenge:challenge,code_challenge_method:"s256"}});
  const tokens=parseTokens(data);
  if(tokens){
    setTokens(res,req,tokens);clearFlow(res,req);
    return noCacheWithSession(req,tokens);
  }
  return res;
 }catch(e){return authError(e)}
}
function noCacheWithSession(req:NextRequest,tokens:NonNullable<ReturnType<typeof parseTokens>>){
 const res=noCache({ok:true,needsEmailConfirmation:false});setTokens(res,req,tokens);return res;
}
