"use client";
import {useRoomRealtime} from "@/lib/use-room-realtime";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useCallback,useEffect,useRef,useState} from "react";
import {createNativeQrDetector,scanCardFrame,type CardDetection,type Choice,type MultiQrDetector} from "@/lib/paper-detection";
import {detectWaygroundFrame} from "@/lib/wayground-cards";
type Q={question:string;choices:string[]};
type PaperState={pin:string;status:"lobby"|"playing"|"finished";index:number;total:number;question:Q|null;submittedCount:number;isHost:boolean;leaderboard?:{card_source:CardSource;card_number:number;score:number;submitted:number}[]};
const CHOICES=["A","B","C","D"];
type CardSource="zokivo"|"wayground";
type ScanMode="mixed"|CardSource;
type MarkedCard=CardDetection & {card_source:CardSource};
const cardKey=(d:{card_source:CardSource;card:number})=>d.card_source+":"+d.card;
const cardTitle=(d:{card_source:CardSource;card:number})=>(d.card_source==="wayground"?"Wayground":"ZoKivo")+" #"+String(d.card).padStart(3,"0");
export default function PaperScanner(){
 const{pin}=useParams<{pin:string}>();const [session,setSession]=useState<PaperState|null>(null);
 const[error,setError]=useState(""),[info,setInfo]=useState("");
 const[busy,setBusy]=useState(false),[cameraActive,setCameraActive]=useState(false),[cameraRequesting,setCameraRequesting]=useState(false);
 const[scans,setScans]=useState<Record<string,Choice>>({});
 const [manualCard,setManualCard]=useState(""),[manualChoice,setManualChoice]=useState<Choice>(0),[manualSource,setManualSource]=useState<CardSource>("zokivo");
 const video=useRef<HTMLVideoElement>(null),overlay=useRef<HTMLCanvasElement>(null);
 const stream=useRef<MediaStream|null>(null),frame=useRef<number|null>(null),canvas=useRef<HTMLCanvasElement|null>(null);
 const running=useRef(false),processing=useRef(false),lastFrame=useRef(0),frameNumber=useRef(0),cameraPending=useRef(false),cameraGeneration=useRef(0);
 const tracks=useRef(new Map<string,{choice:Choice;count:number;last:number}>());
 const detectorRef=useRef<MultiQrDetector|null>(null);
 const [visibleCards,setVisibleCards]=useState(0),[scannerEngine,setScannerEngine]=useState("Preparing scanner");
 const [unstable,setUnstable]=useState(0);
 const [cardFormat,setCardFormat]=useState<ScanMode>("mixed");
 const cardFormatRef=useRef<ScanMode>("mixed");
 const host=useCallback(()=>typeof window==="undefined"?"":sessionStorage.getItem("paper-host:"+pin)||"",[pin]);
 const headers=useCallback(()=>({"x-host-token":host()}),[host]);
 const fetchState=useCallback(async()=>{try{const r=await fetch("/api/paper/"+pin,{cache:"no-store",headers:headers()}),d=await r.json();if(!r.ok)throw Error(d.error||"Can't load session");setSession(d);setError("")}catch(e){setError(e instanceof Error?e.message:"Unable to load session")}},[pin,headers]);
 const realtimeConnected=useRoomRealtime("paper",pin,headers,fetchState);
 useEffect(()=>{void fetchState();const interval=setInterval(()=>void fetchState(),realtimeConnected?12000:2500);return()=>clearInterval(interval)},[fetchState,realtimeConnected]);
 useEffect(()=>{setScans({});setInfo("");tracks.current.clear();frameNumber.current=0},[session?.index]);
 const stop=useCallback(()=>{cameraGeneration.current++;cameraPending.current=false;setCameraRequesting(false);running.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCameraActive(false);setVisibleCards(0);const o=overlay.current;if(o){o.getContext("2d")?.clearRect(0,0,o.width,o.height)}},[]);
 useEffect(()=>()=>{cameraGeneration.current++;running.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);stream.current?.getTracks().forEach(t=>t.stop())},[]);
 useEffect(()=>{if(session?.status==="finished"&&stream.current)stop()},[session?.status,stop]);
 async function startCamera(){
  if(cameraPending.current||cameraActive)return;
  if(!window.isSecureContext){setError("Camera requires a secure HTTPS page. Open https://zokivo.vynalthai.com/paper/scan/"+pin);return}
  if(!navigator.mediaDevices?.getUserMedia){setError("Camera API is unavailable. Open this page directly in Chrome, Safari or Edge, not inside an embedded browser.");return}
  cameraPending.current=true;setCameraRequesting(true);setError("");
  const generation=++cameraGeneration.current;
  let opened:MediaStream|null=null;
  try{
   // Invoked only from the teacher's explicit user click; this triggers the browser permission prompt.
   opened=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}});
   if(generation!==cameraGeneration.current){opened.getTracks().forEach(t=>t.stop());return}
   stream.current=opened;
   const preview=video.current;
   if(!preview)throw Error("Camera preview is not mounted. Reload the page.");
   preview.srcObject=opened;
   await preview.play();
   if(generation!==cameraGeneration.current){opened.getTracks().forEach(t=>t.stop());return}
   detectorRef.current=await createNativeQrDetector();
   setScannerEngine(detectorRef.current?"Multi-QR native + orientation verification":"Portable multi-QR fallback");
   setCameraActive(true);running.current=true;lastFrame.current=0;frameNumber.current=0;tracks.current.clear();
   const buffer=document.createElement("canvas");canvas.current=buffer;
   const drawOverlay=(detections:MarkedCard[],width:number,height:number)=>{
     const o=overlay.current;if(!o)return;
     o.width=width;o.height=height;
     const c=o.getContext("2d");if(!c)return;
     for(const detected of detections){
       c.beginPath();
       detected.corners.forEach((p,i)=>i===0?c.moveTo(p.x,p.y):c.lineTo(p.x,p.y));
       c.closePath();
       c.strokeStyle="#8fffd5";c.lineWidth=5;c.stroke();
       const label=(detected.card_source==="wayground"?"WG":"ZK")+" "+String(detected.card).padStart(3,"0")+" · "+CHOICES[detected.choice];
       const x=Math.max(5,Math.min(detected.corners[0].x,width-160));
       const y=Math.max(30,detected.corners[0].y-8);
       c.font="bold 19px Arial";const tw=Math.ceil(c.measureText(label).width);
       c.fillStyle="#12162d";c.fillRect(x-4,y-26,tw+13,29);
       c.fillStyle="#fff";c.fillText(label,x,y-6);
     }
   };
   const tick=(ts:number)=>{
     if(!running.current)return;
     frame.current=requestAnimationFrame(tick);
     if(processing.current||ts-lastFrame.current<250||!video.current||video.current.readyState<2)return;
     processing.current=true;lastFrame.current=ts;
     const v=video.current;
     const width=Math.min(1050,v.videoWidth),height=Math.round(width*(v.videoHeight/Math.max(1,v.videoWidth)));
     if(height<40){processing.current=false;return}
     buffer.width=width;buffer.height=height;
     const ctx=buffer.getContext("2d",{willReadFrequently:true});
     if(!ctx){processing.current=false;return}
     ctx.drawImage(v,0,0,width,height);
     const mode=cardFormatRef.current;
     const qrPromise=mode==="wayground"?Promise.resolve(null):scanCardFrame(buffer,detectorRef.current,16);
     const wgPromise=mode==="zokivo"?Promise.resolve([] as CardDetection[]):Promise.resolve().then(()=>detectWaygroundFrame(ctx.getImageData(0,0,width,height),16));
     void Promise.all([qrPromise,wgPromise]).then(([qr,wayground])=>{
       if(!running.current)return;
       const current=++frameNumber.current;
       const detections:MarkedCard[]=[
         ...(qr?.detections||[]).map(d=>({...d,card_source:"zokivo" as const})),
         ...wayground.map(d=>({...d,card_source:"wayground" as const}))
       ];
       const combined=mode==="mixed"?"Mixed card detection":mode==="wayground"?"Wayground 6×6 pattern scanner":qr?.engine==="native-multi"?"Native multi-QR":"Multi-QR frame analysis";
       setScannerEngine(combined);
       setVisibleCards(detections.length);
       setUnstable(qr?.unsupported||0);
       drawOverlay(detections,width,height);
       const verified:MarkedCard[]=[];
       for(const d of detections){
         const key=cardKey(d),old=tracks.current.get(key);
         const count=old&&old.choice===d.choice&&old.last===current-1?old.count+1:1;
         tracks.current.set(key,{choice:d.choice,count,last:current});
         if(count===2)verified.push(d);
       }
       if(verified.length){
         setScans(prev=>{
           const next={...prev};let changed=false;
           for(const found of verified){
             const key=cardKey(found);
             if(next[key]===undefined){next[key]=found.choice;changed=true}
           }
           return changed?next:prev;
         });
         setInfo(verified.map(d=>cardTitle(d)+" → "+CHOICES[d.choice]).join(" · ")+" — review before submitting.");
       }
     }).catch(e=>{if(running.current)setError("Scanner issue: "+(e instanceof Error?e.message:"failed to analyze frame"))})
       .finally(()=>{processing.current=false});
   };
   frame.current=requestAnimationFrame(tick);
  }catch(e){
   const reason=e instanceof DOMException?e.name:"";
   const guidance=reason==="NotAllowedError"||reason==="PermissionDeniedError"?
    "Camera permission was denied. Open your browser site permissions, allow Camera for ZoKivo, then retry.":
    reason==="NotFoundError"?"No usable camera was found on this device.":
    reason==="NotReadableError"?"The camera is busy in another app. Close other camera apps and retry.":
    "Camera could not start. "+(e instanceof Error?e.message:"Please try another browser.");
   stop();setError(guidance+" Manual entry is available.");
  }finally{if(generation===cameraGeneration.current){cameraPending.current=false;setCameraRequesting(false)}}
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
  setScans(prev=>({...prev,[cardKey({card_source:manualSource,card:n})]:manualChoice}));setInfo("Manual answer set: "+cardTitle({card_source:manualSource,card:n})+" → "+CHOICES[manualChoice]);setError("");setManualCard("");
 }
 const entries=Object.entries(scans).map(([key,choice])=>{const [card_source,card]=key.split(":");return {card_source:card_source as CardSource,card:Number(card),choice}}).sort((a,b)=>a.card_source.localeCompare(b.card_source)||a.card-b.card);
 return <main className="paper-root wrap paper-scanner-page"><nav className="paper-crumbs"><Link href="/paper">← Paper Mode</Link><span>/ Teacher scanner</span></nav>
 <div className="paper-scan-header"><div><span className="paper-eyebrow">TEACHER CONTROL · BETA</span><h1>Paper scanner</h1><p>Scan answers, double-check them, then submit the round.</p></div><div className="paper-session-pin"><span>GAME PIN</span><strong>{pin}</strong></div></div>
 {!session?.isHost?<div className="paper-alert" role="alert"><h2>Host access required</h2><p>This phone does not have this session&apos;s host authorization. Sign in with the original Vynalth AI account that created this room. Camera and submit controls are protected; sharing the six-digit PIN alone does not grant host access.</p><Link className="button button-dark" href={"/auth/login?next="+encodeURIComponent("/paper/scan/"+pin)}>Sign in as host →</Link> <Link className="button button-outline" href="/paper">Paper Mode home</Link></div>:<>
 <div className="paper-scanner-columns"><section className="paper-control-card">
   <div className="paper-control-top"><span>LIVE SESSION</span><span className="paper-status">{session.status.toUpperCase()}</span></div>
   {session.status==="lobby"?<><h2>Get the cards ready!</h2><p>Print your Q-cards and hand one to each student. Open the board on a classroom screen:</p><Link href={"/paper/board/"+pin} target="_blank" rel="noopener noreferrer" className="paper-board-url">/paper/board/{pin} ↗</Link><button className="button button-dark button-full" disabled={busy} onClick={()=>void action("advance")}>Show first question ↗</button></>:session.status==="finished"?<><h2>All done! ★</h2><p>Your classroom quiz is complete. Below are the recorded card scores.</p><Link href="/paper" className="button button-dark">New Paper session</Link></>:<><span className="paper-round-label">QUESTION {session.index+1} / {session.total}</span><h2>{session.question?.question}</h2><div className="paper-answer-list">{session.question?.choices.map((c,i)=><p key={i}><b>{CHOICES[i]}</b>{c}</p>)}</div><div className="paper-control-stats"><span><strong>{session.submittedCount}</strong> already recorded</span><span><strong>{entries.length}</strong> pending review</span></div><div className="paper-control-actions"><button className="button button-dark" disabled={busy||entries.length===0} onClick={()=>void action("submit",{index:session.index,responses:entries})}>Submit {entries.length} answers ↗</button><button className="button button-outline" disabled={busy} onClick={()=>void action("advance")}>Next question →</button></div></>}
 </section>
 <aside className="paper-scan-panel"><div className="paper-cam-head"><h2>Multi-card scanner</h2><span>{cameraActive?"● SCANNING":cameraRequesting?"◌ PERMISSION REQUEST":"○ CAMERA OFF"}</span></div>
  <div className="paper-format-switch">
  <label htmlFor="paper-card-format">Scan card types</label>
  <select id="paper-card-format" value={cardFormat} disabled={cameraActive} onChange={e=>{
    const x=e.target.value as ScanMode;
    setCardFormat(x);cardFormatRef.current=x;tracks.current.clear();
    setInfo("Scanning mode changed. Already reviewed answers remain in the list.");
    setError("");
  }}>
    <option value="mixed">Both — automatically recognize ZoKivo + Wayground</option>
    <option value="zokivo">ZoKivo Q-Cards only</option>
    <option value="wayground">Wayground / Quizizz Q-Cards only (beta)</option>
  </select>
  <p className="paper-muted">Both card types can appear in the same frame and room. Matching card numbers remain separate.</p>
</div><div className="paper-camera-frame"><video ref={video} muted playsInline aria-label="Live camera view for scanning ZoKivo Q-cards"/><canvas ref={overlay} className="paper-scan-overlay" aria-hidden="true"/>{!cameraActive&&<div className="paper-camera-placeholder"><span>⌗</span><p>Point at ZoKivo and Wayground Q-Cards together</p></div>}</div><div className="paper-detection-metrics" role="status"><b>{visibleCards} cards visible in this frame</b><span>{scannerEngine}{unstable>0?" · "+unstable+" unreadable code(s)":""}</span></div>
  <p className="paper-camera-permission-note">Tap the button to request real camera access from your browser. Available in the lobby for testing; submit answers only after the first question starts. Your browser may require Camera permission in site settings.</p>
  <div className="paper-cam-actions"><button type="button" className="button button-dark" disabled={cameraActive||cameraRequesting||session.status==="finished"} onClick={()=>void startCamera()}>{cameraRequesting?"Requesting permission…":cameraActive?"Camera active":"Enable camera · request permission"}</button><button type="button" className="button button-outline" disabled={!cameraActive&&!cameraRequesting} onClick={stop}>Stop</button></div>
  <p className="paper-scan-tip">Use ZoKivo QR Cards and original Wayground Q-Cards separately or together. Hold each card upright with your chosen A/B/C/D at the top. Keep cards close, face-on and well lit. The camera verifies detections across two frames. Review all answers before submitting.</p>
 </aside></div>
 <div className="paper-review-grid"><section className="paper-review-card"><div className="paper-review-heading"><h2>Review scanned answers</h2><span>{entries.length} / 120 identities</span></div>
 {entries.length===0?<p className="paper-muted">No cards scanned yet. Hold cards steady in good light, or add a card manually.</p>:<div className="paper-scanned-list">{entries.map(e=><div className="paper-scanned-card" key={cardKey(e)}><b>{cardTitle(e)}</b><select aria-label={"Answer for "+cardTitle(e)} value={e.choice} onChange={ev=>setScans(prev=>({...prev,[cardKey(e)]:Number(ev.target.value) as Choice}))}>{CHOICES.map((c,i)=><option value={i} key={c}>{c}</option>)}</select><button type="button" aria-label={"Remove "+cardTitle(e)} onClick={()=>setScans(prev=>{const x={...prev};delete x[cardKey(e)];return x})}>×</button></div>)}</div>}
 <div className="paper-manual-form"><label>Card type <select value={manualSource} onChange={e=>setManualSource(e.target.value as CardSource)}><option value="zokivo">ZoKivo</option><option value="wayground">Wayground</option></select></label><label>Card number <input type="number" min={1} max={60} placeholder="001" value={manualCard} onChange={e=>setManualCard(e.target.value)}/></label><label>Answer <select value={manualChoice} onChange={e=>setManualChoice(Number(e.target.value) as Choice)}>{CHOICES.map((x,i)=><option value={i} key={x}>{x}</option>)}</select></label><button type="button" onClick={addManual}>Add / correct</button></div>
 {info&&<p className="paper-info-line" role="status">{info}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
 </section><aside className="paper-review-card"><h2>Scores</h2><p className="paper-muted">Results update after answers are submitted. Only numbered cards are recorded — no student names.</p><div className="paper-ranking">{session.leaderboard?.length?session.leaderboard.slice(0,120).map((r,i)=><div key={cardKey({card_source:r.card_source,card:r.card_number})}><span>{i+1}.</span><b>{cardTitle({card_source:r.card_source,card:r.card_number})}</b><strong>{r.score} pts</strong></div>):<p className="paper-muted">Waiting for the first responses.</p>}</div></aside></div>
 <p className="paper-beta-note">Mixed-card Beta: supports ZoKivo QR and Wayground six-by-six markers in the same camera frame. Scores and submissions treat the same card number from each brand as distinct. Bring <Link href="/paper/cards">ZoKivo cards</Link> or existing Wayground cards. This independent Wayground decoder is not affiliated with Wayground. Correctness is validated on the server; on-device camera accuracy has not yet been classroom-tested. Use one numbered card per student for an entire session.</p>
 </>}
 </main>;
}
