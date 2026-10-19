"use client";
import {useRoomRealtime} from "@/lib/use-room-realtime";
import {useState,useEffect,useCallback,useRef} from "react";import {useParams,useSearchParams} from "next/navigation";
import {BrandMark} from "@/components/brand";
import QRCode from "qrcode";
import {buildReportCsv} from "@/lib/report-csv";
import {avatarSymbol} from "@/lib/avatars";
import {ModeRewards} from "@/components/mode-rewards";
import {gameModeName} from "@/lib/game-modes";
import {QuestionMedia} from "@/components/question-media";
import {FinishedResults} from "@/components/finished-results";
type State={muteSounds?:boolean;scoreGoal?:number|null;gameMode?:string;serverTime?:string;scoreboardPhase?:"previous-round"|"settled";allAnswered?:boolean;roundReady?:boolean;rewardsPending?:boolean;answeredCount?:number;status:"lobby"|"playing"|"finished";index:number;total:number;deadline:string|null;question:{question:string;choices:string[];image_url?:string;audio_url?:string;formula_text?:string}|null;players:{id:string;nickname:string;score:number;avatar_id:string;mode_score?:number}[];answeredIds:string[];hostResults?:{correctIndex:number;questionText?:string;correctAnswer?:string;correctCount:number;wrongCount:number;pendingCount:number;choiceCounts:number[];playerResults:{id:string;correct:boolean}[]}|null;viewer:{host:boolean;playerId:string|null;result?:{is_correct:boolean;points:number}|null;mode?:{reward_ready:boolean;credits:number;fish:number;served:number;cafe_level:number;defense_code:number}}};
const letters=["A","B","C","D"];
export default function Game(){
 const {pin}=useParams<{pin:string}>();const host=useSearchParams().get("host")==="1";
 const requestSequence=useRef(0);const inFlight=useRef<Promise<void>|null>(null);const [clockOffset,setClockOffset]=useState(0);const [state,setState]=useState<State|null>(null);
 const [lastReview,setLastReview]=useState<{index:number;question:string;choices:string[];results:NonNullable<State["hostResults"]>}|null>(null);const[error,setError]=useState("");const[busy,setBusy]=useState(false);const[clock,setClock]=useState(Date.now());const[feedback,setFeedback]=useState(""),[bonusReceipt,setBonusReceipt]=useState(""),[joinQr,setJoinQr]=useState(""),[downloading,setDownloading]=useState(false);
 const headers=useCallback(()=>({[host?"x-host-token":"x-player-token"]:sessionStorage.getItem((host?"host:":"player:")+pin)||""}),[host,pin]);
 const reload=useCallback(async(force=false)=>{
  if(!force&&inFlight.current)return inFlight.current;
  const request=++requestSequence.current;
  const task=(async()=>{
   try{
    const r=await fetch("/api/rooms/"+pin,{headers:headers(),cache:"no-store"});
    const j=await r.json();if(!r.ok)throw Error(j.error||"Room not available");
    if(request!==requestSequence.current)return;
    if(j.serverTime)setClockOffset(new Date(j.serverTime).getTime()-Date.now());
    setState(j);setError("");
   }catch(e){if(request===requestSequence.current)setError(e instanceof Error?e.message:"Connection problem")}
  })();
  inFlight.current=task;
  try{await task}finally{if(inFlight.current===task)inFlight.current=null}
 },[pin,headers]);
 useEffect(()=>{
   if(!host||!/^\d{6}$/.test(pin))return;
   let active=true;
   void QRCode.toDataURL("https://zokivo.vynalthai.com/play?pin="+pin,{margin:2,width:240})
     .then(uri=>{if(active)setJoinQr(uri)}).catch(()=>{});
   return()=>{active=false};
 },[host,pin]);
 async function downloadReport(){
   if(downloading)return;
   setDownloading(true);setError("");
   try{
    const r=await fetch("/api/rooms/"+pin+"/report",{headers:headers(),cache:"no-store"});
    const result=await r.json();if(!r.ok)throw Error(result.error||"Report not available");
    const csv=buildReportCsv(result);
    const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="zokivo-results-"+pin+".csv";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
   }catch(e){setError(e instanceof Error?e.message:"Failed to download report")}
   finally{setDownloading(false)}
 }
 const realtimeConnected=useRoomRealtime("quiz",pin,headers,reload);
 useEffect(()=>{if(state?.status==="finished")return;void reload();const a=setInterval(()=>void reload(),host?(realtimeConnected?1800:1700):(realtimeConnected?5000:3000));const b=setInterval(()=>setClock(Date.now()),250);return()=>{clearInterval(a);clearInterval(b)}},[reload,realtimeConnected,host,state?.status]);
 useEffect(()=>{setFeedback("");setBonusReceipt("")},[state?.index]);
 useEffect(()=>{
  if(host&&state?.hostResults&&state.question){
   setLastReview({index:state.index,question:state.question.question,choices:state.question.choices,results:state.hostResults});
  }
 },[host,state?.hostResults,state?.index,state?.question]);
 function beep(){
  if(state?.muteSounds)return;
  try{
   const AudioEngine=window.AudioContext;
   if(!AudioEngine)return;
   const ctx=new AudioEngine(),osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type="sine";osc.frequency.value=650;gain.gain.setValueAtTime(.06,ctx.currentTime);
   gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);
   osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.12);
   osc.onended=()=>{void ctx.close()};
  }catch{/* Device or browser may not support audio */}
 }
 async function act(path:string,choice?:number){setBusy(true);setError("");try{const r=await fetch("/api/rooms/"+pin+"/"+path,{method:"POST",headers:{...headers(),"Content-Type":"application/json"},body:JSON.stringify({choice})});const j=await r.json();if(!r.ok)throw Error(j.error||"Try again");if(path==="answer"){beep();setFeedback("ANSWER LOCKED IN — RESULTS AFTER THE ROUND")}await reload(true)}catch(e){setError(e instanceof Error?e.message:"Request failed")}finally{setBusy(false)}}
 useEffect(()=>{const onVisible=()=>{if(document.visibilityState==="visible")void reload()};document.addEventListener("visibilitychange",onVisible);return()=>document.removeEventListener("visibilitychange",onVisible)},[reload]);
 useEffect(()=>{
  if(!host||!state?.roundReady||state.status!=="playing")return;
  // The classroom host automates the transition, while the API rechecks
  // submissions, late joins and unclaimed game rewards atomically.
  const timer=window.setTimeout(async()=>{
   try{
    const r=await fetch("/api/rooms/"+pin+"/start",{method:"POST",headers:{...headers(),"Content-Type":"application/json"},body:"{}"});
    if(!r.ok){const j=await r.json();if(r.status!==409)setError(j.error||"Unable to move to the next question.");return}
    await reload(true);
   }catch{setError("Connection interrupted. Use Next question to continue.")}
  },250); // Advance promptly; keep the last host-only review visible across rounds.
  return()=>window.clearTimeout(timer);
 },[host,state?.roundReady,state?.index,state?.deadline,state?.status,headers,pin,reload]);
 const seconds=Math.max(0,Math.ceil((new Date(state?.deadline||0).getTime()-(clock+clockOffset))/1000));const answered=!!(state?.viewer.playerId&&state.answeredIds.includes(state.viewer.playerId));const canPlay=state?.status==="playing";const roundResults=host?state?.hostResults:null;
 const priorReview=host&&!roundResults&&state?.status==="playing"&&lastReview?.index===state.index-1?lastReview:null;
 const displayResults=roundResults||priorReview?.results;
 const gradeByPlayer=new Map(displayResults?.playerResults.map(result=>[result.id,result.correct] as const)||[]);
 if(state?.status==="finished")return <main className="game-page zk-game-screen wrap" data-role={host?"host":"player"}>
  {error&&<p role="alert" className="form-error">{error}</p>}
  <FinishedResults pin={pin} host={host} state={state} getHeaders={headers} onDownload={()=>void downloadReport()} downloading={downloading}/>
 </main>;
 return <main className="game-page zk-game-screen wrap" data-role={host?"host":"player"}><div className="game-head"><div><span className="eyebrow eyebrow--mini">{host?"TEACHER SCREEN":"YOUR GAME"}</span><h1>{state?.status==="lobby"?"Ready, players?":String(state?.status)==="finished"?"Game finished!":"Play & learn!"}</h1></div><div className="game-pin-box"><span>GAME PIN · COPY</span><button type="button" title="Copy game PIN" onClick={()=>{void navigator.clipboard?.writeText(pin)}}>{pin} <span aria-hidden="true">⧉</span></button></div></div>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <div className="game-layout zk-play-layout"><section className="game-main">
 {!state?<div className="waiting-card"><div className="waiting-mascot"><BrandMark size={150}/></div><h2>Connecting to the game...</h2><p>Checking your room.</p></div>:state.status==="lobby"?<div className="waiting-card"><div className="waiting-mascot"><BrandMark size={150}/></div><span className="waiting-eyebrow">EVERYONE GET READY</span><h2>It's almost game time!</h2><p>{host?"Share the PIN or QR code. Start once everyone joins.":"You’re in! Pick your character and wait for your teacher."}</p><div className="lobby-pin">{pin}</div>{host&&joinQr&&<div><img src={joinQr} alt="Scan to join this game" width={132} height={132}/><p><a href={"/play?pin="+pin}>Join link ↗</a></p></div>}<div className="zokivo-lobby-players" aria-label="Players ready"><strong>PLAYERS READY · {state.players.length}</strong><div>{state.players.map(p=><span className="zokivo-lobby-player" key={p.id}><i aria-hidden="true">{avatarSymbol(p.avatar_id)}</i>{p.nickname}</span>)}</div></div>{host?<button className="button button-dark" disabled={busy||state.players.length===0} onClick={()=>act("start")}>{busy?"Starting...":"Start game  ↗"}</button>:<span className="lobby-hint">WAITING FOR THE HOST TO START...</span>}</div>:String(state.status)==="finished"?<div className="waiting-card finish-card"><div className="winner-star">★</div><span className="waiting-eyebrow">GAME COMPLETE</span><h2>🏆 Final standings</h2><p>Thanks for playing! Here are your top ZoKivo players.</p>
 {host&&state.hostResults&&<div className="zk-host-answer-summary" role="status">
  <strong>FINAL ROUND REVIEW</strong>
  <span className="zk-host-summary-correct">✓ {state.hostResults.correctCount} Correct</span>
  <span className="zk-host-summary-wrong">✕ {state.hostResults.wrongCount} Wrong</span>
  <span>◷ {state.hostResults.pendingCount} No answer</span>
  <small className="zk-host-previous-key">{state.hostResults.questionText} · Correct answer: {state.hostResults.correctAnswer||"Unavailable"}</small>
 </div>}
 <div className="zk-final-podium" aria-label="Final top players">
 {state.players.slice().sort((a,b)=>state.gameMode&&state.gameMode!=="quiz_party"?(b.mode_score??0)-(a.mode_score??0):b.score-a.score).slice(0,3).map((p,i)=>
  <div className={"zk-podium-player zk-podium-"+(i+1)} key={p.id}><span className="zk-podium-place">{["🥇","🥈","🥉"][i]}</span>
   <span className="zk-podium-avatar" aria-hidden="true">{avatarSymbol(p.avatar_id)}</span><strong>{p.nickname}</strong>
   <span>{state.gameMode&&state.gameMode!=="quiz_party"?(p.mode_score??0)+" ✦":p.score+" points"}</span></div>)}
 </div><a className="button button-dark" href="/play">Join another game →</a>{host&&<button className="button button-outline" type="button" disabled={downloading} onClick={()=>void downloadReport()}>{downloading?"Preparing report…":"Download results CSV ↓"}</button>}</div>:<div className="question-card zk-question-stage"><div className="round-meta"><span>QUESTION {String(state.index+1).padStart(2,"0")} / {String(state.total).padStart(2,"0")}</span><span className={"timer-badge "+(seconds<=5?"timer-badge--low":"")}>{state.allAnswered?"✓ ALL ANSWERED":seconds+"s TO ANSWER"}</span></div><div className="round-progress" aria-label={"Question "+(state.index+1)+" of "+state.total}><span style={{width:Math.min(100,(state.index+1)/Math.max(1,state.total)*100)+"%"}}/></div>
 {host&&displayResults&&<div className="zk-host-answer-summary" role="status" aria-label="Host round results">
  <strong>{priorReview?"PREVIOUS ROUND":"ANSWER REVIEW"} · ROUND {priorReview?priorReview.index+1:state.index+1}</strong>
  <span className="zk-host-summary-correct">✓ {displayResults.correctCount} Correct</span>
  <span className="zk-host-summary-wrong">✕ {displayResults.wrongCount} Wrong</span>
  <span>◷ {displayResults.pendingCount} No answer</span>
  {priorReview&&<small className="zk-host-previous-key">Previous: {priorReview.question} · Correct answer: {priorReview.choices[priorReview.results.correctIndex]||"Unavailable"}</small>}
 </div>}{!host&&answered?state.viewer.mode?.reward_ready&&state.gameMode!=="quiz_party"?
 <div className="zk-bonus-stage"><div className="zk-bonus-intro"><span className="zk-reward-spark" aria-hidden="true">✦</span>
  <h2>Bonus unlocked!</h2><p>You answered. Now choose your next game move.</p></div>
  <ModeRewards mode={state.gameMode||"quiz_party"} pin={pin} token={headers()["x-player-token"]||""}
   playerId={state.viewer.playerId} players={state.players} wallet={state.viewer.mode} onClaim={async receipt=>{setBonusReceipt(receipt||"");await reload()}}/>
 </div>:
 <div className="zk-answer-done" role="status"><span className="zk-status-icon" aria-hidden="true">✓</span>
  <h2>{bonusReceipt?"Bonus collected! 🎉":state.viewer.result?.is_correct?"Correct! ✨":state.viewer.result?"Good try! 💜":"Answer sent!"}</h2><p>{bonusReceipt?"You earned: "+bonusReceipt:state.viewer.result?.is_correct?"Great thinking! You earned "+state.viewer.result.points+" points.":state.viewer.result?"You can try the next one. Keep learning!":"Your answer is locked in. Waiting for the others."}</p>
  <p className="zk-wait-counter">{state.allAnswered?(state.rewardsPending?"Waiting for bonus choices…":"Everyone answered! Next question starting…"):seconds>0?"Waiting for classmates · "+state.answeredCount+"/"+state.players.length+" answered · "+seconds+"s max":"Time is up. Next question starting…"}</p>
 </div>
 :<div className="zk-quiz-play"><h2>{state.question?.question}</h2>
  <QuestionMedia imageUrl={state.question?.image_url} audioUrl={state.question?.audio_url} formula={state.question?.formula_text}/>
  {host&&<p className="game-host-instructions">Host view · Students answer on their devices · {gameModeName(state.gameMode)}{state.scoreGoal?" · Goal "+state.scoreGoal+" points":""}</p>}
  <div className="answer-grid zk-answer-pads" aria-label="Choose one answer">
   {(state.question?.choices||[]).map((label,i)=><button key={i} type="button"
    className={"game-choice game-choice-"+i+" zk-answer-pad"+(roundResults?(i===roundResults.correctIndex?" zk-host-choice-correct":" zk-host-choice-wrong"):"")} aria-label={"Answer "+letters[i]+": "+label}
    disabled={host||answered||seconds===0||busy} onClick={()=>act("answer",i)}>
    <span className="answer-letter" aria-hidden="true">{["✦","●","◆","▲"][i]}</span>
    <span className="zk-answer-label">{label}</span>
     {roundResults&&<span className="zk-host-choice-result">{i===roundResults.correctIndex?"✓ CORRECT":"✕ WRONG"} · {roundResults.choiceCounts[i]??0} chose this</span>}</button>)}
  </div>
  {host&&<p className="zk-small-hint">{roundResults?"Round closed · correct answers and response counts are now visible to the host.":"Students see these four choices on their own screens. Answers are revealed once the round closes."}</p>}
  {feedback&&<p className="answer-feedback" role="status">{feedback}</p>}
  {!host&&!answered&&seconds===0&&<p className="answer-feedback">Time's up! Waiting for the next question.</p>}
 </div>}
 {host&&<div className="next-control"><p>You're hosting this round.</p><button className="button button-outline" type="button" disabled={busy} onClick={()=>{if(window.confirm("Finish this game now? All submitted scores will become final."))void act("finish")}}>Finish game early</button><button className="button button-dark" disabled={busy||!state.roundReady} onClick={()=>act("start")}>{state.roundReady?"Next question →":state.rewardsPending?"Waiting for bonuses…":"Waiting for answers…"}</button></div>}
 {!host&&!answered&&seconds===0&&<p className="answer-feedback">Time's up! Waiting for the next question.</p>}
 </div>}
 </section><aside className="leaderboard-card zk-compact-board"><div className="board-title"><div><span>LIVE SCORES</span><h2>{state?.gameMode&&state.gameMode!=="quiz_party"?"Top collectors":"Top players"}</h2></div><div className="board-star">★</div></div><div className="board-players">{state?.players.length?state.players.map((p,i)=><div key={p.id} className={"board-player "+(i===0?"board-player-first":"")}><span className="player-position">{String(i+1).padStart(2,"0")}</span><span className={"player-avatar player-avatar-"+i%4}>{avatarSymbol(p.avatar_id)}</span><span className="player-name">{p.nickname}</span>
 {host&&displayResults&&<span className={"zk-player-grade "+(gradeByPlayer.has(p.id)?gradeByPlayer.get(p.id)?"zk-player-grade-correct":"zk-player-grade-wrong":"zk-player-grade-missing")}>{gradeByPlayer.has(p.id)?gradeByPlayer.get(p.id)?"Correct":"Wrong":"No answer"}</span>}
 <strong>{state?.gameMode&&state.gameMode!=="quiz_party"?(p.mode_score??0)+" ✦":p.score}</strong></div>):<div className="no-players"><span>↗</span><p>No players yet. Be the first to join!</p></div>}</div><div className="board-footer">{state?.scoreboardPhase==="previous-round"?"CURRENT ROUND SCORES ARE SHOWN AFTER EVERYONE FINISHES ✳":"PLAY NICE. THINK FAST. HAVE FUN. ✳"}{host&&state?.status==="playing"&&<span className="scoreboard-submissions"> · {state.answeredCount||0}/{state.players.length} ANSWERED</span>}</div></aside></div>
 </main>;
}
