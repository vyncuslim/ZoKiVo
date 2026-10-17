"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect,useState} from "react";
type User={id:string;email:string;emailVerified:boolean;displayName:string;createdAt:string|null;role:"student"|"teacher";teacherVerified:boolean};
export default function Account(){
 const router=useRouter(),[user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let mounted=true;
  void fetch("/api/auth/me",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Account service unavailable");
   if(!mounted)return;if(!j.authenticated){router.replace("/auth/login?next=/account");return}
   setUser(j.user);setLoading(false);
  }).catch(e=>{if(mounted){setError(e instanceof Error?e.message:"Unable to load account");setLoading(false)}});
  return()=>{mounted=false};
 },[router]);
 async function switchRole(next:"student"|"teacher"){
  if(!user||busy||user.role===next)return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/auth/role",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({role:next})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||"Could not switch account role");
   setUser(v=>v?{...v,role:next}:v);if(next==="teacher")router.push("/teacher");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Could not switch account role")}
  finally{setBusy(false)}
 }
 async function signOut(){
  setBusy(true);setError("");
  try{const r=await fetch("/api/auth/signout",{method:"POST"});if(!r.ok)throw Error("Could not sign out");router.replace("/auth/login");router.refresh()}
  catch(e){setError(e instanceof Error?e.message:"Could not sign out");setBusy(false)}
 }
 return <main className="auth-account wrap">
   <Link className="auth-back" href="/">← Back to ZoKivo</Link><span className="auth-eyebrow">VYNALTH AI · ZOKIVO ACCOUNT</span>
   <h1>{loading?"Verifying your session...":user?"Welcome, "+(user.displayName||"player")+"!":"My account"}</h1>
   {error&&<p className="auth-error" role="alert">{error}</p>}
   {user&&<section className="auth-account-profile"><div className="auth-avatar">{(user.displayName||user.email).slice(0,1).toUpperCase()}</div>
    <div><span className="auth-eyebrow">ACCOUNT DETAILS</span><h2>{user.displayName||"ZoKivo member"}</h2><p>{user.email}</p>
    <span className="auth-verified">{user.emailVerified?"✓ Email verified":"Email confirmation pending"}</span>
    <p className="auth-disclaimer">Your current ZoKivo experience is <strong>{user.role==="teacher"?"Teacher":"Student"}</strong>. Choosing Teacher opens teaching tools, but does not grant verified educator or administrator privileges.</p>
    <div className="auth-role-switch"><strong>Account mode</strong><p>Switch whenever your learning or teaching needs change.</p>
     <div className="auth-role-switch-actions"><button type="button" disabled={busy||user.role==="teacher"} onClick={()=>void switchRole("teacher")}>Switch to Teacher Account</button>
     <button type="button" disabled={busy||user.role==="student"} onClick={()=>void switchRole("student")}>Switch to Student Account</button></div>
     {user.role==="teacher"&&<p role="status">{user.teacherVerified?"✓ Verified teacher: publication tools enabled.":"Teacher workspace enabled. Publishing quizzes requires educator verification."}</p>}
    </div>
    <div className="auth-account-actions"><Link className="button button-dark" href={user.role==="teacher"?"/teacher":"/games"}>{user.role==="teacher"?"Teacher workspace →":"Explore games →"}</Link><Link className="button button-outline" href="/host">Host game →</Link>
    <button type="button" className="button button-outline" disabled={busy} onClick={()=>void signOut()}>{busy?"Signing out...":"Sign out"}</button></div>
    </div></section>}
  </main>
}
