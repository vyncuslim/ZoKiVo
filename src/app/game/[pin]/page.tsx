"use client";
import {useRoomRealtime} from "@/lib/use-room-realtime";
import {useState,useEffect,useCallback,useRef} from "react";import {useParams,useSearchParams} from "next/navigation";
import {BrandMark} from "@/components/brand";
import QRCode from "qrcode";
import {buildReportCsv} from "@/lib/report-csv";
type State={serverTime?:string;scoreboardPhase?:"previous-round"|"settled";answeredCount?:number;status:"lobby"|"playing"|"finished";index:number;total:number;deadline:string|null;question:{question:string;choices:string[]}|null;players:{id:string;nickname:string;score:number}[];answeredIds:string[];viewer:{host:boolean;playerId:string|null}};
const letters=["A","B","C","D"];
export default function Game(){
 const {pin}=useParams<{pin:string}>();const host=useSearchParams().get("host")==="1";
 const requestSequence=useRef(0);const [clockOffset,setClockOffset]=useState(0);const [state,setState]=useState<State|null>(null);const[error,setError]=useState("");const[busy,setBusy]=useState(false);const[clock,setClock]=useState(Date.now());const[feedback,setFeedback]=useState(""),[joinQr,setJoinQr]=useState(""),[downloading,setDownloading]=useState(false);
 const headers=useCallback(()=>({[host?"x-host-token":"x-player-token"]:sessionStorage.getItem((host?"host:":"player:")+pin)||""}),[host,pin]);
 const reload=useCallback(async()=>{const request=++requestSequence.current;try{const r=await fetch("/api/rooms/"+pin,{headers:headers(),cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error||"Room not available");if(request!==requestSequence.current)return;if(j.serverTime)setClockOffset(new Date(j.serverTime).getTime()-Date.now());setState(j);setError("")}catch(e){if(request===requestSequence.current)setError(e instanceof Error?e.message:"Connection problem")}},[pin,headers]);
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
 useEffect(()=>{void reload();const a=setInterval(()=>void reload(),realtimeConnected?3000:1600);const b=setInterval(()=>setClock(Date.now()),250);return()=>{clearInterval(a);clearInterval(b)}},[reload,realtimeConnected]);
 useEffect(()=>{setFeedback("")},[state?.index]);
 async function act(path:string,choice?:number){setBusy(true);setError("");try{const r=await fetch("/api/rooms/"+pin+"/"+path,{method:"POST",headers:{...headers(),"Content-Type":"application/json"},body:JSON.stringify({choice})});const j=await r.json();if(!r.ok)throw Error(j.error||"Try again");if(path==="answer")setFeedback("ANSWER LOCKED IN — RESULTS AFTER THE ROUND");await reload()}catch(e){setError(e instanceof Error?e.message:"Request failed")}finally{setBusy(false)}}
 useEffect(()=>{const onVisible=()=>{if(document.visibilityState==="visible")void reload()};document.addEventListener("visibilitychange",onVisible);return()=>document.removeEventListener("visibilitychange",onVisible)},[reload]);
 const seconds=Math.max(0,Math.ceil((new Date(state?.deadline||0).getTime()-(clock+clockOffset))/1000));const answered=!!(state?.viewer.playerId&&state.answeredIds.includes(state.viewer.playerId));const canPlay=state?.status==="playing";
 return <main className="game-page wrap" data-role={host?"host":"player"}><div className="game-head"><div><span className="eyebrow eyebrow--mini">{host?"HOST VIEW":"PLAYER VIEW"}</span><h1>{state?.status==="lobby"?"Game lobby":state?.status==="finished"?"That's a wrap!":"Let's play!"}</h1></div><div className="game-pin-box"><span>GAME PIN</span><button type="button" title="Copy game PIN" onClick={()=>{void navigator.clipboard?.writeText(pin)}}>{pin} <span aria-hidden="true">⧉</span></button></div></div>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <div className="game-layout"><section className="game-main">
 {!state?<div className="waiting-card"><div className="waiting-mascot"><BrandMark size={150}/></div><h2>Connecting to the game...</h2><p>Checking your room.</p></div>:state.status==="lobby"?<div className="waiting-card"><div className="waiting-mascot"><BrandMark size={150}/></div><span className="waiting-eyebrow">EVERYONE GET READY</span><h2>It's almost game time!</h2><p>Share your PIN. Once everyone's here, the host can start.</p><div className="lobby-pin">{pin}</div>{host&&joinQr&&<div><img src={joinQr} alt="Scan to join this game" width={132} height={132}/><p><a href={"/play?pin="+pin}>Join link ↗</a></p></div>}{host?<button className="button button-dark" disabled={busy||state.players.length===0} onClick={()=>act("start")}>{busy?"Starting...":"Start game  ↗"}</button>:<span className="lobby-hint">WAITING FOR THE HOST TO START...</span>}</div>:state.status==="finished"?<div className="waiting-card finish-card"><div className="winner-star">★</div><span className="waiting-eyebrow">GAME COMPLETE</span><h2>Brains were braining.</h2><p>Great game, everyone. Check the final leaderboard!</p><a className="button button-dark" href="/play">Join another game →</a>{host&&<button className="button button-outline" type="button" disabled={downloading} onClick={()=>void downloadReport()}>{downloading?"Preparing report…":"Download results CSV ↓"}</button>}</div>:<div className="question-card"><div className="round-meta"><span>QUESTION {String(state.index+1).padStart(2,"0")} / {String(state.total).padStart(2,"0")}</span><span className={"timer-badge "+(seconds<=5?"timer-badge--low":"")}>{seconds}s LEFT</span></div><div className="round-progress" aria-label={"Question "+(state.index+1)+" of "+state.total}><span style={{width:Math.min(100,(state.index+1)/Math.max(1,state.total)*100)+"%"}}/></div><h2>{state.question?.question}</h2>{host&&<p className="game-host-instructions">Host preview · Players answer on their own devices</p>}<div className="answer-grid">{(state.question?.choices||[]).map((label,i)=><button key={i} className={"game-choice game-choice-"+i} disabled={host||answered||seconds===0||busy} onClick={()=>act("answer",i)}><span className="answer-letter">{letters[i]}</span><span>{label}</span><span className="answer-chevron">↗</span></button>)}</div>
 {feedback&&<p className="answer-feedback" role="status">{feedback}</p>}
 {answered&&!feedback&&<p className="answer-feedback" role="status">Answer sent! Watching the board...</p>}
 {host&&<div className="next-control"><p>You're hosting this round.</p><button className="button button-outline" type="button" disabled={busy} onClick={()=>{if(window.confirm("Finish this game now? All submitted scores will become final."))void act("finish")}}>Finish game early</button><button className="button button-dark" disabled={busy||seconds>0} onClick={()=>act("start")}>{seconds>0?"Waiting for timer...":"Next question →"}</button></div>}
 {!host&&!answered&&seconds===0&&<p className="answer-feedback">Time's up! Waiting for the next question.</p>}
 </div>}
 </section><aside className="leaderboard-card"><div className="board-title"><div><span>THE SCOREBOARD</span><h2>Top players</h2></div><div className="board-star">★</div></div><div className="board-players">{state?.players.length?state.players.map((p,i)=><div key={p.id} className={"board-player "+(i===0?"board-player-first":"")}><span className="player-position">{String(i+1).padStart(2,"0")}</span><span className={"player-avatar player-avatar-"+i%4}>{p.nickname.slice(0,1).toUpperCase()}</span><span className="player-name">{p.nickname}</span><strong>{p.score}</strong></div>):<div className="no-players"><span>↗</span><p>No players yet. Be the first to join!</p></div>}</div><div className="board-footer">{state?.scoreboardPhase==="previous-round"?"CURRENT ROUND POINTS APPEAR WHEN THE TIMER ENDS ✳":"PLAY NICE. THINK FAST. HAVE FUN. ✳"}{host&&state?.status==="playing"&&<span className="scoreboard-submissions"> · {state.answeredCount||0}/{state.players.length} ANSWERED</span>}</div></aside></div>
 </main>;
}
