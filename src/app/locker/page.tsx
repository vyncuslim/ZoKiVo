"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
type Avatar={id:string;symbol:string;label:string;price:number;unlocked:boolean};
type Wallet={signedIn:boolean;xp:number;tokens:number;equipped:string;avatars:Avatar[]};
export default function Locker(){
 const[data,setData]=useState<Wallet|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(""),[notice,setNotice]=useState("");
 const reload=useCallback(async()=>{
  const r=await fetch("/api/avatars",{cache:"no-store"}),j=await r.json();
  if(!r.ok)throw Error(j.error||"Collection is unavailable");
  setData(j);
 },[]);
 useEffect(()=>{void reload().catch(e=>setError(e instanceof Error?e.message:"Could not load collection"))},[reload]);
 async function action(type:"unlock"|"equip",id:string){
  if(busy)return;
  setBusy(id);setError("");setNotice("");
  try{
   const r=await fetch("/api/avatars",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:type,avatar:id})});
   const j=await r.json();if(!r.ok)throw Error(j.error||"Action failed");
   setNotice(type==="unlock"?"Character unlocked!":"Character equipped for your next game.");
   await reload();
  }catch(e){setError(e instanceof Error?e.message:"Collection could not be updated")}finally{setBusy("")}
 }
 return <main className="locker-page wrap">
  <nav className="quiz-breadcrumb"><Link href="/games">← Games</Link><span>/ ZoKivo Locker</span></nav>
  <header className="locker-heading"><span className="eyebrow eyebrow--mini">COLLECT & CUSTOMIZE</span><h1>Meet your <em>ZoKivo crew.</em></h1><p>Earn non-transferable Study tokens by answering published quiz questions correctly. Unlock original characters and choose who represents you.</p>
   <div className="locker-stats"><span>✨ {data?.xp??0} XP</span><span>🪙 {data?.tokens??0} tokens</span><span>⭐ {data?.avatars.filter(x=>x.unlocked).length??8}/12 available</span></div>
   {!data?.signedIn&&<p><Link className="button button-yellow" href="/auth/login?next=/locker">Sign in to save your collection →</Link></p>}
  </header>
  <section className="locker-grid" aria-label="ZoKivo avatar collection">
   {data?.avatars.map(a=><article key={a.id} className={"locker-avatar"+(a.unlocked?"":" locker-avatar-locked")}>
    <div className="locker-character" aria-hidden="true">{a.symbol}</div>
    <h2>{a.label}</h2>
    <p>{a.price===0?"Starter character":a.unlocked?"Collected":"Unlock for "+a.price+" tokens"}</p>
    {data.signedIn&&(data.equipped===a.id?<span className="locker-equipped">✓ Equipped</span>:
     <button type="button" disabled={!!busy||(!a.unlocked&&data.tokens<a.price)} onClick={()=>void action(a.unlocked?"equip":"unlock",a.id)}>
      {busy===a.id?"Please wait…":a.unlocked?"Equip →":"Unlock · "+a.price+" tokens"}
     </button>)}
   </article>)}
  </section>
  {notice&&<p role="status" className="quiz-success">{notice}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
  <div className="locker-footer"><p>Daily rewards: one token and 20 XP for the first correct answer to each question in a quiz each day. Characters and tokens have no cash value.</p><Link className="button button-dark" href="/study">Practice to earn tokens ↗</Link><Link className="button button-outline" href="/play">Join a game</Link></div>
 </main>;
}
