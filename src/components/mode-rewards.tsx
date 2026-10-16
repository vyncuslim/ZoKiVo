"use client";
import {useEffect,useState} from "react";
import {gameModeName} from "@/lib/game-modes";
type Rival={id:string;nickname:string};
type Wallet={reward_ready?:boolean;credits?:number;fish?:number;served?:number;cafe_level?:number;defense_code?:number};
export function ModeRewards({mode,pin,token,playerId,players,wallet,onClaim}:{
 mode:string;pin:string;token:string;playerId:string|null;players:Rival[];wallet?:Wallet|null;onClaim:()=>Promise<void>;
}){
 const [option,setOption]=useState(0),[action,setAction]=useState(""),[target,setTarget]=useState(""),[loading,setLoading]=useState(false),[result,setResult]=useState(""),[error,setError]=useState("");
 useEffect(()=>{setResult("");setError("");setOption(0);setAction("")},[mode,pin,wallet?.reward_ready]);
 if(mode==="quiz_party"||!playerId)return null;
 const rivals=players.filter(p=>p.id!==playerId);
 const ready=wallet?.reward_ready===true;
 const button=(text:string,act:string,opt:number)=><button type="button" className="mode-reward-choice" disabled={!ready||loading} key={act+opt}
  onClick={()=>void claim(act,opt)}>{text}</button>;
 async function claim(act:string,opt:number){
  if(!ready||loading)return;
  setLoading(true);setError("");
  try{
   const r=await fetch("/api/rooms/"+pin+"/reward",{method:"POST",headers:{"Content-Type":"application/json","x-player-token":token},body:JSON.stringify({action:act,option:opt,target:target||null})});
   const j=await r.json();if(!r.ok)throw Error(j.error||"Reward unavailable");
   setResult(j.reward.outcome+" · +"+j.reward.earned+" virtual credits");
   await onClaim();
  }catch(e){setError(e instanceof Error?e.message:"Could not claim reward")}
  finally{setLoading(false)}
 }
 return <section className="mode-rewards" aria-label={gameModeName(mode)+" reward"}>
  <div className="mode-reward-heading"><span>ORIGINAL ZOKIVO MINIGAME</span><h3>{gameModeName(mode)}</h3>
   <p>{mode==="crypto_hack"?"Mine credits or solve a rival's three-key challenge.":
        mode==="gold_quest"?"Open a treasure chest. Rare rewards can transfer a small amount from a rival.":
        mode==="fishing_frenzy"?"Choose a fishing spot to earn your catch and virtual points.":
        "Serve customers and unlock café levels as orders accumulate."}</p>
  </div>
  <div className="mode-reward-stats"><span>⭐ {wallet?.credits??0} credits</span>
   {mode==="fishing_frenzy"&&<span>🐟 {wallet?.fish??0} catches</span>}
   {mode==="cafe"&&<><span>🍰 {wallet?.served??0} orders</span><span>🏪 Level {wallet?.cafe_level??1}</span></>}
   {mode==="crypto_hack"&&<span>🔑 Your defense key: {["Sun","Moon","Star"][wallet?.defense_code??0]}</span>}
  </div>
  {ready?<div className="mode-reward-actions">
   {mode==="gold_quest"&&<>
    {rivals.length>0&&<label>Optional rival challenge<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">No rival</option>{rivals.map(p=><option value={p.id} key={p.id}>{p.nickname}</option>)}</select></label>}
    <div className="mode-reward-buttons">{button("🎁 Chest A","chest",0)}{button("🗝️ Chest B","chest",1)}{button("✨ Chest C","chest",2)}</div>
   </>}
   {mode==="crypto_hack"&&<>
    {rivals.length>0&&<div className="mode-reward-controls"><label>Target player<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose rival</option>{rivals.map(p=><option key={p.id} value={p.id}>{p.nickname}</option>)}</select></label><label>Code to guess<select value={option} onChange={e=>setOption(Number(e.target.value))}><option value={0}>Sun</option><option value={1}>Moon</option><option value={2}>Star</option></select></label></div>}
    <div className="mode-reward-buttons">{button("⛏️ Mine credits","mine",0)}{rivals.length>0&&target&&button("🔓 Try code challenge","hack",option)}</div>
   </>}
   {mode==="fishing_frenzy"&&<div className="mode-reward-buttons">{button("🐠 Lagoon","fish",0)}{button("🐬 Deep sea","fish",1)}</div>}
   {mode==="cafe"&&<div className="mode-reward-buttons">{button("🧃 Serve juice","serve",0)}{button("🥪 Serve sandwich","serve",1)}{button("🍰 Serve cake","serve",2)}</div>}
  </div>:<p className="mode-reward-wait">{result||"Answer correctly to unlock one mini-game reward per question."}</p>}
  {result&&ready&&<p className="mode-reward-success" role="status">{result}</p>}
  {error&&<p role="alert" className="form-error">{error}</p>}
 </section>;
}
