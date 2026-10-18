import Link from "next/link";
import type {Metadata} from "next";
export const metadata:Metadata={alternates:{canonical:"/games"},title:"Play and learn",description:"Four easy ways to explore ZoKivo: discover quizzes, host a game, enter a PIN or study solo."};
const paths=[
 {icon:"📚",name:"Discover quizzes",description:"Explore topics and find a quiz you love.",href:"/library",action:"Find quizzes →",color:"library"},
 {icon:"🎤",name:"Host a game",description:"Teachers: pick questions, choose a mode, invite players.",href:"/host",action:"Create a room →",color:"host"},
 {icon:"🎮",name:"Join with PIN",description:"Students: type the six-digit game PIN and play.",href:"/play",action:"Enter PIN →",color:"join"},
 {icon:"✏️",name:"Study solo",description:"Practice at your own pace, no competition needed.",href:"/study",action:"Start studying →",color:"study"}
];
const playable=[
 {id:"quiz_party",emoji:"⚡",title:"Quiz Party",text:"Answer quickly, earn points and climb the leaderboard."},
 {id:"gold_quest",emoji:"🎁",title:"Gold Quest",text:"Answer questions and unlock mystery treasures."},
 {id:"crypto_hack",emoji:"🧩",title:"Code Quest",text:"Solve fictional code challenges to collect virtual coins."},
 {id:"fishing_frenzy",emoji:"🎣",title:"Fishing Frenzy",text:"Answer, cast a line and collect imaginary fish."},
 {id:"cafe",emoji:"🧁",title:"Café",text:"Answer and serve happy café customers."}
];
export default function Games(){
 return <main className="wrap zk-games-page">
  <header className="zk-games-hero"><span className="zk-kicker">ZOKIVO · PLAY · LEARN · WIN</span>
   <h1>What would you like to <em>play?</em></h1>
   <p>Pick one simple action to get started. ZoKivo works on phones and computers.</p>
  </header>
  <section aria-labelledby="games-start-title"><h2 className="zk-games-section-title" id="games-start-title">Let's get started ✨</h2>
   <div className="zk-games-action-grid">{paths.map(p=><Link href={p.href} className={"zk-games-action zk-games-action--"+p.color} key={p.href}>
    <span className="zk-games-action-icon" aria-hidden="true">{p.icon}</span><h3>{p.name}</h3><p>{p.description}</p>
    <strong>{p.action}</strong></Link>)}</div>
  </section>
  <section aria-labelledby="games-modes-title" className="zk-games-modes">
   <div className="zk-games-mode-head"><div><h2 className="zk-games-section-title" id="games-modes-title">Choose a game mode</h2>
    <p>Five ZoKivo modes are available to host right now.</p></div><Link href="/how-it-works">How to play? →</Link></div>
   <div className="zk-games-mode-grid">{playable.map(m=><article className="zk-games-mode" key={m.id}>
    <span aria-hidden="true" className="zk-games-mode-icon">{m.emoji}</span><h3>{m.title}</h3><p>{m.text}</p>
    <Link href={"/host?mode="+m.id}>Host this mode →</Link>
   </article>)}</div>
  </section>
  <section className="zk-games-extras" aria-label="More ways to learn">
   <div><h2>🗂️ Paper Mode</h2><p>Early-access classroom scanning prototype — not a finished live game.</p><Link href="/paper">Explore beta →</Link></div>
   <div><h2>🚀 More games coming</h2><p>Team Clash and Speed Run are in development, not available to host yet.</p><Link href="/how-it-works">Learn more →</Link></div>
  </section>
 </main>;
}
