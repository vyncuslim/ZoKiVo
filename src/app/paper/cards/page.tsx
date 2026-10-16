"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import QRCode from "qrcode";
type Card={n:number;uri:string};
export default function CardsPage(){
 const[cards,setCards]=useState<Card[]>([]),[failed,setFailed]=useState(""),[page,setPage]=useState(0);
 useEffect(()=>{
  let mounted=true;
  void Promise.all(Array.from({length:60},(_,i)=>i+1).map(async n=>({n,uri:await QRCode.toDataURL("ZK1:"+String(n).padStart(3,"0"),{errorCorrectionLevel:"H",margin:2,width:260,color:{dark:"#17172d",light:"#ffffff"}})})))
  .then(x=>{if(mounted)setCards(x)}).catch(()=>{if(mounted)setFailed("Could not generate printable cards")});
  return()=>{mounted=false};
 },[]);
 return <main className="paper-root wrap paper-print-root">
 <div className="paper-print-controls"><nav className="paper-crumbs"><Link href="/paper">← Paper Mode</Link><span>/ Cards</span></nav>
  <div className="paper-print-top"><div><span className="paper-eyebrow">REUSABLE ANSWER CARDS</span><h1>Print once.<br/><span>Play again.</span></h1><p>60 unique cards, designed for A4 paper. Print at 100% scale, avoid cropping, and keep all QR squares fully visible.</p></div><button onClick={()=>window.print()} className="button button-dark" disabled={cards.length!==60}>Print / Save PDF ↓</button></div>
  <p className="paper-beta-note">Use the preview controls to inspect each sheet. Print / Save PDF always includes all 60 cards (10 A4 sheets, six cards per sheet). Each card has a permanent number. Students rotate the whole card until their selected letter is at the top. Use the same cards in future Paper Mode sessions.</p>
 </div>
 {cards.length===60&&<nav className="paper-print-pager" aria-label="Printable card preview"><p>Previewing cards {page*6+1}–{Math.min(60,(page+1)*6)} of 60 · Printing includes all 60 cards</p><div><button type="button" disabled={page===0} onClick={()=>setPage(v=>Math.max(0,v-1))}>← Previous</button><strong>Sheet {page+1} / 10</strong><button type="button" disabled={page===9} onClick={()=>setPage(v=>Math.min(9,v+1))}>Next →</button></div></nav>}
 {failed&&<p role="alert" className="form-error">{failed}</p>}
 {cards.length!==60?<p className="paper-loading" role="status">Generating 60 printable QR cards…</p>:<div className="paper-print-grid">{cards.map(c=>
  <article className={"paper-qr-card"+(Math.floor((c.n-1)/6)!==page?" paper-preview-hidden":"")} key={c.n}>
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
