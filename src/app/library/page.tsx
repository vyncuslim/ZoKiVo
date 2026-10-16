"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
type Quiz={id:string;title:string;subject:string;grade_level:string;language:string;description:string;status:string;question_count:number};
export default function Library(){
 const [mine,setMine]=useState<Quiz[]>([]),[publicItems,setPublic]=useState<Quiz[]>([]),[error,setError]=useState(""),[loggedIn,setLoggedIn]=useState(true),[loading,setLoading]=useState(true);
 const [search,setSearch]=useState(""),[subject,setSubject]=useState("all"),[language,setLanguage]=useState("all");
 const subjects=useMemo(()=>Array.from(new Set([...mine,...publicItems].map(q=>q.subject))).sort((a,b)=>a.localeCompare(b)),[mine,publicItems]);
 const filter=(items:Quiz[])=>items.filter(q=>{
  const term=search.toLocaleLowerCase().trim();
  return (!term||[q.title,q.subject,q.grade_level,q.description].some(s=>s?.toLocaleLowerCase().includes(term)))
   &&(subject==="all"||q.subject===subject)&&(language==="all"||q.language===language);
 });
 const filteredMine=filter(mine),filteredPublic=filter(publicItems);
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
 <div className="quiz-title-row"><div><span className="eyebrow eyebrow--mini">YOUR LEARNING, YOUR RULES</span><h1>Quiz <em>library.</em></h1><p>Create, review and host quizzes. Drafts remain private until a verified teacher publishes them.</p></div><Link className="button button-dark" href="/create">+ Create quiz</Link></div>
 {error&&<div className="quiz-info" role="status">{error} {!loggedIn&&<Link href="/auth/login?next=/library">Sign in ↗</Link>}</div>}
 {loading?<p>Loading quizzes…</p>:<>
  <section className="quiz-work-card" aria-label="Search and filter quizzes"><div className="quiz-input-grid"><label>Search quizzes<input type="search" value={search} placeholder="Title, topic, subject or grade" onChange={e=>setSearch(e.target.value)} maxLength={100}/></label><label>Subject<select value={subject} onChange={e=>setSubject(e.target.value)}><option value="all">All subjects</option>{subjects.map(s=><option key={s} value={s}>{s}</option>)}</select></label><label>Language<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="all">All languages</option><option value="en">English</option><option value="zh">简体中文</option><option value="ms">Bahasa Melayu</option></select></label><label>Filters<button type="button" className="button button-outline" onClick={()=>{setSearch("");setSubject("all");setLanguage("all")}}>Clear filters</button></label></div></section>
  <section className="quiz-library-section"><div className="quiz-list-heading"><h2>My quizzes</h2><span>{filteredMine.length} of {mine.length} saved</span></div>
   {filteredMine.length?<div className="quiz-list-grid">{filteredMine.map(q=><article className="quiz-library-card" key={q.id}>
    <span className="quiz-chip">{q.status==="published"?"PUBLISHED":"DRAFT"}</span><h3>{q.title}</h3><p>{q.subject} · {q.grade_level} · {q.language.toUpperCase()}</p><span className="quiz-count">{q.question_count} questions</span>
    <div className="quiz-card-actions">{q.status==="draft"?<Link href={"/create?edit="+q.id}>Edit draft →</Link>:<Link href={"/host?quiz="+q.id}>Host quiz →</Link>}</div>
   </article>)}</div>:<div className="quiz-empty">{mine.length?"No quizzes match your filters.":<>No saved quizzes yet. <Link href="/create">Create your first quiz →</Link></>}</div>}
  </section>
  <section className="quiz-library-section"><div className="quiz-list-heading"><h2>Ready-to-play quizzes</h2><span>{filteredPublic.length} of {publicItems.length} available</span></div>
   {filteredPublic.length?<div className="quiz-list-grid">{filteredPublic.map(q=><article className="quiz-library-card" key={q.id}>
    <span className="quiz-chip">★ READY</span><h3>{q.title}</h3><p>{q.subject} · {q.grade_level} · {q.language.toUpperCase()}</p><span className="quiz-count">{q.question_count} questions</span>
    <div className="quiz-card-actions"><Link href={"/host?quiz="+q.id}>Host this quiz →</Link></div>
   </article>)}</div>:<div className="quiz-empty">{publicItems.length?"No published quizzes match your filters.":"No published quizzes are available in this environment."}</div>}
  </section>
 </>}
 </main>;
}
