import Link from "next/link";
import type { Metadata } from "next";
import {BrandMark} from "@/components/brand";
export const metadata:Metadata={alternates:{canonical:"/games"},title:"Game modes",description:"Discover current and upcoming ZoKivo classroom game modes."};
const upcoming=[
 {label:"TREASURE & STRATEGY",name:"Gold Quest",description:"Earn virtual treasure and use strategic risk-taking after correct answers.",symbol:"💰",tone:"mode-yellow"},
 {label:"LOGIC & MEMORY",name:"Crypto Hack",description:"Build an original classroom code-breaking game using fictional credits.",symbol:"💻",tone:"mode-peach"},
 {label:"SPEED & DISCOVERY",name:"Fishing Frenzy",description:"Learn to earn fishing chances and discover a growing collection of fish.",symbol:"🎣",tone:"mode-yellow"},
 {label:"CREATIVE MANAGEMENT",name:"Café",description:"Earn ingredients from quizzes and serve a virtual café.",symbol:"🍔",tone:"mode-peach"},
 {label:"TEAM PLAY",name:"Team Clash",description:"Team up to solve questions and work toward a common goal.",symbol:"↗",tone:"mode-yellow"},
 {label:"QUICK THINKING",name:"Speed Run",description:"Race against the clock with bite-sized question rounds.",symbol:"➜",tone:"mode-peach"}
];
export default function Games(){
 return <main className="wrap section-page" id="main-content">
 <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><strong>Game modes</strong></nav>
 <header className="section-page-head"><span className="eyebrow eyebrow--mini">PICK YOUR VIBE</span><h1>Find your<br/><em>kind of fun.</em></h1><p>Different ways to learn and compete. We&apos;re rolling them out one game at a time.</p></header>
 <section className="feature-mode" aria-labelledby="quiz-party-title">
    <div className="feature-mode-art"><div className="feature-mode-label">01 · AVAILABLE NOW</div><BrandMark size={194}/><span aria-hidden="true" className="feature-mode-spark">★</span></div>
    <div className="feature-mode-info"><span className="feature-kicker">THE ORIGINAL · SOLO QUIZ</span><h2 id="quiz-party-title">Quiz Party</h2><p>Everyone gets the same questions. Answer before the timer ends, rack up points and watch the rankings change.</p>
     <div className="feature-chips"><span>10–60 seconds per question</span><span>Custom teacher quizzes</span><span>Live leaderboard polling</span><span>Join with a PIN</span></div>
     <div className="feature-actions"><Link className="button button-dark" href="/host">Host Quiz Party ↗</Link><Link className="text-arrow" href="/try">Try a practice question →</Link></div>
    </div>
 </section>
 <section className="paper-game-strip" aria-labelledby="paper-title"><div><span className="eyebrow eyebrow--mini">CLASSROOM BETA · NO STUDENT PHONES NEEDED</span><h2 id="paper-title">✳ Paper Mode</h2><p>Give students numbered answer cards, project questions, and scan their choices with one teacher phone. Camera scanning is currently an early-access prototype.</p></div><Link href="/paper" className="button button-dark">Explore Paper Mode ↗</Link></section>
 <div className="subsection-title"><div><span className="eyebrow eyebrow--mini">COMING NEXT</span><h2>More ways to play</h2></div><p>These modes are in development and cannot be launched yet.</p></div>
 <section className="upcoming-grid" aria-label="Upcoming game modes">{upcoming.map((m,i)=><article className={"upcoming-card "+m.tone} key={m.name}><div className="mode-row"><span>{String(i+2).padStart(2,"0")} / 07</span><span className="mode-state">COMING SOON</span></div><div className="upcoming-symbol" aria-hidden="true">{m.symbol}</div><span className="feature-kicker">{m.label}</span><h3>{m.name}</h3><p>{m.description}</p></article>)}</section>
 <div className="section-next"><span>NEW TO ZOKIVO?</span><Link href="/how-it-works">See how a game works <b aria-hidden="true">↗</b></Link></div>
 </main>;
}
