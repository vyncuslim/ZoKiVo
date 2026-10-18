"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
export default function PaperPage(){
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[quizzes,setQuizzes]=useState<{id:string;title:string}[]>([]),[selected,setSelected]=useState("");const [modeEnabled,setModeEnabled]=useState<boolean|null>(null);const router=useRouter();
 useEffect(()=>{let alive=true;void fetch("/api/paper/status",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(alive)setModeEnabled(j.enabled===true)}).catch(()=>{if(alive)setModeEnabled(false)});return()=>{alive=false}},[]);
 useEffect(()=>{void fetch("/api/quizzes",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(j=>{const data=j?.quizzes||[];setQuizzes(data);if(data.length)setSelected(data[0].id)}).catch(()=>{})},[]);
 async function create(){
  setBusy(true);setError("");
  try{
    const r=await fetch("/api/paper",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quizId:selected||undefined})}),result=await r.json();
    if(!r.ok)throw Error(result.error||"Failed to create a session");
    sessionStorage.setItem("paper-host:"+result.pin,result.hostToken);
    router.push("/paper/scan/"+result.pin);
  }catch(e){setError(e instanceof Error?e.message:"Something went wrong")}finally{setBusy(false)}
 }
 return <main className="paper-root wrap zk-paper-simple">
  <nav className="paper-crumbs"><Link href="/games">← Games</Link><span>/ Paper Mode</span></nav>
  <header className="zk-paper-intro"><span className="paper-eyebrow">ZOKIVO · PAPER GAME</span>
   <h1>One teacher. A whole class. <em>Just paper.</em></h1>
   <p>Students answer by holding up their cards. You use your phone to collect answers. Nobody needs a student phone or account.</p>
  </header>
  <section className="zk-paper-easy" aria-label="How to play in the classroom">
   <div className="zk-paper-tutorial"><h2>Here's how to play 🎉</h2>
    <div className="zk-paper-three">
     <article><span>1</span><div><h3>Print & share cards</h3><p>Give each student one numbered card. They keep it for the whole game.</p><Link href="/paper/cards">Get printable cards →</Link></div></article>
     <article><span>2</span><div><h3>Show questions to the class</h3><p>Choose a quiz, then show the game board on your classroom screen.</p></div></article>
     <article><span>3</span><div><h3>Hold up & scan!</h3><p>Students point A, B, C or D upward. Use the teacher's camera to check answers.</p><Link href="/paper/check">Try the camera first →</Link></div></article>
    </div>
   </div>
   <aside className="zk-paper-start"><span className="zk-kicker">TEACHER START</span><h2>Ready for your class?</h2>
    <label className="host-quiz-picker">Which quiz will you play?<select value={selected} onChange={e=>setSelected(e.target.value)}>{quizzes.length?quizzes.map(q=><option key={q.id} value={q.id}>{q.title}</option>):<option value="">Sample classroom quiz</option>}</select></label>
    <button className="button button-dark" type="button" onClick={()=>void create()} disabled={busy||modeEnabled!==true}>{busy?"Setting up…":modeEnabled===null?"Checking availability…":"Start class game →"}</button>
    {modeEnabled===false&&<div className="zk-paper-unavailable" role="status"><strong>Paper games aren't available on this deployment yet.</strong><p>You can still print cards and test the camera. We won't create a game that cannot be played.</p></div>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <p className="zk-paper-start-note">Teacher sign-in is required to host. You can print cards or test the camera without signing in.</p>
   </aside>
  </section>
  <div className="zk-paper-quicklinks"><Link href="/paper/cards">🖨️ Print cards</Link><Link href="/paper/check">📷 Check your camera</Link><Link href="/games">🎮 More games</Link></div>
  <details className="zk-paper-extra"><summary>Using other paper cards? More information</summary>
   <p>ZoKivo supports its own printable QR cards, as well as original Wayground / Quizizz Q-Cards. You can use either type, including mixed groups. Up to 60 of each format are supported in the current beta.</p>
   <a href="https://cf.quizizz.com/pdf/Quizizz-QCards/en.pdf" target="_blank" rel="noopener noreferrer">Wayground Q-Cards PDF ↗</a>
   <p>Camera recognition requires real classroom testing in different lighting and distances. Use the teacher phone to scan; project the board on another screen with the room PIN.</p>
  </details>
 </main>;
}