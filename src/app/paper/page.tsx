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
   <p>One teacher phone. One classroom screen. Use ZoKivo printable QR cards, original Wayground Q-Cards, or both in the same classroom game.</p>
   <div className="paper-hero-actions"><button className="button button-dark" onClick={create} disabled={busy}>{busy?"Creating session...":"Start on this phone ↗"}</button><Link href="/paper/cards" className="button button-outline">Print ZoKivo cards ↓</Link><Link href="/paper/check" className="button button-outline">Test your camera ✓</Link></div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <p className="paper-help-note">Start on the phone you will use to scan. The projected board opens separately on any other screen using the six-digit PIN.</p>
  </div><div className="paper-hero-mark"><BrandMark size={200}/><span className="paper-spin">A&nbsp; B&nbsp; C&nbsp; D</span><b>✳</b></div></section>
  <section className="paper-info"><h2>How Paper Mode works</h2><div className="paper-steps">
   <article><span>01</span><h3>Print &amp; hand out</h3><p>Print ZoKivo cards or reuse existing Wayground/Quizizz Q-Cards — up to 60 of each type.</p></article>
   <article><span>02</span><h3>Project the quiz</h3><p>Start a teacher-led session on your phone. Open its board URL on a laptop or projector.</p></article>
   <article><span>03</span><h3>Rotate, scan, submit</h3><p>Students rotate their cards until A, B, C or D faces up. Scan both formats in the same camera view and confirm before submitting.</p></article>
  </div></section>
  <div className="paper-beta-note"><strong>Works with two types of paper cards:</strong> <Link href="/paper/cards">ZoKivo printable QR Q-Cards</Link> and <a href="https://cf.quizizz.com/pdf/Quizizz-QCards/en.pdf" target="_blank" rel="noopener noreferrer">Wayground / Quizizz original Q-Cards ↗</a>. The scanner automatically keeps the two brands separate, even when both use card #1. Experimental camera recognition needs real classroom validation; teacher authentication and public access controls are still under development. Paper Mode session creation remains disabled until explicitly enabled on a configured test environment.</div>
 </main>;
}
