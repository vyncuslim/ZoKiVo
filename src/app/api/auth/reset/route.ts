import {NextRequest} from "next/server";
import {authFetch,checkOrigin,clearTokens,findUser,noCache,authError,passwordValue,AuthError,isRecovering} from "@/lib/mother-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  checkOrigin(req);if(!isRecovering(req))throw new AuthError("Open the password recovery link from your email first.",403);
  const body=await req.json().catch(()=>({})),password=passwordValue(body.password,8);
  if(!password)throw new AuthError("Your new password must be at least 8 characters.");
  const session=await findUser(req);if(!session.user)throw new AuthError("Recovery session expired. Request a new recovery email.",401);
  const access=session.renew?.access_token||req.cookies.get("zk_auth_access")?.value;
  if(!access)throw new AuthError("Your recovery session has expired.",401);
  await authFetch("user",{method:"PUT",token:access,body:{password}});
  const res=noCache({ok:true,message:"Password changed. Sign in again with your new password."});
  clearTokens(res,req);return res;
 }catch(e){return authError(e)}
}
