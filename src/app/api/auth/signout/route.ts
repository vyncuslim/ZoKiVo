import {NextRequest} from "next/server";
import {authFetch,clearTokens,clearFlow,checkOrigin,noCache,authError} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  const token=req.cookies.get("zk_auth_access")?.value;
  if(token)await authFetch("logout",{method:"POST",token}).catch(()=>{});
  const res=noCache({ok:true});clearTokens(res,req);clearFlow(res,req);return res;
 }catch(e){return authError(e)}
}
