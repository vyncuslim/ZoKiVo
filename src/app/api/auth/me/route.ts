import {NextRequest} from "next/server";
import {findUser,applyRenew,clearTokens,noCache,authError,safeUser} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
  const result=await findUser(req);
  const res=noCache({authenticated:!!result.user,user:result.user?safeUser(result.user):null});
  if(!result.user)clearTokens(res,req);
  else applyRenew(res,req,result.renew);
  return res;
 }catch(e){return authError(e)}
}
