"use client";
import { useRouter } from "next/navigation";
import { useEffect,useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand";
import {AVATARS,avatarId} from "@/lib/avatars";
export default function Play() {
 const [pin,setPin]=useState("");const[nickname,setNickname]=useState("");const[avatar,setAvatar]=useState("spark");const[ownedAvatars,setOwnedAvatars]=useState<string[]>(AVATARS.filter(a=>a.price===0).map(a=>a.id));const[error,setError]=useState("");const[busy,setBusy]=useState(false),[randomNames,setRandomNames]=useState(false),[roomOpen,setRoomOpen]=useState(true);const router=useRouter();
 useEffect(()=>{
  void fetch("/api/avatars",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(j=>{
   if(j?.avatars){setOwnedAvatars(j.avatars.filter((x:{unlocked:boolean})=>x.unlocked).map((x:{id:string})=>x.id));if(j.equipped)setAvatar(j.equipped)}
  }).catch(()=>{});
 },[]);
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
  sessionStorage.setItem("player:"+pin,j.token);
  if(typeof j.readToken==="string")sessionStorage.setItem("read:"+pin,j.readToken);
  else sessionStorage.removeItem("read:"+pin);
  router.push("/game/"+pin);
 }catch(e){setError(e instanceof Error?e.message:"Couldn't join this game")}finally{setBusy(false)}}
 return <main className="zk-easy-page zk-join-page wrap">
  <section className="zk-easy-card zk-join-card" aria-labelledby="zk-join-title">
   <div className="zk-join-mascot" aria-hidden="true"><BrandMark size={92}/></div>
   <span className="zk-kicker">STUDENTS · NO ACCOUNT NEEDED</span>
   <h1 id="zk-join-title">Ready to play? ✨</h1>
   <p className="zk-join-lead">Get a six-digit PIN from your teacher, then jump in!</p>
   <form onSubmit={join} className="entry-form zk-join-form">
    <label htmlFor="game-pin">1 · Enter game PIN</label>
    <input id="game-pin" className="pin-input" autoComplete="off" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} required/>
    <label htmlFor="nickname">2 · Pick your name</label>
    <input id="nickname" className="name-input" autoComplete="nickname" maxLength={24} minLength={randomNames?0:2} disabled={randomNames} required={!randomNames} placeholder={randomNames?"Your teacher chooses random names":"Your game nickname"} value={nickname} onChange={e=>setNickname(e.target.value)}/>
    <details className="zk-simple-advanced zk-avatar-options">
     <summary>🌟 Pick a character <span>Optional</span></summary>
     <fieldset className="zokivo-avatar-chooser"><legend>YOUR GAME CHARACTER</legend>
      <div className="zokivo-avatar-grid">{AVATARS.map(a=><button key={a.id} type="button" aria-label={a.label} aria-pressed={avatar===a.id} disabled={!ownedAvatars.includes(a.id)} title={ownedAvatars.includes(a.id)?a.label:a.label+" · Locked"} className={"zokivo-avatar-option"+(avatar===a.id?" selected":"")} onClick={()=>setAvatar(a.id)}>{a.symbol}{!ownedAvatars.includes(a.id)&&<small>🔒</small>}</button>)}</div>
     </fieldset><p className="zk-small-hint"><a href="/locker">Discover more original ZoKivo characters →</a></p>
    </details>
    <button className="zk-primary-action" type="submit" disabled={busy||!roomOpen||pin.length!==6||(!randomNames&&nickname.trim().length<2)}>{busy?"Joining game…":"Join game →"}</button>
    {randomNames&&<p className="zk-small-hint">Your host enabled random names.</p>}
    {!roomOpen&&<p className="form-error" role="status">This game isn't accepting more players.</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
   </form>
   <p className="zk-small-hint">No student account needed · Learn together · Have fun!</p>
  </section>
 </main>;
}
