/* Executed before each build; verifies real Mother Auth module with local mock provider.
   Never contacts a live Supabase project or uses a real credential. */
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),ts=require("typescript");
function tsLoad(file){
 const js=ts.transpileModule(fs.readFileSync(path.resolve(file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};new Function("require","module","exports",js)(require,mod,mod.exports);return mod.exports;
}
const {NextRequest,NextResponse}=require("next/server");
const a=tsLoad("src/lib/mother-auth.ts");
let checks=0;function ok(value,msg){assert.ok(value,msg);checks++}
process.env.MOTHER_SUPABASE_URL="https://test-mother-project.supabase.co";
process.env.MOTHER_SUPABASE_PUBLISHABLE_KEY="sb_publishable_non_secret_for_unit_tests";
function req(route,headers={}){return new NextRequest("https://zokivo.vercel.app"+route,{headers})}
ok(a.nextPath("/host")==="/host","host return path allowed");
ok(a.nextPath("//evil.example")==="/account","protocol-relative redirect rejected");
ok(a.nextPath("/api/logout")==="/account","API redirect rejected");
ok(a.nextPath("/%5cevil")==="/account","encoded bypass redirect rejected");
ok(a.emailValue(" TEST@EXAMPLE.COM ")==="test@example.com","email normalization");
ok(a.emailValue("invalid")===null,"invalid email rejected");
ok(a.passwordValue("a".repeat(8),8)!==null,"valid signup password");
ok(a.passwordValue("x",8)===null,"short signup password rejected");
const googleSource=fs.readFileSync("src/app/api/auth/google/route.ts","utf8");
const googleCallback=fs.readFileSync("src/app/auth/callback/route.ts","utf8");
const signupUi=fs.readFileSync("src/components/auth-form.tsx","utf8");
const accountUi=fs.readFileSync("src/app/account/page.tsx","utf8");
ok(googleSource.includes('signup_role')&&googleSource.includes("zk_auth_signup_role"),"Google registration carries user-selected role as short-lived HttpOnly preference");
ok(googleCallback.includes('method:"PUT"')&&googleCallback.includes('zokivo_view_role:signupRole'),"Google callback persists only non-privileged view preference through signed-in user token");
ok(googleCallback.includes('signupRole==="teacher"')&&googleCallback.includes('target="/teacher"'),"Google signup can land in teacher workspace on verified preference update");
ok(signupUi.includes('signup_role="+role')&&signupUi.includes('mode==="register"&&role==="teacher"'),"Registration honors role for both Google and email paths");
ok(accountUi.includes('router.push("/teacher")'),"Switching to Teacher opens the teaching workspace");

ok(a.chosenRole({id:"a"})==="student","Unset accounts default to Student view");
ok(a.chosenRole({id:"a",user_metadata:{zokivo_view_role:"teacher"}})==="teacher","Teacher preference is honored as view");
ok(a.chosenRole({id:"a",user_metadata:{zokivo_view_role:"administrator"}})==="student","Unknown preference is not privileged");
ok(!a.verifiedTeacher({id:"a",user_metadata:{zokivo_view_role:"teacher"}}),"Self-selected teacher has no verified educator authority");
ok(a.verifiedTeacher({id:"a",app_metadata:{zokivo_role:"teacher"}}),"Verified educator requires trusted app_metadata");
const rolesRoute=fs.readFileSync("src/app/api/auth/role/route.ts","utf8");
ok(rolesRoute.includes("checkOrigin(req)")&&rolesRoute.includes('method:"PUT"')&&rolesRoute.includes("findUser(req)"),"Role endpoint authenticates, guards CSRF, updates user metadata");
const signupSource=fs.readFileSync("src/app/api/auth/signup/route.ts","utf8");
ok(signupSource.includes("zokivo_view_role:role")&&signupSource.includes('role==="teacher"'),"Signup supports declared account roles");
const publishSource=fs.readFileSync("src/app/api/quizzes/[id]/publish/route.ts","utf8");
ok(publishSource.includes("teacherApproved(user!)"),"Published quizzes remain restricted to verified educators");
const assignRoute=fs.readFileSync("src/app/api/assignments/route.ts","utf8");
ok(assignRoute.includes("checkOrigin(req)")&&assignRoute.includes("chosenRole(user!)")&&assignRoute.includes("q.status='published'"),"Assignment creation requires authenticated teacher view and published quiz");

a.checkOrigin(req("/api/auth/signin",{origin:"https://zokivo.vercel.app"}));ok(true,"same-origin POST allowed");
try{a.checkOrigin(req("/api/auth/signin",{origin:"https://evil.example"}));assert.fail("CSRF allowed")}catch(e){ok(e.status===403,"cross-site POST rejected")}
const response=NextResponse.json({ok:true});
const challenge=a.beginFlow(req("/api/auth/google"),response,"google");
ok(/^[A-Za-z0-9_-]{43}$/.test(challenge),"SHA-256 S256 PKCE challenge generated");
const cookies=response.headers.get("set-cookie")||"";
ok(cookies.includes("HttpOnly")&&cookies.includes("Secure")&&cookies.includes("SameSite=lax"),"PKCE cookies are HttpOnly, Secure, SameSite Lax");
const t={access_token:"test_access_token",refresh_token:"test_refresh_token",expires_in:3600};
const signed=NextResponse.json({ok:true});a.setTokens(signed,req("/api/auth/me"),t);
const set=signed.headers.get("set-cookie")||"";
ok(set.includes("zk_auth_access")&&set.includes("zk_auth_refresh")&&set.includes("HttpOnly"),"token cookies secure and HttpOnly");
const originalFetch=global.fetch;
let tokenCalls=0,userCalls=0;
global.fetch=async (url,init)=>{
 const u=new URL(String(url));const authorization=init?.headers?.Authorization;
 ok(init.headers.apikey===process.env.MOTHER_SUPABASE_PUBLISHABLE_KEY,"only publishable Auth key sent");
 if(u.pathname==="/auth/v1/user"){
   userCalls++;
   if(authorization==="Bearer test_access_token"||authorization==="Bearer restored_access")return new Response(JSON.stringify({id:"example-user",email:"user@example.com",email_confirmed_at:"2026-01-01T00:00:00Z"}),{status:200});
   return new Response(JSON.stringify({message:"Invalid JWT"}),{status:401});
 }
 if(u.pathname==="/auth/v1/token"&&u.searchParams.get("grant_type")==="refresh_token"){
   tokenCalls++;
   return new Response(JSON.stringify({access_token:"restored_access",refresh_token:"new_refresh",expires_in:3600}),{status:200});
 }
 throw Error("Unexpected Supabase path "+u.pathname);
};
(async()=>{
 try{
  const first=await a.findUser(req("/api/auth/me",{cookie:"zk_auth_access=test_access_token; zk_auth_refresh=test_refresh_token"}));
  ok(first.user?.id==="example-user"&&!first.renew,"valid token verified with Supabase /user");
  const expired=await a.findUser(req("/api/auth/me",{cookie:"zk_auth_access=expired; zk_auth_refresh=test_refresh_token"}));
  ok(expired.user?.id==="example-user"&&expired.renew?.access_token==="restored_access","invalid JWT recovered using refresh token and verified /user");
  ok(tokenCalls===1&&userCalls===3,"expected refresh and validation calls");
  const none=await a.findUser(req("/api/auth/me"));
  ok(none.user===null,"unauthenticated user is null");
  console.log("AUTH_BOUNDARY_TEST_PASS: "+checks+" assertions; no live credentials or real users.");
 }finally{global.fetch=originalFetch}
})().catch(e=>{console.error("AUTH_BOUNDARY_TEST_FAILED",e.stack||e);process.exitCode=1});
