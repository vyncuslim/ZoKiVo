"use client";
import { useRouter } from "next/navigation";
import { useEffect,useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand";
import {AVATARS,avatarId} from "@/lib/avatars";
export default function Play() {
 const [pin,setPin]=useState("");const[nickname,setNickname]=useState("");const[avatar,setAvatar]=useState("spark");const[error,setError]=useState("");const[busy,setBusy]=useState(false),[randomNames,setRandomNames]=useState(false),[roomOpen,setRoomOpen]=useState(true);const router=useRouter();
 useEffect(()=>{const candidate=new URLSearchParams(window.location.search).get("pin");if(candidate&&/^\d{6}$/.test(candidate))setPin(candidate)},[]);
 useEffect(()=>{
  if(pin.length!==6){setRandomNames(false);setRoomOpen(true);return}
  let alive=true;
  void fetch("/api/rooms/"+pin+"/settings",{cache:"no-store"})
   .then(r=>r.ok?r.json():null).then(j=>{if(alive&&j){setRandomNames(j.randomNames===true);setRoomOpen(j.acceptingPlayers===true)}}).catch(()=>{});
  return()=>{alive=false};
 },[pin]);
 async function join(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");try{
  const r=await fetch("/api/rooms/"+pin+"/join",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nickname,avatar:avatarId(avatar)})});const j=await r.json();
  if(!r.ok)throw Error(j.error || "Couldn't join this game");
  sessionStorage.setItem("player:"+pin,j.token);router.push("/game/"+pin);
 }catch(e){setError(e instanceof Error?e.message:"Couldn't join this game")}finally{setBusy(false)}}
 return <main className="inner-page wrap"><div className="split-panel">
  <aside className="split-showcase split-showcase-purple"><div className="showcase-badge">GOOD TIMES AHEAD ✳</div><div className="showcase-mascot"><BrandMark size={220}/></div><h2>Get in.<br/><span>Get game.</span></h2><p>Six digits are all that stand between you and the fun.</p><div className="showcase-deco">PLAY • LEARN • WIN</div></aside>
  <section className="form-pane"><span className="eyebrow eyebrow--mini">PLAYER ENTRANCE</span><h1>Have a <span>PIN?</span><br/>Let&apos;s go!</h1><p className="form-lead">Your host has the code. You bring the good energy.</p>
   <form onSubmit={join} className="entry-form"><label htmlFor="game-pin">GAME PIN <span>6 DIGITS</span></label><input id="game-pin" className="pin-input" autoComplete="off" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000 000" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} required/>
   <label htmlFor="nickname">YOUR NICKNAME <span>2–24 CHARACTERS</span></label><input id="nickname" className="name-input" autoComplete="nickname" maxLength={24} minLength={randomNames?0:2} disabled={randomNames} required={!randomNames} placeholder={randomNames?"Your host will assign a nickname":"e.g. SuperNova"} value={nickname} onChange={e=>setNickname(e.target.value)} required/>
   <fieldset className="zokivo-avatar-chooser"><legend>CHOOSE YOUR LOOK <span>JUST FOR THIS GAME</span></legend><div className="zokivo-avatar-grid">{AVATARS.map(a=><button key={a.id} type="button" aria-label={a.label} aria-pressed={avatar===a.id} title={a.label} className={"zokivo-avatar-option"+(avatar===a.id?" selected":"")} onClick={()=>setAvatar(a.id)}>{a.symbol}</button>)}</div></fieldset>
   <button className="button button-dark button-full" type="submit" disabled={busy||!roomOpen||pin.length!==6||(!randomNames&&nickname.trim().length<2)}>{busy?"Joining the game...":"I'm in!  ↗"}</button>
   {randomNames&&<p className="form-footnote">Your host enabled randomly assigned nicknames.</p>}{!roomOpen&&<p className="form-error" role="status">This room is not accepting new players.</p>}
   {error&&<p className="form-error" role="alert">{error}</p>}</form>
   <p className="form-footnote">No account needed to join. Just pick a nickname. ✦</p>
  </section></div></main>;
}
