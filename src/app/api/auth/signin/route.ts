import {NextRequest} from "next/server";
import {authFetch,parseTokens,setTokens,checkOrigin,noCache,authError,emailValue,passwordValue,AuthError,safeUser,captchaSecurity} from "@/lib/mother-auth";
import {readBoundedJson} from "@/lib/limited-json";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  const parsed=await readBoundedJson(req,16384);
  if(!parsed.ok)return noCache({error:parsed.error},parsed.status);
  const body=parsed.value;
  const email=emailValue(body.email),password=passwordValue(body.password);
  if(!email||!password)throw new AuthError("Enter a valid email and password.");
  const result=await authFetch("token",{method:"POST",query:{grant_type:"password"},body:{email,password,gotrue_meta_security:captchaSecurity(body.captchaToken)}});
  const tokens=parseTokens(result);if(!tokens)throw new AuthError("Could not establish an authenticated session.",503);
  const res=noCache({ok:true,user:tokens.user?safeUser(tokens.user):null});
  setTokens(res,req,tokens);return res;
 }catch(e){return authError(e)}
}
