"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
type Mode="login"|"register"|"forgot"|"reset";
const headings:Record<Mode,[string,string]>={
 login:["Welcome back!","Sign in with your Vynalth AI account."],
 register:["Let's get you playing.","One Vynalth AI account for ZoKivo and more."],
 forgot:["Forgot your password?","We'll email you a reset link."],
 reset:["Choose a new password.","Secure your account with a new password."]
};
function nextUrl(){
 const x=new URLSearchParams(location.search).get("next")||"";
 return x.startsWith("/")&&!x.startsWith("//")&&!x.includes("\\")&&!x.includes("%")&&!x.startsWith("/api/")?x:"/account";
}
export function AuthForm({mode}:{mode:Mode}){
 const router=useRouter(),[email,setEmail]=useState(""),[name,setName]=useState(""),[password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
 const [role,setRole]=useState<"student"|"teacher">("student");
 const [working,setWorking]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[showPassword,setShowPassword]=useState(false);
 useEffect(()=>{if(new URLSearchParams(location.search).has("error"))setError("The authentication link failed or expired. Please try again.")},[]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setWorking(true);setMessage("");setError("");
  if((mode==="register"||mode==="reset")&&confirmation!==password){setError("Passwords do not match.");setWorking(false);return}
  const action={login:"signin",register:"signup",forgot:"recover",reset:"reset"}[mode];
  try{
   const r=await fetch("/api/auth/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,name,password,role}),cache:"no-store"});
   const result=await r.json().catch(()=>({}));if(!r.ok)throw Error(result.error||"Authentication failed");
   if(mode==="register"&&result.needsEmailConfirmation){setMessage("Check your email for a confirmation link. Please open it in the same browser.");return}
   if(mode==="forgot"){setMessage("If your email is registered, a reset link has been sent. Open it in the same browser.");return}
   if(mode==="reset"){setMessage("Password updated. Please sign in with your new password.");return}
   router.replace(nextUrl());router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Authentication failed")}finally{setWorking(false)}
 }
 return <main className="auth-root wrap">
  <aside className="auth-illustration" aria-hidden="true"><div><span>✦ THE QUIZ STARTS HERE</span><strong>PLAY.<br/>LEARN.<br/>WIN!</strong><span>★ MADE FOR THE CURIOUS</span></div></aside>
  <section className="auth-card">
    <span className="auth-eyebrow">ZOKIVO ACCOUNT · VYNALTH AI</span>
    <h1>{headings[mode][0]}</h1><p className="auth-subtitle">{headings[mode][1]}</p>
    {(mode==="login"||mode==="register")&&<a className="auth-google" href="/api/auth/google?next=/account">Continue with Google <b>↗</b></a>}
    {(mode==="login"||mode==="register")&&<div className="auth-separator">or use email</div>}
    <form className="auth-form" onSubmit={e=>void submit(e)}>
     {mode==="register"&&<fieldset className="auth-role-picker"><legend>Choose how you will use ZoKivo</legend>
      <label><input type="radio" name="role" value="student" checked={role==="student"} onChange={()=>setRole("student")}/><span><strong>🎒 Student</strong><small>Join games, study, track your learning.</small></span></label>
      <label><input type="radio" name="role" value="teacher" checked={role==="teacher"} onChange={()=>setRole("teacher")}/><span><strong>🏫 Teacher</strong><small>Access teaching workspace, draft quizzes, host games and share assignments. Publishing requires verification.</small></span></label>
     </fieldset>}
     {mode==="register"&&<label>Display name<input type="text" autoComplete="name" placeholder="Your name" minLength={2} maxLength={100} required value={name} onChange={e=>setName(e.target.value)}/></label>}
     {mode!=="reset"&&<label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)}/></label>}
     {mode!=="forgot"&&<label>{mode==="reset"?"New password":"Password"}<span className="auth-password"><input type={showPassword?"text":"password"} autoComplete={mode==="login"?"current-password":"new-password"} placeholder={mode==="login"?"Your password":"At least 8 characters"} minLength={mode==="login"?1:8} maxLength={256} required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setShowPassword(x=>!x)}>{showPassword?"Hide":"Show"}</button></span></label>}
     {(mode==="register"||mode==="reset")&&<label>Confirm password<input type="password" autoComplete="new-password" placeholder="Repeat password" minLength={8} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>}
     {mode==="login"&&<div className="auth-forgot"><Link href="/auth/forgot">Forgot password?</Link></div>}
     {error&&<div className="auth-error" role="alert">{error}</div>}
     {message&&<div className="auth-success" role="status">{message}{mode==="reset"&&<> <Link href="/auth/login">Sign in</Link></>}</div>}
     <button className="auth-submit" disabled={working} type="submit">{working?"Working...":mode==="login"?"Sign in →":mode==="register"?"Create account →":mode==="forgot"?"Send reset email →":"Update password →"}</button>
    </form>
    <p className="auth-switch">{mode==="login"?<>New to ZoKivo? <Link href="/auth/register">Create account</Link></>:mode==="register"?<>Already have an account? <Link href="/auth/login">Sign in</Link></>:<>Remember your password? <Link href="/auth/login">Sign in</Link></>}</p>
    <p className="auth-disclaimer">ZoKivo uses Mother Supabase Auth. You can still <Link href="/play">play using a PIN</Link> without an account. Younger students should register with parent or teacher guidance.</p>
  </section>
 </main>;
}