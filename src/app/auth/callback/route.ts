import {NextRequest,NextResponse} from "next/server";
import {authFetch,parseTokens,flowCookies,clearFlow,setTokens,setRecovery,publicOrigin} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const {verifier,flow,after}=flowCookies(req);
 const code=req.nextUrl.searchParams.get("code");
 const authErrorMessage=req.nextUrl.searchParams.get("error");
 const failure=(reason:string)=>{
  const u=new URL("/auth/login",publicOrigin(req));u.searchParams.set("error",reason);
  const res=NextResponse.redirect(u);clearFlow(res,req);
  res.cookies.set("zk_auth_signup_role","",{httpOnly:true,secure:req.nextUrl.protocol==="https:",sameSite:"lax",path:"/",maxAge:0});return res;
 };
 if(authErrorMessage)return failure("provider");
 if(!code||!verifier||!["google","signup","recover"].includes(flow||""))return failure("expired");
 try{
  const data=await authFetch("token",{method:"POST",query:{grant_type:"pkce"},body:{auth_code:code,code_verifier:verifier}});
  const tokens=parseTokens(data);if(!tokens)return failure("expired");
  const signupRole=req.cookies.get("zk_auth_signup_role")?.value;
  let target=flow==="recover"?"/auth/reset":after;
  if(flow==="google"&&(signupRole==="student"||signupRole==="teacher")){
   // The user controls only their own view preference, not verified app_metadata.
   const updated=await authFetch("user",{method:"PUT",token:tokens.access_token,body:{data:{zokivo_view_role:signupRole}}}).catch(()=>null);
   if(updated?.id===tokens.user?.id&&signupRole==="teacher"&&after==="/account")target="/teacher";
  }
  const res=NextResponse.redirect(new URL(target,publicOrigin(req)));
  res.cookies.set("zk_auth_signup_role","",{httpOnly:true,secure:req.nextUrl.protocol==="https:",sameSite:"lax",path:"/",maxAge:0});
  setTokens(res,req,tokens);clearFlow(res,req);setRecovery(res,req,flow==="recover");
  return res;
 }catch{return failure("expired")}
}
