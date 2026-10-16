"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect,useState} from "react";
type User={id:string;email:string;emailVerified:boolean;displayName:string;createdAt:string|null};
export default function Account(){
 const router=useRouter(),[user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let mounted=true;
  void fetch("/api/auth/me",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Account service unavailable");
   if(!mounted)return;if(!j.authenticated){router.replace("/auth/login?next=/account");return}
   setUser(j.user);setLoading(false);
  }).catch(e=>{if(mounted){setError(e instanceof Error?e.message:"Unable to load account");setLoading(false)}});
  return()=>{mounted=false};
 },[router]);
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
    <p className="auth-disclaimer">This account uses Vynalth AI's Mother Supabase identity. Being signed in does not automatically grant verified teacher or administrator privileges.</p>
    <div className="auth-account-actions"><Link className="button button-dark" href="/games">Explore games →</Link><Link className="button button-outline" href="/host">Host game →</Link>
    <button type="button" className="button button-outline" disabled={busy} onClick={()=>void signOut()}>{busy?"Signing out...":"Sign out"}</button></div>
    </div></section>}
  </main>
}
