"use client";
import {useEffect,useState} from "react";
import {gameModeName} from "@/lib/game-modes";
type Rival={id:string;nickname:string};
type Wallet={reward_ready?:boolean;credits?:number;fish?:number;served?:number;cafe_level?:number;defense_code?:number};
type Props={mode:string;pin:string;token:string;playerId:string|null;players:Rival[];wallet?:Wallet|null;onClaim:()=>Promise<void>};
const descriptions:Record<string,string>={
 gold_quest:"Open one of three mystery pods. What will you discover?",
 crypto_hack:"Collect virtual coins or try a fun three-symbol puzzle.",
 fishing_frenzy:"Pick a place to cast your line. See what you catch!",
 cafe:"Serve a tasty order to grow your ZoKivo café."
};
export function ModeRewards({mode,pin,token,playerId,players,wallet,onClaim}:Props){
 const [option,setOption]=useState(0),[target,setTarget]=useState(""),[loading,setLoading]=useState(false),
 [result,setResult]=useState(""),[error,setError]=useState("");
 useEffect(()=>{setResult("");setError("");setOption(0);setTarget("")},[mode,pin]);
 if(mode==="quiz_party"||!playerId)return null;
 const rivals=players.filter(p=>p.id!==playerId);
 const ready=wallet?.reward_ready===true;
 async function claim(act:string,opt:number){
  if(!ready||loading)return;
  setLoading(true);setError("");
  try{
   const r=await fetch("/api/rooms/"+pin+"/reward",{method:"POST",
    headers:{"Content-Type":"application/json","x-player-token":token},
    body:JSON.stringify({action:act,option:opt,target:target||null})});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||"Reward unavailable");
   setResult(j.reward.outcome+" · "+j.reward.earned+" virtual credits");
   await onClaim();
  }catch(e){setError(e instanceof Error?e.message:"Could not claim reward")}
  finally{setLoading(false)}
 }
 const button=(icon:string,title:string,hint:string,act:string,opt:number)=>
  <button key={act+"-"+opt} type="button" className="zk-reward-tile mode-reward-choice"
   disabled={!ready||loading} onClick={()=>void claim(act,opt)}>
   <span className="zk-reward-tile-icon" aria-hidden="true">{icon}</span>
   <strong>{title}</strong><small>{hint}</small>
  </button>;
 return <section className="mode-rewards zk-rewards-focus" aria-label={gameModeName(mode)+" reward"}>
  <div className="mode-reward-heading">
   <span>ZOKIVO MINI-GAME · YOUR TURN</span>
   <h3>{gameModeName(mode)}</h3>
   <p>{descriptions[mode]||"Choose a bonus to keep playing."}</p>
  </div>
  <div className="mode-reward-stats" aria-label="Your game stats">
   <span>✦ {wallet?.credits??0} coins</span>
   {mode==="fishing_frenzy"&&<span>🐟 {wallet?.fish??0} fish</span>}
   {mode==="cafe"&&<span>🥪 {wallet?.served??0} served</span>}
   {mode==="cafe"&&<span>⭐ Level {wallet?.cafe_level??1}</span>}
   {mode==="crypto_hack"&&<span>🔐 My symbol: {["Sun","Moon","Star"][wallet?.defense_code??0]}</span>}
  </div>
  {ready?<div className="mode-reward-actions">
   {mode==="gold_quest"&&<>
    <div className="mode-reward-buttons">
     {button("🌟","Starlight pod","Discover a surprise","chest",0)}
     {button("🌙","Moon pod","What is inside?","chest",1)}
     {button("☀️","Sun pod","Make your choice","chest",2)}
    </div>
    {rivals.length>0&&<details className="zk-reward-extra"><summary>Want to challenge another player? (optional)</summary>
     <label>Choose a player<select value={target} onChange={e=>setTarget(e.target.value)}>
      <option value="">No challenge</option>{rivals.map(p=><option key={p.id} value={p.id}>{p.nickname}</option>)}</select></label>
    </details>}
   </>}
   {mode==="fishing_frenzy"&&<div className="mode-reward-buttons">
    {button("🐠","Coral Bay","Discover small surprises","fish",0)}
    {button("🐳","Deep Blue","Explore deeper waters","fish",1)}
   </div>}
   {mode==="cafe"&&<div className="mode-reward-buttons">
    {button("🧃","Fresh juice","Serve a cold drink","serve",0)}
    {button("🥪","Sandwich","Prepare a quick bite","serve",1)}
    {button("🧁","Cupcake","Treat your customer","serve",2)}
   </div>}
   {mode==="crypto_hack"&&<>
    <div className="mode-reward-buttons">{button("⛏️","Collect coins","A simple, safe reward","mine",0)}</div>
    {rivals.length>0&&<details className="zk-reward-extra"><summary>Try a code challenge (optional)</summary>
     <p>This uses pretend game symbols — never a real password.</p>
     <div className="mode-reward-controls">
      <label>Player<select value={target} onChange={e=>setTarget(e.target.value)}>
       <option value="">Choose player</option>{rivals.map(p=><option key={p.id} value={p.id}>{p.nickname}</option>)}</select></label>
      <label>Guess the symbol<select value={option} onChange={e=>setOption(Number(e.target.value))}>
       <option value={0}>☀️ Sun</option><option value={1}>🌙 Moon</option><option value={2}>⭐ Star</option></select></label>
     </div>
     <button className="zk-secondary-action" disabled={!target||loading} type="button" onClick={()=>void claim("hack",option)}>Try code challenge →</button>
    </details>}
   </>}
  </div>:<p className="mode-reward-wait">Next question is coming…</p>}
  {result&&<p className="mode-reward-success" role="status">{result}</p>}
  {error&&<p role="alert" className="form-error">{error}</p>}
 </section>;
}
