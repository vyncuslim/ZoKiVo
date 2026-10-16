import {NextRequest,NextResponse} from "next/server";
import {authFetch,parseTokens,flowCookies,clearFlow,setTokens,setRecovery,publicOrigin} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const {verifier,flow,after}=flowCookies(req);
 const code=req.nextUrl.searchParams.get("code");
 const authErrorMessage=req.nextUrl.searchParams.get("error");
 const failure=(reason:string)=>{
  const u=new URL("/auth/login",publicOrigin(req));u.searchParams.set("error",reason);
  const res=NextResponse.redirect(u);clearFlow(res,req);return res;
 };
 if(authErrorMessage)return failure("provider");
 if(!code||!verifier||!["google","signup","recover"].includes(flow||""))return failure("expired");
 try{
  const data=await authFetch("token",{method:"POST",query:{grant_type:"pkce"},body:{auth_code:code,code_verifier:verifier}});
  const tokens=parseTokens(data);if(!tokens)return failure("expired");
  const res=NextResponse.redirect(new URL(flow==="recover"?"/auth/reset":after,publicOrigin(req)));
  setTokens(res,req,tokens);clearFlow(res,req);setRecovery(res,req,flow==="recover");
  return res;
 }catch{return failure("expired")}
}
