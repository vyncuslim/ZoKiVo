import {NextRequest} from "next/server";
import {authFetch,findUser,checkOrigin,AuthError,noCache,authError,applyRenew,safeUser} from "@/lib/mother-auth";
export const runtime="nodejs";
// User metadata selects the VIEW only. It does not grant app_metadata educator authorization.
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);
  const auth=await findUser(req);
  if(!auth.user)throw new AuthError("Sign in before switching roles.",401);
  const raw=await req.json().catch(()=>({}));
  if(raw?.role!=="student"&&raw?.role!=="teacher")throw new AuthError("Choose Student or Teacher.");
  const access=auth.renew?.access_token||req.cookies.get("zk_auth_access")?.value;
  if(!access)throw new AuthError("Session expired. Please sign in again.",401);
  const updated=await authFetch("user",{method:"PUT",token:access,body:{data:{zokivo_view_role:raw.role}}});
  if(typeof updated.id!=="string"||updated.id!==auth.user.id)throw new AuthError("Role change could not be verified.",503);
  return applyRenew(noCache({ok:true,user:safeUser(updated as typeof auth.user)}),req,auth.renew);
 }catch(e){return authError(e)}
}
