import Link from "next/link";
import type { Metadata } from "next";
import {BrandMark} from "@/components/brand";
export const metadata:Metadata={title:"Game modes",description:"Discover current and upcoming ZoKivo classroom game modes."};
const upcoming=[
 {label:"TEAM PLAY",name:"Team Clash",description:"Team up with friends, share ideas and aim for a collective win.",symbol:"↗",tone:"mode-peach"},
 {label:"QUICK THINKING",name:"Speed Run",description:"A race to think fast and answer before the clock runs out.",symbol:"➜",tone:"mode-yellow"}
];
export default function Games(){
 return <main className="wrap section-page" id="main-content">
 <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><strong>Game modes</strong></nav>
 <header className="section-page-head"><span className="eyebrow eyebrow--mini">PICK YOUR VIBE</span><h1>Find your<br/><em>kind of fun.</em></h1><p>Different ways to learn and compete. We&apos;re rolling them out one game at a time.</p></header>
 <section className="feature-mode" aria-labelledby="quiz-party-title">
    <div className="feature-mode-art"><div className="feature-mode-label">01 · AVAILABLE NOW</div><BrandMark size={194}/><span aria-hidden="true" className="feature-mode-spark">★</span></div>
    <div className="feature-mode-info"><span className="feature-kicker">THE ORIGINAL · SOLO QUIZ</span><h2 id="quiz-party-title">Quiz Party</h2><p>Everyone gets the same questions. Answer before the timer ends, rack up points and watch the rankings change.</p>
     <div className="feature-chips"><span>15 seconds per question</span><span>4 starter questions</span><span>Live leaderboard polling</span><span>Join with a PIN</span></div>
     <div className="feature-actions"><Link className="button button-dark" href="/host">Host Quiz Party ↗</Link><Link className="text-arrow" href="/try">Try a practice question →</Link></div>
    </div>
 </section>
 <div className="subsection-title"><div><span className="eyebrow eyebrow--mini">COMING NEXT</span><h2>More ways to play</h2></div><p>These modes are in development and cannot be launched yet.</p></div>
 <section className="upcoming-grid" aria-label="Upcoming game modes">{upcoming.map((m,i)=><article className={"upcoming-card "+m.tone} key={m.name}><div className="mode-row"><span>{String(i+2).padStart(2,"0")} / 03</span><span className="mode-state">COMING SOON</span></div><div className="upcoming-symbol" aria-hidden="true">{m.symbol}</div><span className="feature-kicker">{m.label}</span><h3>{m.name}</h3><p>{m.description}</p></article>)}</section>
 <div className="section-next"><span>NEW TO ZOKIVO?</span><Link href="/how-it-works">See how a game works <b aria-hidden="true">↗</b></Link></div>
 </main>;
}
