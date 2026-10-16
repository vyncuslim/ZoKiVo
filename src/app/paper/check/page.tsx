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
 const [mode,setMode]=useState<Mode>("both"),[number,setNumber]=useState("1"),[wanted,setWanted]=useState<Choice>(0);
 const [running,setRunning]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [status,setStatus]=useState("Start your camera or upload a photo to check a card."),[found,setFound]=useState<Hit[]>([]);
 const [results,setResults]=useState(newResults),[frames,setFrames]=useState(0);
 const video=useRef<HTMLVideoElement>(null),media=useRef<MediaStream|null>(null),raf=useRef<number|null>(null);
 const active=useRef(false),processing=useRef(false),last=useRef(0),frameNumber=useRef(0);
 const tracker=useRef(new Map<string,{choice:Choice;count:number;frame:number}>());
 const detector=useRef<MultiQrDetector|null>(null),options=useRef({mode,number,wanted});
 useEffect(()=>{options.current={mode,number,wanted};tracker.current.clear()},[mode,number,wanted]);
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
  if(!file.type.startsWith("image/")){setError("Please select an image.");setBusy(false);return}
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
 return <main className="paper-root wrap camera-check">
  <nav className="paper-crumbs"><Link href="/paper">← Paper Mode</Link><span>/ Camera test</span></nav>
  <header className="camera-heading"><span className="paper-eyebrow">PHONE + COMPUTER CAMERA CHECK</span><h1>Test A, B, C, D.<br/><span>See what the camera sees.</span></h1>
   <p>Verify every direction before using Paper Mode in class. No game PIN, database connection, or sign-in needed.</p></header>
  <div className="camera-test-grid">
   <section className="camera-test-card"><h2>1. Pick a card</h2>
    <label className="camera-label" htmlFor="test-mode">Paper card format</label>
    <select id="test-mode" className="camera-field" value={mode} onChange={e=>setMode(e.target.value as Mode)}>
     <option value="both">Both: ZoKivo + Wayground</option><option value="zokivo">ZoKivo QR cards</option><option value="wayground">Wayground original cards</option></select>
    <label className="camera-label" htmlFor="test-number">Card number (1–60)</label>
    <input className="camera-field" id="test-number" type="number" min="1" max="60" value={number} onChange={e=>setNumber(e.target.value)}/>
    <p className="camera-label">Rotate your card so this letter is at the TOP:</p>
    <div className="camera-choice-group">{letters.map((x,i)=><button type="button" key={x} aria-pressed={wanted===i} className={"camera-choice "+(wanted===i?"camera-choice-selected":"")} onClick={()=>setWanted(i as Choice)}>{x}</button>)}</div>
    <p className="camera-tip">Choose A, hold the card with A on top, then repeat for B, C and D. The camera must read the same letter you chose.</p>
    <div className="camera-buttons"><button type="button" className="button button-dark" onClick={()=>void start()} disabled={running||busy}>Start camera</button><button type="button" className="button button-outline" onClick={stop} disabled={!running}>Stop</button></div>
    <label className="camera-photo">Or check an existing photo (not a live test)<input type="file" accept="image/*" onChange={e=>void photo(e.target.files?.[0]||null)} disabled={busy}/></label>
   </section>
   <section className="camera-test-card"><div className="camera-preview-head"><h2>2. Recognition result</h2><span>{running?"● LIVE":"○ OFFLINE"}</span></div>
    <div className="camera-test-preview"><video muted playsInline ref={video} aria-label="Real camera feed"/>{!running&&<div className="camera-test-placeholder">⌗<span>Waiting for camera</span></div>}</div>
    <p className="camera-message" role="status">{status}</p><p className="camera-meta">{frames} frames analyzed</p>
    <h3>Cards recognized ({found.length})</h3><div className="camera-readings">{found.length?found.map(c=><div key={c.kind+":"+c.card}><span>{c.kind==="zokivo"?"ZoKivo":"Wayground"} #{String(c.card).padStart(3,"0")}</span><strong>{letters[c.choice]}</strong></div>):<p>No cards detected in the last frame.</p>}</div>
    {error&&<p className="form-error" role="alert">{error}</p>}
   </section>
  </div>
  <section className="camera-test-score"><div><span className="paper-eyebrow">CONFIRMED ON THIS DEVICE</span><h2>3. Results for four directions</h2><p>Only two consecutive correctly decoded live-camera frames count as a pass. Photo uploads show a reading but cannot mark this check as passed.</p></div><div className="camera-score-count"><strong>{passed}/{kinds.length*4}</strong><span>directions confirmed</span></div></section>
  <div className="camera-result-grid">{kinds.map(kind=><section className="camera-test-card" key={kind}><h3>{kind==="zokivo"?"ZoKivo":"Wayground"} cards</h3><div className="camera-result-letters">{letters.map((l,i)=><div key={l} className={results[kind][i]?"verified":"pending"}><strong>{l}</strong><span>{results[kind][i]?"✓ CONFIRMED":"Not tested"}</span></div>)}</div></section>)}</div>
  <div className="camera-test-end"><button type="button" onClick={()=>{setResults(newResults());setFrames(0);setFound([]);tracker.current.clear();setStatus("Test reset. Start again with A, B, C, D.")}}>Reset test results</button><p>For full confidence, repeat the test on a phone and a computer. Real classrooms also need checks with multiple cards, different distances and lighting.</p></div>
 </main>;
}