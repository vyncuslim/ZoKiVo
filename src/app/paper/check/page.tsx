"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {createNativeQrDetector,scanCardFrame,type Choice,type CardDetection,type MultiQrDetector} from "@/lib/paper-detection";
import {detectWaygroundFrame} from "@/lib/wayground-cards";
type Kind="zokivo"|"wayground";
type Mode=Kind|"both";
type Hit=CardDetection&{kind:Kind};
const letters=["A","B","C","D"];
const newResults=()=>({zokivo:[false,false,false,false],wayground:[false,false,false,false]});
export default function CameraCheck(){
 const [mode,setMode]=useState<Mode>("zokivo"),[number,setNumber]=useState("1"),[wanted,setWanted]=useState<Choice>(0);
 const [running,setRunning]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [status,setStatus]=useState("Start your camera or upload a photo to check a card."),[found,setFound]=useState<Hit[]>([]);
 const [results,setResults]=useState(newResults),[frames,setFrames]=useState(0);
 const video=useRef<HTMLVideoElement>(null),media=useRef<MediaStream|null>(null),raf=useRef<number|null>(null);
 const active=useRef(false),processing=useRef(false),last=useRef(0),frameNumber=useRef(0);
 const tracker=useRef(new Map<string,{choice:Choice;count:number;frame:number}>());
 const detector=useRef<MultiQrDetector|null>(null),options=useRef({mode,number,wanted});
 useEffect(()=>{options.current={mode,number,wanted};tracker.current.clear()},[mode,number,wanted]);
 // A result for card #1 cannot count as a pass for a different student card.
 useEffect(()=>{setResults(newResults());setFound([]);setFrames(0);frameNumber.current=0;},[mode,number]);
 const stop=useCallback(()=>{active.current=false;if(raf.current!==null)cancelAnimationFrame(raf.current);raf.current=null;media.current?.getTracks().forEach(t=>t.stop());media.current=null;setRunning(false)},[]);
 useEffect(()=>()=>{active.current=false;if(raf.current!==null)cancelAnimationFrame(raf.current);media.current?.getTracks().forEach(t=>t.stop())},[]);
 const check=useCallback(async(c:HTMLCanvasElement,live:boolean)=>{
  const ctx=c.getContext("2d",{willReadFrequently:true});if(!ctx)return;
  const setting=options.current,requests:Promise<Hit[]>[]=[];
  if(setting.mode!=="wayground")requests.push(scanCardFrame(c,detector.current,16).then(res=>res.detections.map(d=>({...d,kind:"zokivo" as Kind}))));
  if(setting.mode!=="zokivo")requests.push(Promise.resolve().then(()=>detectWaygroundFrame(ctx.getImageData(0,0,c.width,c.height),16).map(d=>({...d,kind:"wayground" as Kind}))));
  const hits=(await Promise.all(requests)).flat();
  setFound(hits);setFrames(v=>v+1);
  const cycle=++frameNumber.current,seen=hits.filter(h=>h.card===Number(setting.number));
  if(!seen.length){setStatus("No card #"+setting.number+" recognized. Face the card toward the camera, move closer and avoid glare.");return}
  const wrong=seen.filter(h=>h.choice!==setting.wanted);
  if(wrong.length){setStatus("⚠️ Card #"+setting.number+" detected as "+wrong.map(d=>(d.kind==="zokivo"?"ZoKivo":"Wayground")+" "+letters[d.choice]).join(" / ")+"; expected "+letters[setting.wanted]+". Check which letter points up.");return}
  for(const h of seen){
   const key=h.kind+":"+h.card,prev=tracker.current.get(key);
   const count=prev?.frame===cycle-1&&prev.choice===h.choice?prev.count+1:1;
   tracker.current.set(key,{frame:cycle,choice:h.choice,count});
   if(live&&count>=2)setResults(r=>r[h.kind][h.choice]?r:{...r,[h.kind]:r[h.kind].map((v,i)=>i===h.choice?true:v)});
  }
  setStatus(live?"✅ Correct! Card #"+setting.number+" = "+letters[setting.wanted]+". Keep still for two consecutive frames.":"✅ The photo reads "+letters[setting.wanted]+". A single photo is not a live camera verification.");
 },[]);
 async function start(){
  setBusy(true);setError("");
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error("Camera access requires a supported HTTPS browser.");
   const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});
   media.current=s;
   const v=video.current;if(!v)throw Error("Camera preview missing");
   v.srcObject=s;await v.play();
   detector.current=await createNativeQrDetector();
   active.current=true;setRunning(true);last.current=0;processing.current=false;tracker.current.clear();frameNumber.current=0;
   const canvas=document.createElement("canvas");
   const loop=(timestamp:number)=>{
    if(!active.current)return;raf.current=requestAnimationFrame(loop);
    if(processing.current||timestamp-last.current<450||v.readyState<2)return;
    const w=Math.min(1050,v.videoWidth),h=Math.floor(w*v.videoHeight/Math.max(1,v.videoWidth));if(h<40)return;
    last.current=timestamp;processing.current=true;canvas.width=w;canvas.height=h;
    canvas.getContext("2d",{willReadFrequently:true})?.drawImage(v,0,0,w,h);
    void check(canvas,true).catch(e=>setError(e instanceof Error?e.message:"Scan failed")).finally(()=>{processing.current=false});
   };
   raf.current=requestAnimationFrame(loop);
  }catch(e){stop();setError(e instanceof Error?e.message:"Camera unavailable")}finally{setBusy(false)}
 }
 async function photo(file:File|null){
  if(!file)return;setBusy(true);setError("");
  if(!file.type.startsWith("image/")||file.size>10*1024*1024){setError("Choose an image under 10 MB.");setBusy(false);return}
  const url=URL.createObjectURL(file);
  try{
   const image=new Image();image.src=url;await image.decode();
   const canvas=document.createElement("canvas"),scale=Math.min(1,1200/image.width);
   canvas.width=Math.floor(image.width*scale);canvas.height=Math.floor(image.height*scale);
   canvas.getContext("2d",{willReadFrequently:true})?.drawImage(image,0,0,canvas.width,canvas.height);
   await check(canvas,false);
  }catch(e){setError(e instanceof Error?e.message:"Image could not be read")}finally{URL.revokeObjectURL(url);setBusy(false)}
 }
 const kinds:Kind[]=mode==="both"?["zokivo","wayground"]:[mode];
 const passed=kinds.reduce((sum,k)=>sum+results[k].filter(Boolean).length,0);
 return <main className="paper-root wrap camera-check zk-camera-simple">
  <nav className="paper-crumbs"><Link href="/paper">← Paper Mode</Link><span>/ Camera test</span></nav>
  <header className="camera-heading"><span className="paper-eyebrow">ZOKIVO · CAMERA TEST</span><h1>Is your camera <span>ready?</span></h1>
   <p>Try your paper cards before class. Select a letter, show the card and check whether ZoKivo reads it correctly.</p></header>
  <nav className="zk-camera-links" aria-label="Getting started"><Link href="/paper/cards">🖨️ Need a card? Print one →</Link><Link href="/paper">← Paper Mode guide</Link></nav>
  <div className="camera-test-grid">
   <section className="camera-test-card"><h2>1 · Pick your card</h2><p className="zk-camera-step-help">Start with card #1. Check A, then turn it to B, C and D.</p>
    <details className="zk-camera-more"><summary>Using different paper cards?</summary>
     <label className="camera-label" htmlFor="test-mode">Card format</label>
     <select id="test-mode" className="camera-field" value={mode} onChange={e=>setMode(e.target.value as Mode)}>
      <option value="zokivo">ZoKivo cards</option><option value="wayground">Wayground / Quizizz cards</option><option value="both">Both formats</option>
     </select>
    </details>
    <label className="camera-label" htmlFor="test-number">Card number (1–60)</label>
    <input className="camera-field" id="test-number" type="number" min="1" max="60" value={number} onChange={e=>setNumber(e.target.value)}/>
    <p className="camera-label">2 · Which answer should face UP?</p>
    <div className="camera-choice-group">{letters.map((x,i)=><button type="button" key={x} aria-pressed={wanted===i} className={"camera-choice "+(wanted===i?"camera-choice-selected":"")} onClick={()=>setWanted(i as Choice)}>{x}</button>)}</div>
    <p className="camera-tip">Turn the card until your chosen letter is at the top, then point it at the camera.</p>
    <div className="camera-buttons"><button type="button" className="button button-dark" onClick={()=>void start()} disabled={running||busy}>{busy?"Starting…":"📷 "+(running?"Camera is on":"Start camera")}</button><button type="button" className="button button-outline" onClick={stop} disabled={!running}>Stop camera</button></div>
    <details className="zk-camera-more"><summary>Cannot use your camera? Try a photo instead</summary><label className="camera-photo">Choose a photo (not a live verification)<input type="file" accept="image/*" onChange={e=>void photo(e.target.files?.[0]||null)} disabled={busy}/></label></details>
   </section>
   <section className="camera-test-card"><div className="camera-preview-head"><h2>3 · See the result</h2><span>{running?"● CAMERA ON":"○ CAMERA OFF"}</span></div>
    <div className="camera-test-preview"><video muted playsInline ref={video} aria-label="Real camera feed"/>{!running&&<div className="camera-test-placeholder">⌗<span>Waiting for camera</span></div>}</div>
    <p className="camera-message" role="status">{status}</p><details className="zk-camera-more"><summary>Detailed scan information</summary><p className="camera-meta">{frames} frames checked</p><h3>Cards found ({found.length})</h3><div className="camera-readings">{found.length?found.map(c=><div key={c.kind+":"+c.card}><span>{c.kind==="zokivo"?"ZoKivo":"Wayground"} #{String(c.card).padStart(3,"0")}</span><strong>{letters[c.choice]}</strong></div>):<p>No cards detected in the last frame.</p>}</div></details>
    {error&&<p className="form-error" role="alert">{error}</p>}
   </section>
  </div>
  <section className="camera-test-score"><div><span className="paper-eyebrow">CONFIRMED ON THIS DEVICE</span><h2>Your camera checklist</h2><p>Hold each letter up for a moment. A checkmark means the camera recognised it twice in a row. Photos do not count as a live camera test.</p></div><div className="camera-score-count"><strong>{passed}/{kinds.length*4}</strong><span>directions confirmed</span></div></section>
  <div className="camera-result-grid">{kinds.map(kind=><section className="camera-test-card" key={kind}><h3>{kind==="zokivo"?"ZoKivo":"Wayground"} cards</h3><div className="camera-result-letters">{letters.map((l,i)=><div key={l} className={results[kind][i]?"verified":"pending"}><strong>{l}</strong><span>{results[kind][i]?"✓ CONFIRMED":"Not tested"}</span></div>)}</div></section>)}</div>
  <div className="camera-test-end"><button type="button" onClick={()=>{setResults(newResults());setFrames(0);setFound([]);tracker.current.clear();setStatus("Test reset. Start again with A, B, C, D.")}}>Reset test results</button><p>For full confidence, repeat the test on a phone and a computer. Real classrooms also need checks with multiple cards, different distances and lighting.</p></div>
 </main>;
}