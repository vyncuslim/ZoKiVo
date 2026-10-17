import {randomBytes,createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
export type MotherUser={id:string;email?:string;email_confirmed_at?:string|null;created_at?:string;user_metadata?:{full_name?:string;name?:string;zokivo_view_role?:string};app_metadata?:Record<string,unknown>};
export type Tokens={access_token:string;refresh_token:string;expires_in:number;user?:MotherUser};
export class AuthError extends Error{constructor(message:string,public status=400){super(message)}}
const ACCESS="zk_auth_access",REFRESH="zk_auth_refresh",PKCE="zk_auth_pkce",FLOW="zk_auth_flow",AFTER="zk_auth_after",RECOVERY="zk_auth_recovery";
export function config(){
 const raw=process.env.MOTHER_SUPABASE_URL,key=process.env.MOTHER_SUPABASE_PUBLISHABLE_KEY;
 if(!raw||!key)throw new AuthError("Mother Supabase authentication is not configured.",503);
 let url:URL;try{url=new URL(raw)}catch{throw new AuthError("Invalid Mother Supabase URL.",503)}
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)throw new AuthError("Mother Supabase URL must use HTTPS.",503);
 return {base:url.origin,apikey:key};
}
export function publicOrigin(req:NextRequest){
 if(process.env.ZOKIVO_PUBLIC_URL){const u=new URL(process.env.ZOKIVO_PUBLIC_URL);if(u.protocol!=="https:")throw new AuthError("Invalid ZOKIVO_PUBLIC_URL",503);return u.origin}
 return req.nextUrl.origin;
}
export function nextPath(next:string|null){
 if(!next||!next.startsWith("/")||next.startsWith("//")||next.includes("\\")||/[%\r\n]/.test(next)||next.startsWith("/api/"))return "/account";
 return next.slice(0,200);
}
export function checkOrigin(req:NextRequest){
 if(!req.headers.get("origin")||req.headers.get("origin")!==req.nextUrl.origin)throw new AuthError("Invalid request origin.",403);
}
export function noCache(data:unknown,status=200){return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}})}
export async function authFetch(endpoint:string,init:{method?:"GET"|"POST"|"PUT";body?:Record<string,unknown>;token?:string;query?:Record<string,string>}={}){
 const {base,apikey}=config(),url=new URL(base+"/auth/v1/"+endpoint);
 for(const [k,v] of Object.entries(init.query||{}))url.searchParams.set(k,v);
 let response:Response;
 try{response=await fetch(url,{method:init.method||"GET",headers:{"apikey":apikey,"Content-Type":"application/json",...(init.token?{"Authorization":"Bearer "+init.token}:{})},body:init.body?JSON.stringify(init.body):undefined,cache:"no-store",signal:AbortSignal.timeout(15000)})}catch{throw new AuthError("Authentication provider unavailable.",503)}
 const data=await response.json().catch(()=>({})) as Record<string,unknown>;
 if(!response.ok){
  const error=[data.msg,data.message,data.error_description,data.error].find(x=>typeof x==="string") as string|undefined;
  throw new AuthError(error?.slice(0,220)||"Authentication request failed.",response.status===429?429:response.status>=500?503:400);
 }
 return data;
}
export function parseTokens(data:Record<string,unknown>):Tokens|null{
 if(typeof data.access_token!=="string"||typeof data.refresh_token!=="string"||data.access_token.length>8192||data.refresh_token.length>8192)return null;
 const expiry=Number(data.expires_in);if(!Number.isFinite(expiry)||expiry<30)return null;
 return {access_token:data.access_token,refresh_token:data.refresh_token,expires_in:Math.min(expiry,86400),user:data.user as MotherUser|undefined};
}
function opts(req:NextRequest,maxAge:number){return {httpOnly:true,secure:req.nextUrl.protocol==="https:",sameSite:"lax" as const,path:"/",maxAge}}
export function setTokens(res:NextResponse,req:NextRequest,t:Tokens){
 res.cookies.set(ACCESS,t.access_token,opts(req,Math.max(30,t.expires_in-15)));
 res.cookies.set(REFRESH,t.refresh_token,opts(req,60*60*24*30));
}
export function clearTokens(res:NextResponse,req:NextRequest){
 for(const name of [ACCESS,REFRESH,RECOVERY])res.cookies.set(name,"",opts(req,0));
}
export function beginFlow(req:NextRequest,res:NextResponse,flow:"signup"|"google"|"recover",after="/account"){
 const verifier=randomBytes(48).toString("base64url"),challenge=createHash("sha256").update(verifier).digest("base64url");
 const lifetime=flow==="signup"?86400:flow==="recover"?3600:600;
 for(const [name,value] of [[PKCE,verifier],[FLOW,flow],[AFTER,nextPath(after)]] as const)res.cookies.set(name,value,opts(req,lifetime));
 return challenge;
}
export function flowCookies(req:NextRequest){return {verifier:req.cookies.get(PKCE)?.value,flow:req.cookies.get(FLOW)?.value,after:nextPath(req.cookies.get(AFTER)?.value||null)}}
export function clearFlow(res:NextResponse,req:NextRequest){for(const name of [PKCE,FLOW,AFTER])res.cookies.set(name,"",opts(req,0))}
export function setRecovery(res:NextResponse,req:NextRequest,enabled:boolean){res.cookies.set(RECOVERY,enabled?"1":"",opts(req,enabled?900:0))}
export function isRecovering(req:NextRequest){return req.cookies.get(RECOVERY)?.value==="1"}
export async function findUser(req:NextRequest):Promise<{user:MotherUser|null;renew?:Tokens}>{
 const access=req.cookies.get(ACCESS)?.value;
 if(access)try{const u=await authFetch("user",{token:access});if(typeof u.id==="string")return {user:u as MotherUser}}catch(e){if(e instanceof AuthError&&e.status===503)throw e}
 const refresh=req.cookies.get(REFRESH)?.value;if(!refresh)return {user:null};
 try{
  const result=await authFetch("token",{method:"POST",query:{grant_type:"refresh_token"},body:{refresh_token:refresh}});
  const renew=parseTokens(result);if(!renew)return {user:null};
  const u=await authFetch("user",{token:renew.access_token});
  if(typeof u.id!=="string")return {user:null};
  return {user:u as MotherUser,renew};
 }catch(e){if(e instanceof AuthError&&e.status===503)throw e;return {user:null}}
}
export function applyRenew(res:NextResponse,req:NextRequest,renew?:Tokens){if(renew)setTokens(res,req,renew);return res}
export function chosenRole(u:MotherUser):"student"|"teacher"{
 return u.user_metadata?.zokivo_view_role==="teacher"?"teacher":"student";
}
export function verifiedTeacher(u:MotherUser){
 const m=u.app_metadata||{};
 const roles=Array.isArray(m.zokivo_roles)?m.zokivo_roles:Array.isArray(m.roles)?m.roles:[];
 return m.zokivo_role==="teacher"||m.zokivo_role==="admin"||
  roles.includes("zokivo_teacher")||roles.includes("zokivo_admin");
}
export function safeUser(u:MotherUser){
 const n=u.user_metadata?.full_name||u.user_metadata?.name;
 return {id:u.id,email:u.email||"",emailVerified:!!u.email_confirmed_at,displayName:typeof n==="string"?n.slice(0,100):"",createdAt:u.created_at||null,role:chosenRole(u),teacherVerified:verifiedTeacher(u)};
}
export function authError(e:unknown){const er=e instanceof AuthError?e:new AuthError("Authentication temporarily unavailable.",503);return noCache({error:er.message},er.status)}
export function emailValue(v:unknown){const e=typeof v==="string"?v.trim().toLowerCase():"";return e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)?e:null}
export function passwordValue(v:unknown,min=1){return typeof v==="string"&&v.length>=min&&v.length<=256?v:null}
