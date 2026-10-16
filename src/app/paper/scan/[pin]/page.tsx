"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useCallback,useEffect,useRef,useState} from "react";
import jsQR from "jsqr";
type Q={question:string;choices:string[]};
type PaperState={pin:string;status:"lobby"|"playing"|"finished";index:number;total:number;question:Q|null;submittedCount:number;isHost:boolean;leaderboard?:{card_number:number;score:number;submitted:number}[]};
type Choice=0|1|2|3;
type Detected={card:number;choice:Choice};
const CHOICES=["A","B","C","D"];
function parseResult(raw:string,location:ReturnType<typeof jsQR>["location"]):Detected|null{
 const match=/^ZK1:(\d{3})$/.exec(raw);if(!match||!location)return null;
 const card=Number(match[1]);if(card<1||card>60)return null;
 const dx=location.topRightCorner.x-location.topLeftCorner.x;
 const dy=location.topRightCorner.y-location.topLeftCorner.y;
 if(Math.hypot(dx,dy)<18)return null;
 const quarter=((Math.round(Math.atan2(dy,dx)/(Math.PI/2))%4)+4)%4;
 const choice=([0,3,2,1] as Choice[])[quarter];
 return {card,choice};
}
export default function PaperScanner(){
 const{pin}=useParams<{pin:string}>();const [session,setSession]=useState<PaperState|null>(null);
 const[error,setError]=useState(""),[info,setInfo]=useState("");
 const[busy,setBusy]=useState(false),[cameraActive,setCameraActive]=useState(false);
 const[scans,setScans]=useState<Record<number,Choice>>({});
 const [manualCard,setManualCard]=useState(""),[manualChoice,setManualChoice]=useState<Choice>(0);
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),frame=useRef<number|null>(null),canvas=useRef<HTMLCanvasElement|null>(null);
 const running=useRef(false),lastRead=useRef(""),streak=useRef(0),lastFrame=useRef(0);
 const host=useCallback(()=>typeof window==="undefined"?"":sessionStorage.getItem("paper-host:"+pin)||"",[pin]);
 const headers=useCallback(()=>({"x-host-token":host()}),[host]);
 const fetchState=useCallback(async()=>{try{const r=await fetch("/api/paper/"+pin,{cache:"no-store",headers:headers()}),d=await r.json();if(!r.ok)throw Error(d.error||"Can't load session");setSession(d);setError("")}catch(e){setError(e instanceof Error?e.message:"Unable to load session")}},[pin,headers]);
 useEffect(()=>{void fetchState();const interval=setInterval(()=>void fetchState(),2500);return()=>clearInterval(interval)},[fetchState]);
 useEffect(()=>{setScans({});setInfo("")},[session?.index]);
 const stop=useCallback(()=>{running.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCameraActive(false)},[]);
 useEffect(()=>()=>{running.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);stream.current?.getTracks().forEach(t=>t.stop())},[]);
 async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){setError("This browser does not support the camera scanner.");return}
  try{
   setError("");const s=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}});
   stream.current=s;
   if(!video.current)throw Error("Camera view unavailable");
   video.current.srcObject=s;await video.current.play();setCameraActive(true);running.current=true;lastFrame.current=0;
   const buffer=document.createElement("canvas");canvas.current=buffer;
   const tick=(ts:number)=>{
    if(!running.current)return;
    frame.current=requestAnimationFrame(tick);
    if(ts-lastFrame.current<210||!video.current||video.current.readyState<2)return;
    lastFrame.current=ts;
    const v=video.current,width=640,height=Math.round(width*(v.videoHeight/Math.max(v.videoWidth,1)));
    if(height<30)return;
    buffer.width=width;buffer.height=height;
    const ctx=buffer.getContext("2d",{willReadFrequently:true});if(!ctx)return;
    ctx.drawImage(v,0,0,width,height);
    const pixels=ctx.getImageData(0,0,width,height);
    const qr=jsQR(pixels.data,width,height,{inversionAttempts:"dontInvert"});
    if(!qr){lastRead.current="";streak.current=0;return}
    const detected=parseResult(qr.data,qr.location);if(!detected)return;
    const key=detected.card+":"+detected.choice;
    if(lastRead.current===key)streak.current++;else{lastRead.current=key;streak.current=1}
    if(streak.current<2)return;
    setScans(prev=>prev[detected.card]===detected.choice?prev:{...prev,[detected.card]:detected.choice});
    setInfo("Recognized card "+String(detected.card).padStart(3,"0")+" → "+CHOICES[detected.choice]);
   };
   frame.current=requestAnimationFrame(tick);
  }catch(e){stop();setError("Camera unavailable: "+(e instanceof Error?e.message:"permission denied")+". You can enter cards manually.")}
 }
 async function action(path:string,body?:unknown){
  setBusy(true);setError("");try{
   const r=await fetch("/api/paper/"+pin+"/"+path,{method:"POST",headers:{"Content-Type":"application/json",...headers()},body:JSON.stringify(body||{})}),d=await r.json();
   if(!r.ok)throw Error(d.error||"Request failed");
   if(path==="submit"){setScans({});setInfo(d.saved+" new answers saved. "+(d.requested-d.saved)+" duplicates were ignored.");stop()}
   else{setScans({});setInfo(d.status==="finished"?"Quiz finished.":"Showing question "+(d.index+1));stop()}
   await fetchState();
  }catch(e){setError(e instanceof Error?e.message:"Request failed")}finally{setBusy(false)}
 }
 function addManual(){
  const n=Number(manualCard);
  if(!Number.isInteger(n)||n<1||n>60){setError("Enter a card number from 1 to 60.");return}
  setScans(prev=>({...prev,[n]:manualChoice}));setInfo("Manual answer set: card "+n+" → "+CHOICES[manualChoice]);setError("");setManualCard("");
 }
 const entries=Object.entries(scans).map(([card,choice])=>({card:Number(card),choice})).sort((a,b)=>a.card-b.card);
 return <main className="paper-root wrap paper-scanner-page"><nav className="paper-crumbs"><Link href="/paper">← Paper Mode</Link><span>/ Teacher scanner</span></nav>
 <div className="paper-scan-header"><div><span className="paper-eyebrow">TEACHER CONTROL · BETA</span><h1>Paper scanner</h1><p>Scan answers, double-check them, then submit the round.</p></div><div className="paper-session-pin"><span>GAME PIN</span><strong>{pin}</strong></div></div>
 {!session?.isHost?<div className="paper-alert" role="alert"><h2>Host access required</h2><p>This phone does not have this session&apos;s host authorization. For the prototype, create your Paper Mode session on the same phone you will use for scanning.</p><Link className="button button-dark" href="/paper">Start a new session</Link></div>:<>
 <div className="paper-scanner-columns"><section className="paper-control-card">
   <div className="paper-control-top"><span>LIVE SESSION</span><span className="paper-status">{session.status.toUpperCase()}</span></div>
   {session.status==="lobby"?<><h2>Get the cards ready!</h2><p>Print your Q-cards and hand one to each student. Open the board on a classroom screen:</p><Link href={"/paper/board/"+pin} target="_blank" rel="noopener noreferrer" className="paper-board-url">/paper/board/{pin} ↗</Link><button className="button button-dark button-full" disabled={busy} onClick={()=>void action("advance")}>Show first question ↗</button></>:session.status==="finished"?<><h2>All done! ★</h2><p>Your classroom quiz is complete. Below are the recorded card scores.</p><Link href="/paper" className="button button-dark">New Paper session</Link></>:<><span className="paper-round-label">QUESTION {session.index+1} / {session.total}</span><h2>{session.question?.question}</h2><div className="paper-answer-list">{session.question?.choices.map((c,i)=><p key={i}><b>{CHOICES[i]}</b>{c}</p>)}</div><div className="paper-control-stats"><span><strong>{session.submittedCount}</strong> already recorded</span><span><strong>{entries.length}</strong> pending review</span></div><div className="paper-control-actions"><button className="button button-dark" disabled={busy||entries.length===0} onClick={()=>void action("submit",{index:session.index,responses:entries})}>Submit {entries.length} answers ↗</button><button className="button button-outline" disabled={busy} onClick={()=>void action("advance")}>Next question →</button></div></>}
 </section>
 <aside className="paper-scan-panel"><div className="paper-cam-head"><h2>Camera scanner</h2><span>{cameraActive?"● SCANNING":"○ CAMERA OFF"}</span></div>
  <div className="paper-camera-frame"><video ref={video} muted playsInline aria-label="Live camera view for scanning Q-cards"/>{!cameraActive&&<div className="paper-camera-placeholder"><span>⌗</span><p>Camera preview appears here</p></div>}</div>
  <div className="paper-cam-actions"><button type="button" className="button button-dark" disabled={cameraActive||session.status!=="playing"} onClick={()=>void startCamera()}>Start camera</button><button type="button" className="button button-outline" disabled={!cameraActive} onClick={stop}>Stop</button></div>
  <p className="paper-scan-tip">Point the camera at one card at a time, with the QR square facing you. The selected letter must face upward. Use HTTPS and allow camera access.</p>
 </aside></div>
 <div className="paper-review-grid"><section className="paper-review-card"><div className="paper-review-heading"><h2>Review scanned answers</h2><span>{entries.length} / 60 cards</span></div>
 {entries.length===0?<p className="paper-muted">No cards scanned yet. Hold cards steady in good light, or add a card manually.</p>:<div className="paper-scanned-list">{entries.map(e=><div className="paper-scanned-card" key={e.card}><b>#{String(e.card).padStart(3,"0")}</b><select aria-label={"Answer for card "+e.card} value={e.choice} onChange={ev=>setScans(prev=>({...prev,[e.card]:Number(ev.target.value) as Choice}))}>{CHOICES.map((c,i)=><option value={i} key={c}>{c}</option>)}</select><button type="button" aria-label={"Remove card "+e.card} onClick={()=>setScans(prev=>{const x={...prev};delete x[e.card];return x})}>×</button></div>)}</div>}
 <div className="paper-manual-form"><label>Card number <input type="number" min={1} max={60} placeholder="001" value={manualCard} onChange={e=>setManualCard(e.target.value)}/></label><label>Answer <select value={manualChoice} onChange={e=>setManualChoice(Number(e.target.value) as Choice)}>{CHOICES.map((x,i)=><option value={i} key={x}>{x}</option>)}</select></label><button type="button" onClick={addManual}>Add / correct</button></div>
 {info&&<p className="paper-info-line" role="status">{info}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
 </section><aside className="paper-review-card"><h2>Scores</h2><p className="paper-muted">Results update after answers are submitted. Only numbered cards are recorded — no student names.</p><div className="paper-ranking">{session.leaderboard?.length?session.leaderboard.slice(0,60).map((r,i)=><div key={r.card_number}><span>{i+1}.</span><b>Card {String(r.card_number).padStart(3,"0")}</b><strong>{r.score} pts</strong></div>):<p className="paper-muted">Waiting for the first responses.</p>}</div></aside></div>
 <p className="paper-beta-note">Scanner limit: one decoded QR per camera frame, accumulated as you pan across the room. Verify each answer before submitting. Each card is scored at most once per question; duplicate submissions are ignored.</p>
 </>}
 </main>;
}
