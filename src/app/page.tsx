import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { MiniQuiz } from "@/components/mini-quiz";

const modes=[
 {number:"01",label:"READY TO PLAY",title:"Quiz Party",description:"Pick the right answer, beat the clock, and rise to the top.",theme:"mode-purple",mark:"✳",href:"/host",available:true},
 {number:"02",label:"IN THE WORKS",title:"Team Clash",description:"Big ideas. Better together. Team battles are coming next.",theme:"mode-peach",mark:"↗",href:"",available:false},
 {number:"03",label:"IN THE WORKS",title:"Speed Run",description:"Think fast, answer faster. A race against the clock.",theme:"mode-yellow",mark:"➜",href:"",available:false}
];
export default function Home(){
 return <main>
  <div className="ticker" aria-label="ZoKivo tagline"><span>PLAY IT LOUD</span><i>✳</i><span>LEARN SOMETHING NEW</span><i>✳</i><span>EVERYONE CAN PLAY</span><i>✳</i><span>PLAY IT LOUD</span><i>✳</i><span>LEARN SOMETHING NEW</span></div>
  <section className="hero-section wrap">
   <div className="hero-copy">
    <div className="eyebrow"><span className="eyebrow-star">✦</span> THE CLASSROOM, REMIXED</div>
    <h1>Less<br/><span className="hero-line-outline">blah,</span><br/>more <span className="hero-pop">aha!<span className="pop-underline"/></span></h1>
    <p className="hero-description">The quiz game that makes everyone want to raise their hand. Big laughs, quick thinking, and a little friendly competition.</p>
    <div className="hero-actions"><Link href="/play" className="button button-dark">Join a game <span>↗</span></Link><Link href="/host" className="button button-outline">Host a game <span>→</span></Link></div>
    <div className="hero-note"><span className="avatar-stack"><b>A</b><b>K</b><b>J</b></span><span>No downloads. Just a game PIN and you&apos;re in.</span></div>
   </div>
   <div className="hero-art" aria-label="Colorful ZoKivo game preview">
     <div className="art-spark art-spark-left">✳</div><div className="art-spark art-spark-right">✦</div>
     <div className="play-poster">
      <div className="poster-top"><span className="poster-channel"><i/> ZOKIVO LIVE</span><span>ROUND 01/04</span></div>
      <div className="poster-character"><span className="poster-halo"/><BrandMark size={210} className="mascot-big"/></div>
      <div className="poster-cloud poster-cloud-one">YOU GOT<br/><b>THIS!</b></div><div className="poster-cloud poster-cloud-two">+100 <span>★</span></div>
      <div className="poster-bottom"><span>✦</span><div><strong>PLAY HARD.</strong><br/>THINK SMART.</div><span>✦</span></div>
     </div>
     <div className="floating-label float-top">100% GOOD VIBES <span>☺</span></div>
     <div className="floating-label float-bottom"><span>★</span> LEARNING UNLOCKED</div>
   </div>
  </section>
  <section className="why-strip"><div className="wrap why-inner"><span>THE RULES ARE SIMPLE</span><strong>Play together.</strong><span className="mini-star">✳</span><strong>Learn something.</strong><span className="mini-star">✳</span><strong>Have a blast.</strong></div></section>
  <section className="modes-section wrap" id="modes"><div className="section-head"><div><span className="eyebrow eyebrow--mini">PICK YOUR VIBE</span><h2>Different ways.<br/><em>Same big fun.</em></h2></div><p>We&apos;re starting with the classics and making room for some wild ideas.</p></div>
   <div className="mode-grid">{modes.map(m=><article className={"mode-tile "+m.theme} key={m.number}><div className="mode-row"><span>{m.number} / 03</span><span className="mode-state">{m.label}</span></div><div className="mode-graphic" aria-hidden="true"><span>{m.mark}</span></div><h3>{m.title}</h3><p>{m.description}</p>{m.available?<Link href={m.href} className="mode-arrow" aria-label="Host Quiz Party">↗</Link>:<span className="mode-coming">COMING SOON</span>}</article>)}</div>
  </section>
  <section className="try-section"><div className="wrap try-grid"><div className="try-copy"><span className="eyebrow eyebrow--mini">YOU IN?</span><h2>Don&apos;t just<br/>take our <span>word for it.</span></h2><p>Tap an answer. Get a tiny taste of what it feels like to play ZoKivo.</p><div className="try-arrow" aria-hidden="true">↗</div></div><MiniQuiz/></div></section>
  <section className="how-section wrap" id="how"><div className="section-head"><div><span className="eyebrow eyebrow--mini">THREE EASY STEPS</span><h2>It&apos;s this easy.<br/><em>Seriously.</em></h2></div></div><div className="steps-grid"><div className="step-item"><span className="step-digit">01</span><div className="step-icon">✳</div><h3>Create a game</h3><p>Host a Quiz Party and get your own six-digit PIN.</p></div><div className="step-item"><span className="step-digit">02</span><div className="step-icon">➜</div><h3>Bring your people</h3><p>Friends join on any device using a nickname and PIN.</p></div><div className="step-item"><span className="step-digit">03</span><div className="step-icon">★</div><h3>Let the fun begin</h3><p>Answer, earn points and climb the leaderboard.</p></div></div></section>
  <section className="last-cta"><div className="wrap last-cta-inner"><div className="last-cta-mascot"><BrandMark size={105}/></div><div><h2>Ready, player one?</h2><p>Your next favorite game is a click away.</p></div><Link href="/play" className="button button-yellow">Let&apos;s play <span>↗</span></Link></div></section>
 </main>;
}
