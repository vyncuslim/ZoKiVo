import type {Metadata} from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
export const metadata:Metadata={alternates:{canonical:"/"},robots:{index:true,follow:true}};
export default function Home() {
 return <main id="main-content" className="home-v2">
 <section className="hero-section wrap home-hero" aria-labelledby="home-title">
   <div className="hero-copy">
     <div className="eyebrow"><span className="eyebrow-star">✦</span> LEARNING, BUT MAKE IT FUN</div>
     <h1 id="home-title">Less<br/><span className="hero-line-outline">blah,</span><br/>more <span className="hero-pop">aha!<span className="pop-underline"/></span></h1>
     <p className="hero-description">A little competition. A lot of fun. Play live classroom quizzes with your people, wherever you are.</p>
     <div className="hero-actions"><Link href="/play" className="button button-dark">Join with a PIN <span>↗</span></Link><Link href="/host" className="button button-outline">Host a game <span>→</span></Link></div>
     <p className="hero-helper">✳ No download needed. Players can join without signing up.</p>
   </div>
   <div className="hero-art home-hero-art" aria-label="ZoKivo mascot on a playful game poster">
     <div className="art-spark art-spark-left" aria-hidden="true">✳</div><div className="art-spark art-spark-right" aria-hidden="true">✦</div>
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
 <section className="home-launchpad" aria-labelledby="path-title"><div className="wrap">
   <div className="launchpad-heading"><div><span className="eyebrow eyebrow--mini">YOUR MOVE</span><h2 id="path-title">What are we playing?</h2></div><p>One simple decision, and you&apos;re on your way.</p></div>
   <div className="launchpad-grid">
      <Link className="launchpad-card launchpad-join" href="/play"><span className="launchpad-overline">I'M A PLAYER</span><span className="launchpad-symbol" aria-hidden="true">↗</span><strong>I have a PIN</strong><span>Enter your code and jump into a live game.</span><b className="launchpad-link">Join a game →</b></Link>
      <Link className="launchpad-card launchpad-host" href="/host"><span className="launchpad-overline">I'M THE HOST</span><span className="launchpad-symbol" aria-hidden="true">✳</span><strong>Let's play!</strong><span>Start the starter quiz, then invite your crew.</span><b className="launchpad-link">Create a room →</b></Link>
   </div>
   <div className="home-explore-links" aria-label="Discover more about ZoKivo">
     <Link href="/games"><span aria-hidden="true">★</span> Explore game modes <b>↗</b></Link>
     <Link href="/how-it-works"><span aria-hidden="true">➜</span> How it works <b>↗</b></Link>
     <Link href="/try"><span aria-hidden="true">✦</span> Try a quick quiz <b>↗</b></Link>
   </div>
 </div></section>
 </main>;
}
