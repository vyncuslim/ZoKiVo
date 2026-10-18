"use client";
import {useEffect,useState} from "react";import Link from "next/link";import {useRouter} from "next/navigation";import {BrandMark} from "@/components/brand";
type QuizChoice={id:string;title:string;question_count:number;subject:string};
export default function Host(){const[error,setError]=useState("");const[busy,setBusy]=useState(false);const[quizzes,setQuizzes]=useState<QuizChoice[]>([]),[selected,setSelected]=useState(""),[questionSeconds,setQuestionSeconds]=useState(15),[lateJoin,setLateJoin]=useState(false),[randomNames,setRandomNames]=useState(false),[gameMode,setGameMode]=useState("quiz_party"),[shuffle,setShuffle]=useState(false),[muteSounds,setMuteSounds]=useState(false),[scoreGoal,setScoreGoal]=useState(0);const router=useRouter();
 useEffect(()=>{const choice=new URLSearchParams(location.search).get("mode");if(choice&&["quiz_party","gold_quest","crypto_hack","fishing_frenzy","cafe"].includes(choice))setGameMode(choice)},[]);
 useEffect(()=>{void fetch("/api/quizzes",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(j=>{const rows=j?.quizzes||[];setQuizzes(rows);const desired=new URLSearchParams(location.search).get("quiz");if(desired&&rows.some((q:QuizChoice)=>q.id===desired))setSelected(desired);else if(rows.length)setSelected(rows[0].id)}).catch(()=>{})},[]);
 async function create(){setBusy(true);setError("");try{const r=await fetch("/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quizId:selected||undefined,questionSeconds,allowLateJoining:lateJoin,randomPlayerNames:randomNames,gameMode,randomQuestionOrder:shuffle,muteSounds,scoreGoal:scoreGoal||null})});const j=await r.json();if(!r.ok)throw Error(j.error||"Could not create a game");sessionStorage.setItem("host:"+j.pin,j.token);router.push("/game/"+j.pin+"?host=1")}catch(e){setError(e instanceof Error?e.message:"Could not create a game")}finally{setBusy(false)}}
 const modes=[
  {id:"quiz_party",icon:"⚡",name:"Quiz Party",hint:"Answer fast and score points"},
  {id:"gold_quest",icon:"🎁",name:"Gold Quest",hint:"Answer and open treasure"},
  {id:"crypto_hack",icon:"🧩",name:"Code Quest",hint:"Answer and solve fun codes"},
  {id:"fishing_frenzy",icon:"🎣",name:"Fishing Frenzy",hint:"Answer and go fishing"},
  {id:"cafe",icon:"🍔",name:"Café",hint:"Answer and serve customers"}
 ];
 const selectedQuiz=quizzes.find(q=>q.id===selected);
 return <main className="zk-easy-page zk-host-simple wrap">
  <header className="zk-easy-intro"><span className="zk-kicker">FOR TEACHERS · EASY SETUP</span><h1>Host a game 🎮</h1><p>Just 3 steps. Students join with a PIN — no account needed.</p></header>
  <div className="zk-host-flow">
   <section className="zk-easy-card" aria-labelledby="zk-host-step-1"><h2 id="zk-host-step-1"><span className="zk-step">1</span> Pick your quiz</h2>
    <label className="zk-form-label" htmlFor="host-quiz-simple">Quiz questions</label>
    <select id="host-quiz-simple" className="zk-big-select" value={selected} onChange={e=>setSelected(e.target.value)}>
      {quizzes.length?quizzes.map(q=><option key={q.id} value={q.id}>{q.title} ({q.question_count} questions)</option>):<option value="">World Explorer (sample)</option>}
    </select>
    <p className="zk-small-hint">{selectedQuiz?selectedQuiz.question_count+" questions ready to play.":"You can also start with the sample quiz."} <Link href="/library">Explore quiz library →</Link></p>
   </section>
   <section className="zk-easy-card" aria-labelledby="zk-host-step-2"><h2 id="zk-host-step-2"><span className="zk-step">2</span> Choose how to play</h2>
    <div className="zk-mode-picker" role="radiogroup" aria-label="Game mode">
     {modes.map(m=><button key={m.id} type="button" role="radio" aria-checked={gameMode===m.id} className={"zk-mode-tile"+(gameMode===m.id?" is-selected":"")} onClick={()=>setGameMode(m.id)}>
      <span className="zk-mode-icon" aria-hidden="true">{m.icon}</span><strong>{m.name}</strong><small>{m.hint}</small>
     </button>)}
    </div>
    <details className="zk-simple-advanced"><summary>⚙ More game settings <span>Optional</span></summary>
     <div className="host-options">
      <label className="host-option-field">Time to answer each question
       <select value={questionSeconds} onChange={e=>setQuestionSeconds(Number(e.target.value))}>{[10,15,20,30,45,60].map(n=><option key={n} value={n}>{n} seconds</option>)}</select>
      </label>
      <label className="host-option-toggle"><input type="checkbox" checked={lateJoin} onChange={e=>setLateJoin(e.target.checked)}/> Allow students to join after the game starts</label>
      <label className="host-option-toggle"><input type="checkbox" checked={randomNames} onChange={e=>setRandomNames(e.target.checked)}/> Give students random nicknames</label>
      <label className="host-option-toggle"><input type="checkbox" checked={shuffle} onChange={e=>setShuffle(e.target.checked)}/> Shuffle questions</label>
      <label className="host-option-toggle"><input type="checkbox" checked={muteSounds} onChange={e=>setMuteSounds(e.target.checked)}/> Mute game sounds</label>
      <label className="host-option-field">End game when
       <select value={scoreGoal} onChange={e=>setScoreGoal(Number(e.target.value))}><option value={0}>All questions have been played</option>{[500,1000,2000,5000].map(n=><option key={n} value={n}>Someone earns {n} quiz points</option>)}</select>
      </label>
     </div>
    </details>
   </section>
   <section className="zk-easy-card zk-host-start" aria-labelledby="zk-host-step-3"><h2 id="zk-host-step-3"><span className="zk-step">3</span> Invite your class</h2>
    <p>Click the button, share the six-digit PIN, then press <strong>Start game</strong> when your students are ready.</p>
    <button className="zk-primary-action" type="button" disabled={busy} onClick={create}>{busy?"Creating your room…":"Create game room →"}</button>
    {error&&<p role="alert" className="form-error">{error} <Link href="/auth/login?next=/host">Sign in ↗</Link></p>}
    <p className="zk-small-hint">Your PIN is temporary. After the game finishes, the number can be reused for a new game.</p>
   </section>
  </div>
 </main>;
}
