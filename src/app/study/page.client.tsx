"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {QuestionMedia} from "@/components/question-media";
type Listing={id:string;title:string;subject:string;question_count:number};
type Question={position:number;question:string;options:[string,string,string,string];image_url?:string;audio_url?:string;formula_text?:string};
type Progress={completed:number;correct:number;mistakes:number[]};
type Answer={correct:boolean;correctIndex:number;explanation:string};
type History={id:string;title:string;subject:string;attempts:number;correct:number;last_practiced:string};
const letters=["A","B","C","D"];
export default function Study(){
 const [list,setList]=useState<Listing[]>([]),[id,setId]=useState(""),[title,setTitle]=useState("");
 const [questions,setQuestions]=useState<Question[]>([]),[progress,setProgress]=useState<Progress>({completed:0,correct:0,mistakes:[]});
 const [signedIn,setSignedIn]=useState(false),[history,setHistory]=useState<History[]>([]);
 const [review,setReview]=useState(false),[number,setNumber]=useState(0),[result,setResult]=useState<Answer|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[done,setDone]=useState(false);
 const refreshHistory=async()=>{
  const r=await fetch("/api/study/history",{cache:"no-store"});
  if(r.ok){const j=await r.json();setHistory(j.history||[])}
 };
 useEffect(()=>{
  let mounted=true;
  void fetch("/api/quizzes",{cache:"no-store"}).then(r=>r.json()).then(j=>{
   if(!mounted)return;
   const rows=(j.quizzes||[]) as Listing[];
   setList(rows);
   const q=new URLSearchParams(window.location.search).get("quiz");
   setId(q&&rows.some(a=>a.id===q)?q:(rows[0]?.id||""));
   void refreshHistory();
   if(!rows.length)setLoading(false);
  }).catch(()=>{if(mounted){setError("Published quizzes could not be loaded.");setLoading(false)}});
  return()=>{mounted=false};
 },[]);
 useEffect(()=>{
  if(!id)return;
  let alive=true;
  setLoading(true);setError("");setNumber(0);setResult(null);setReview(false);setDone(false);
  void fetch("/api/study/"+encodeURIComponent(id),{cache:"no-store"}).then(async r=>{
   const j=await r.json();if(!r.ok)throw Error(j.error||"Quiz unavailable");return j;
  }).then(j=>{if(!alive)return;setQuestions(j.questions||[]);setTitle(j.quiz.title);setProgress(j.progress);setSignedIn(j.signedIn);window.history.replaceState(null,"","/study?quiz="+id)})
    .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Could not open quiz")})
    .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[id]);
 const queue=useMemo(()=>review?questions.filter(q=>progress.mistakes.includes(q.position)):questions,[questions,progress.mistakes,review]);
 const q=queue[number];
 async function answer(choice:number){
  if(!q||result||busy||!signedIn)return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/study/"+encodeURIComponent(id)+"/answer",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({position:q.position,choice})
   });
   const j=await r.json();if(!r.ok)throw Error(j.error||"Answer could not be saved.");
   setResult(j);
   setProgress(p=>({...p,completed:p.completed+1,correct:p.correct+(j.correct?1:0),
    mistakes:j.correct?p.mistakes.filter(n=>n!==q.position):Array.from(new Set([...p.mistakes,q.position]))}));
   void refreshHistory();
  }catch(e){setError(e instanceof Error?e.message:"Cannot save answer.")}
  finally{setBusy(false)}
 }
 function next(){
  if(number+1>=queue.length){setDone(true);setResult(null)}else{setNumber(n=>n+1);setResult(null)}
 }
 function restart(mistakesOnly:boolean){
  setReview(mistakesOnly);setNumber(0);setResult(null);setDone(false);setError("");
 }
 return <main className="study-page wrap">
  <nav className="quiz-breadcrumb"><Link href="/games">← Game modes</Link><span>/ Study</span></nav>
  <header className="study-heading"><span className="eyebrow eyebrow--mini">SOLO LEARNING</span><h1>Study. Practice. <em>Improve.</em></h1><p>Review questions at your own pace, learn from mistakes and revisit past practice. No competitive score or game PIN needed.</p></header>
  <div className="study-layout"><section className="study-card">
   <div className="study-card-head"><label>Choose a published quiz<select value={id} onChange={e=>setId(e.target.value)}>{list.map(t=><option value={t.id} key={t.id}>{t.title} · {t.question_count} questions</option>)}</select></label><span>{review?"MISSED QUESTIONS":"STUDY MODE"}</span></div>
   {loading?<p>Loading questions…</p>:error&&!q?<p role="alert" className="form-error">{error}</p>:!list.length?<p>No published quizzes yet.</p>:done?<div className="study-finish"><span>★</span><h2>Great practice!</h2><p>Practice history and mistakes are saved to your ZoKivo account.</p><div><button className="button button-dark" onClick={()=>restart(false)}>Study again ↗</button>{progress.mistakes.length>0&&<button className="button button-outline" onClick={()=>restart(true)}>Review mistakes ({progress.mistakes.length})</button>}</div></div>:!q?<div className="study-finish"><h2>All caught up! ✳</h2><p>You have no incorrect questions awaiting review in this quiz.</p><button className="button button-dark" onClick={()=>restart(false)}>Review all questions</button></div>:<>
    <div className="study-progress"><span>QUESTION {number+1} / {queue.length}</span><span>{title}</span></div>
    <div className="study-progress-bar"><i style={{width:((number+1)/Math.max(queue.length,1)*100)+"%"}}/></div>
    <h2>{q.question}</h2><QuestionMedia imageUrl={q.image_url} audioUrl={q.audio_url} formula={q.formula_text}/>
    <div className="study-options">{q.options.map((opt,i)=><button type="button" key={i} disabled={!!result||busy||!signedIn} className={"study-option"+(result&&i===result.correctIndex?" correct":result&&i!==result.correctIndex?" dimmed":"")} onClick={()=>void answer(i)}><strong>{letters[i]}</strong><span>{opt}</span></button>)}</div>
    {result&&<div className={"study-feedback"+(result.correct?" is-correct":" is-incorrect")} role="status"><b>{result.correct?"✓ Correct!":"Not quite — review the correct answer."}</b><p>{result.explanation||"Check which option is highlighted, then continue."}</p><button type="button" onClick={next} className="button button-dark">{number+1>=queue.length?"Finish practice →":"Next question →"}</button></div>}
    {error&&<p role="alert" className="form-error">{error}</p>}
    {!signedIn&&<div className="study-signin"><p>Sign in with your Vynalth AI account to save study progress and answers.</p><Link className="button button-yellow" href={"/auth/login?next="+encodeURIComponent("/study?quiz="+id)}>Sign in to practice →</Link></div>}
   </>}
  </section>
  <aside className="study-side"><section><span className="eyebrow eyebrow--mini">YOUR PROGRESS</span><h2>{progress.completed} <small>attempts</small></h2><p>{progress.correct} correct · {progress.completed?Math.round(progress.correct/progress.completed*100):0}% accuracy</p><p>{progress.mistakes.length} question(s) to revisit</p>
  <button type="button" disabled={!progress.mistakes.length} onClick={()=>restart(true)}>Review mistakes →</button><button type="button" onClick={()=>restart(false)}>All questions →</button></section>
  <section><span className="eyebrow eyebrow--mini">RECENT STUDY HISTORY</span><h3>Keep learning.</h3>{history.length?history.map(x=><button type="button" className="study-history" key={x.id} onClick={()=>setId(x.id)}><b>{x.title}</b><span>{x.correct}/{x.attempts} correct</span></button>):<p>When you practice while signed in, your history appears here.</p>}</section></aside>
  </div>
 </main>;
}
