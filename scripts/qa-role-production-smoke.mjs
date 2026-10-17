/** Non-destructive live smoke: no account data or test users, only anonymous authorization checks. */
const BASE="https://zokivo.vercel.app";
let bad=false;
async function check(name,path,method="GET",payload,expected=200,validate){
 const res=await fetch(BASE+path,{method,redirect:"manual",cache:"no-store",
  headers:{Origin:BASE,Accept:"application/json",...(payload?{"Content-Type":"application/json"}:{})},
  body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(16000)});
 const text=await res.text(),data=(()=>{try{return JSON.parse(text)}catch{return {}}})();
 const ok=res.status===expected&&(!validate||validate(data,text));
 console.log(JSON.stringify({name,status:res.status,expected,ok,code:typeof data.error==="string"?data.error.slice(0,60):undefined}));
 if(!ok)bad=true;
}
await check("anonymous account profile","/api/auth/me","GET",null,200,j=>j.authenticated===false);
await check("role switch rejects anonymous","/api/auth/role","POST",{role:"teacher"},401);
await check("teacher assignment list rejects anonymous","/api/assignments","GET",null,401);
await check("teacher assignment creation rejects anonymous","/api/assignments","POST",{quizId:"b91f4600-1000-4000-8000-000000000001",title:"untrusted"},401);
await check("unknown assignment not exposed","/api/assignments/00000000-0000-4000-8000-000000000000","GET",null,404);
await check("teacher workspace HTML","/teacher","GET",null,200,(_j,t)=>t.includes("Teacher workspace"));
await check("new registration HTML","/auth/register","GET",null,200,(_j,t)=>t.includes("Student")&&t.includes("Teacher"));
console.log("ROLE_PRODUCTION_SMOKE_RESULT="+(bad?"FAIL":"PASS"));
if(bad)process.exitCode=1;
