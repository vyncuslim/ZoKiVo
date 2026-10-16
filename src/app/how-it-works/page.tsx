import Link from "next/link";
import type { Metadata } from "next";
export const metadata:Metadata={title:"How it works",description:"Learn how to host or join a ZoKivo live classroom game."};
const hostSteps=[
 {n:"01",title:"Start a Quiz Party",body:"Open the host page and create a room using the World Explorer starter quiz."},
 {n:"02",title:"Share the six-digit PIN",body:"Your new room comes with a PIN. Send it to your players."},
 {n:"03",title:"Kick things off",body:"Wait for at least one player, then start the timed questions and watch the leaderboard."}
];
const playerSteps=[
 {n:"01",title:"Enter the game PIN",body:"Open Join a game and type the six-digit code from your host."},
 {n:"02",title:"Pick your nickname",body:"A nickname is all you need for the current guest join experience."},
 {n:"03",title:"Answer and score",body:"Choose an answer before time runs out. Every correct answer earns 100 points."}
];
export default function How(){
 return <main className="wrap section-page" id="main-content">
   <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><strong>How it works</strong></nav>
   <header className="section-page-head"><span className="eyebrow eyebrow--mini">THE SIMPLE STUFF</span><h1>Ready. Set.<br/><em>Quiz!</em></h1><p>All you need is a host, some players and one little game PIN.</p></header>
   <section className="how-layout" aria-label="Instructions for hosts and players">
      <article className="instruction-card instruction-host"><div className="instruction-top"><span>FOR THE HOST</span><span aria-hidden="true">✳</span></div><h2>Lead the fun.</h2><ol>{hostSteps.map(s=><li key={s.n}><span className="step-index">{s.n}</span><div><h3>{s.title}</h3><p>{s.body}</p></div></li>)}</ol><Link className="button button-dark" href="/host">Host a game ↗</Link></article>
      <article className="instruction-card instruction-player"><div className="instruction-top"><span>FOR THE PLAYER</span><span aria-hidden="true">★</span></div><h2>Join the fun.</h2><ol>{playerSteps.map(s=><li key={s.n}><span className="step-index">{s.n}</span><div><h3>{s.title}</h3><p>{s.body}</p></div></li>)}</ol><Link className="button button-yellow" href="/play">Join a game ↗</Link></article>
   </section>
   <section className="faq-panel" aria-labelledby="faq-title"><div><span className="eyebrow eyebrow--mini">QUICK ANSWERS</span><h2 id="faq-title">Good to know</h2></div><div className="faq-items"><details><summary>Do players need an account?</summary><p>No. Players can join the current quiz with a PIN and a nickname.</p></details><details><summary>Can I play on a phone?</summary><p>Yes. ZoKivo&apos;s game screens are designed for both mobile and desktop browsers.</p></details><details><summary>Is this a finished classroom product?</summary><p>Not yet. This is an early-access prototype. Teacher authentication, moderation and real-time infrastructure are still being developed.</p></details></div></section>
   <div className="section-next"><span>WANT A PREVIEW FIRST?</span><Link href="/try">Try a question <b aria-hidden="true">↗</b></Link></div>
 </main>;
}
