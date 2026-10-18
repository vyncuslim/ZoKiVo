"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type Quiz={id:string;title:string;subject:string;grade_level:string;language:string;description:string;status:string;question_count:number};
export default function Library(){
 const [mine,setMine]=useState<Quiz[]>([]),[publicItems,setPublic]=useState<Quiz[]>([]),[error,setError]=useState(""),[loggedIn,setLoggedIn]=useState(true),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;
  void Promise.all([fetch("/api/quizzes?mine=1",{cache:"no-store"}),fetch("/api/quizzes",{cache:"no-store"})]).then(async([m,p])=>{
   const mj=await m.json(),pj=await p.json();if(!active)return;
   if(!m.ok){setLoggedIn(m.status!==401);setError(m.status===401?"Sign in to save your own quizzes.":mj.error||"Could not load private quiz library.")}
   else setMine(mj.quizzes||[]);
   if(p.ok)setPublic(pj.quizzes||[]);else if(m.ok)setError(pj.error||"Published quizzes are unavailable.");
   setLoading(false);
  }).catch(()=>{if(active){setError("Unable to reach quiz database. Try again later.");setLoading(false)}});return()=>{active=false};
 },[]);
 return <main className="quiz-workspace wrap">
 <nav className="quiz-breadcrumb"><Link href="/games">← Games</Link><span>/ Quiz Library</span></nav>
 <div className="quiz-title-row"><div><span className="eyebrow eyebrow--mini">YOUR LEARNING, YOUR RULES</span><h1>Quiz <em>library.</em></h1><p>Create, review and host quizzes. Drafts remain private until their owner selects Teacher mode and explicitly publishes them.</p></div><Link className="button button-dark" href="/create">+ Create quiz</Link></div>
 {error&&<div className="quiz-info" role="status">{error} {!loggedIn&&<Link href="/auth/login?next=/library">Sign in ↗</Link>}</div>}
 {loading?<p>Loading quizzes…</p>:<>
  <section className="quiz-library-section"><div className="quiz-list-heading"><h2>My quizzes</h2><span>{mine.length} saved</span></div>
   {mine.length?<div className="quiz-list-grid">{mine.map(q=><article className="quiz-library-card" key={q.id}>
    <span className="quiz-chip">{q.status==="published"?"PUBLISHED":"DRAFT"}</span><h3>{q.title}</h3><p>{q.subject} · {q.grade_level} · {q.language.toUpperCase()}</p><span className="quiz-count">{q.question_count} questions</span>
    <div className="quiz-card-actions">{q.status==="draft"?<Link href={"/create?edit="+q.id}>Edit draft →</Link>:<Link href={"/host?quiz="+q.id}>Host quiz →</Link>}</div>
   </article>)}</div>:<div className="quiz-empty">No saved quizzes yet. <Link href="/create">Create your first quiz →</Link></div>}
  </section>
  <section className="quiz-library-section"><div className="quiz-list-heading"><h2>Ready-to-play quizzes</h2><span>{publicItems.length} available</span></div>
   {publicItems.length?<div className="quiz-list-grid">{publicItems.map(q=><article className="quiz-library-card" key={q.id}>
    <span className="quiz-chip">★ READY</span><h3>{q.title}</h3><p>{q.subject} · {q.grade_level} · {q.language.toUpperCase()}</p><span className="quiz-count">{q.question_count} questions</span>
    <div className="quiz-card-actions"><Link href={"/host?quiz="+q.id}>Host this quiz →</Link></div>
   </article>)}</div>:<div className="quiz-empty">No published quizzes are available in this environment.</div>}
  </section>
 </>}
 </main>;
}
