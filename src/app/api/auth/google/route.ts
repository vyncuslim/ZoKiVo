import {NextRequest,NextResponse} from "next/server";
import {beginFlow,config,publicOrigin,nextPath} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
  const {base}=config(),after=nextPath(req.nextUrl.searchParams.get("next"));
  const destination=new URL(base+"/auth/v1/authorize");
  destination.searchParams.set("provider","google");
  destination.searchParams.set("redirect_to",publicOrigin(req)+"/auth/callback");
  destination.searchParams.set("code_challenge_method","s256");
  const response=NextResponse.redirect(new URL("/auth/login?error=provider",req.url));
  const challenge=beginFlow(req,response,"google",after);
  destination.searchParams.set("code_challenge",challenge);
  response.headers.set("Location",destination.toString());
  response.headers.set("Cache-Control","no-store");
  return response;
 }catch{
  return NextResponse.redirect(new URL("/auth/login?error=config",req.url));
 }
}
