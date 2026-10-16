"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import QRCode from "qrcode";
type Card={n:number;uri:string};
export default function CardsPage(){
 const[cards,setCards]=useState<Card[]>([]),[failed,setFailed]=useState("");
 useEffect(()=>{
  let mounted=true;
  void Promise.all(Array.from({length:60},(_,i)=>i+1).map(async n=>({n,uri:await QRCode.toDataURL("ZK1:"+String(n).padStart(3,"0"),{errorCorrectionLevel:"H",margin:2,width:260,color:{dark:"#17172d",light:"#ffffff"}})})))
  .then(x=>{if(mounted)setCards(x)}).catch(()=>{if(mounted)setFailed("Could not generate printable cards")});
  return()=>{mounted=false};
 },[]);
 return <main className="paper-root wrap paper-print-root">
 <div className="paper-print-controls"><nav className="paper-crumbs"><Link href="/paper">← Paper Mode</Link><span>/ Cards</span></nav>
  <div className="paper-print-top"><div><span className="paper-eyebrow">REUSABLE ANSWER CARDS</span><h1>Print once.<br/><span>Play again.</span></h1><p>60 unique cards, designed for A4 paper. Print at 100% scale, avoid cropping, and keep all QR squares fully visible.</p></div><button onClick={()=>window.print()} className="button button-dark" disabled={cards.length!==60}>Print / Save PDF ↓</button></div>
  <p className="paper-beta-note">Each card has a permanent number. Students rotate the whole card until their selected letter is at the top. Use the same cards in future Paper Mode sessions.</p>
 </div>
 {failed&&<p role="alert" className="form-error">{failed}</p>}
 {cards.length!==60?<p className="paper-loading" role="status">Generating 60 printable QR cards…</p>:<div className="paper-print-grid">{cards.map(c=>
  <article className="paper-qr-card" key={c.n}>
   <div className="paper-card-head"><strong>ZoKivo!</strong><span>CARD {String(c.n).padStart(3,"0")}</span></div>
   <div className="paper-card-code"><span className="paper-letter paper-letter-a">A</span><span className="paper-letter paper-letter-b">B</span><span className="paper-letter paper-letter-c">C</span><span className="paper-letter paper-letter-d">D</span>
    {/* QR encodes card ID only; directional finder patterns indicate orientation. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={c.uri} alt={"QR code for answer card "+c.n} width={153} height={153}/>
   </div>
   <div className="paper-card-foot">TURN YOUR CHOSEN ANSWER TO THE TOP ↗</div>
  </article>
 )}</div>}
 </main>;
}
