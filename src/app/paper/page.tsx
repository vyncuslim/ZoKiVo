"use client";
import Link from "next/link";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {BrandMark} from "@/components/brand";
export default function PaperPage(){
 const[busy,setBusy]=useState(false),[error,setError]=useState("");const router=useRouter();
 async function create(){
  setBusy(true);setError("");
  try{
    const r=await fetch("/api/paper",{method:"POST"}),result=await r.json();
    if(!r.ok)throw Error(result.error||"Failed to create a session");
    sessionStorage.setItem("paper-host:"+result.pin,result.hostToken);
    router.push("/paper/scan/"+result.pin);
  }catch(e){setError(e instanceof Error?e.message:"Something went wrong")}finally{setBusy(false)}
 }
 return <main className="paper-root wrap">
  <nav className="paper-crumbs"><Link href="/games">← Games</Link><span>/ Paper Mode</span></nav>
  <section className="paper-hero"><div>
   <span className="paper-eyebrow">✳ CLASSROOM BETA · NO STUDENT DEVICES</span>
   <h1>All hands up.<br/><span>All cards out.</span></h1>
   <p>One teacher phone. One classroom screen. A pack of printable answer cards. That's all you need to start a paper-powered Quiz Party.</p>
   <div className="paper-hero-actions"><button className="button button-dark" onClick={create} disabled={busy}>{busy?"Creating session...":"Start on this phone ↗"}</button><Link href="/paper/cards" className="button button-outline">Print answer cards ↓</Link></div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <p className="paper-help-note">Start on the phone you will use to scan. The projected board opens separately on any other screen using the six-digit PIN.</p>
  </div><div className="paper-hero-mark"><BrandMark size={200}/><span className="paper-spin">A&nbsp; B&nbsp; C&nbsp; D</span><b>✳</b></div></section>
  <section className="paper-info"><h2>How Paper Mode works</h2><div className="paper-steps">
   <article><span>01</span><h3>Print &amp; hand out</h3><p>Print 60 numbered, reusable cards. Each card has its own QR code and four possible orientations.</p></article>
   <article><span>02</span><h3>Project the quiz</h3><p>Start a teacher-led session on your phone. Open its board URL on a laptop or projector.</p></article>
   <article><span>03</span><h3>Rotate, scan, submit</h3><p>Students hold up cards with A, B, C or D on top. Scan and review each answer, then submit.</p></article>
  </div></section>
  <div className="paper-beta-note">Early-access feature. The browser scanner currently recognizes one QR card at a time as you move your camera across the room. Native multi-card simultaneous scanning and teacher account verification are not yet available. Start with a small test group before classroom use.</div>
 </main>;
}
