"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand";
export default function Play() {
 const [pin,setPin]=useState("");const[nickname,setNickname]=useState("");const[error,setError]=useState("");const[busy,setBusy]=useState(false);const router=useRouter();
 async function join(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");try{
  const r=await fetch("/api/rooms/"+pin+"/join",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nickname})});const j=await r.json();
  if(!r.ok)throw Error(j.error || "Couldn't join this game");
  sessionStorage.setItem("player:"+pin,j.token);router.push("/game/"+pin);
 }catch(e){setError(e instanceof Error?e.message:"Couldn't join this game")}finally{setBusy(false)}}
 return <main className="inner-page wrap"><div className="split-panel">
  <aside className="split-showcase split-showcase-purple"><div className="showcase-badge">GOOD TIMES AHEAD ✳</div><div className="showcase-mascot"><BrandMark size={220}/></div><h2>Get in.<br/><span>Get game.</span></h2><p>Six digits are all that stand between you and the fun.</p><div className="showcase-deco">PLAY • LEARN • WIN</div></aside>
  <section className="form-pane"><span className="eyebrow eyebrow--mini">PLAYER ENTRANCE</span><h1>Have a <span>PIN?</span><br/>Let&apos;s go!</h1><p className="form-lead">Your host has the code. You bring the good energy.</p>
   <form onSubmit={join} className="entry-form"><label htmlFor="game-pin">GAME PIN <span>6 DIGITS</span></label><input id="game-pin" className="pin-input" autoComplete="off" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000 000" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} required/>
   <label htmlFor="nickname">YOUR NICKNAME <span>2–24 CHARACTERS</span></label><input id="nickname" className="name-input" autoComplete="nickname" maxLength={24} minLength={2} placeholder="e.g. SuperNova" value={nickname} onChange={e=>setNickname(e.target.value)} required/>
   <button className="button button-dark button-full" type="submit" disabled={busy||pin.length!==6||nickname.trim().length<2}>{busy?"Joining the game...":"I'm in!  ↗"}</button>
   {error&&<p className="form-error" role="alert">{error}</p>}</form>
   <p className="form-footnote">No account needed to join. Just pick a nickname. ✦</p>
  </section></div></main>;
}
