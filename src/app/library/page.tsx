"use client";
import Link from "next/link";
import {useEffect,useState,type FormEvent} from "react";
type Quiz={id:string;title:string;subject:string;grade_level:string;language:string;description:string;status:string;question_count:number};
const subjects=["All subjects","Mathematics","Science","English","Geography","History","Computing","Logic","Robotics","General Knowledge","Bahasa Melayu","中文","Environment","Space","Sports"];
const palettes:Record<string,{icon:string;color:string}>={
 "Mathematics":{icon:"∑",color:"math"},"Science":{icon:"⚗",color:"science"},
 "English":{icon:"Aa",color:"english"},"Geography":{icon:"🌍",color:"geography"},
 "History":{icon:"⌛",color:"history"},"Computing":{icon:"⌘",color:"computing"},
 "Logic":{icon:"🧩",color:"logic"},"Robotics":{icon:"⚙",color:"robotics"},
 "General Knowledge":{icon:"✦",color:"general"},"Bahasa Melayu":{icon:"BM",color:"bm"},
 "中文":{icon:"文",color:"chinese"},"Environment":{icon:"🌱",color:"environment"},
 "Space":{icon:"☄",color:"space"},"Sports":{icon:"🏅",color:"sports"}
};
function cover(subject:string){return palettes[subject]||{icon:"✦",color:"general"}}
export default function Library(){
 const [mine,setMine]=useState<Quiz[]>([]),[publicItems,setPublic]=useState<Quiz[]>([]),
 [error,setError]=useState(""),[publicError,setPublicError]=useState(""),
 [loggedIn,setLoggedIn]=useState(true),[loading,setLoading]=useState(true),
 [loadingPublic,setLoadingPublic]=useState(true),[draftSearch,setDraftSearch]=useState(""),
 [search,setSearch]=useState(""),[subject,setSubject]=useState("All subjects"),[page,setPage]=useState(1),[total,setTotal]=useState(0);
 const pageSize=24;
 useEffect(()=>{let active=true;
  void fetch("/api/quizzes?mine=1",{cache:"no-store"}).then(async r=>{
   const j=await r.json();if(!active)return;
   if(!r.ok){setLoggedIn(r.status!==401);setError(r.status===401?"Sign in to save your own quizzes.":j.error||"Could not load private quiz library.")}
   else setMine(j.quizzes||[]);
  }).catch(()=>{if(active)setError("Unable to load your quizzes.")}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  const params=new URLSearchParams({limit:String(pageSize),page:String(page)});
  if(search)params.set("search",search);
  if(subject!=="All subjects")params.set("subject",subject);
  setLoadingPublic(true);setPublicError("");
  void fetch("/api/quizzes?"+params.toString(),{cache:"no-store",signal:controller.signal})
   .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Discovery is temporarily unavailable.");
    setPublic(j.quizzes||[]);setTotal(j.total||0);
   }).catch(e=>{if(e.name!=="AbortError")setPublicError(e instanceof Error?e.message:"Discovery is unavailable.")})
   .finally(()=>{if(!controller.signal.aborted)setLoadingPublic(false)});
  return()=>controller.abort();
 },[search,subject,page]);
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setPage(1);setSearch(draftSearch.trim())}
 function reset(){setDraftSearch("");setSearch("");setSubject("All subjects");setPage(1)}
 return <main className="quiz-workspace zk-discover-page wrap">
  <nav className="quiz-breadcrumb"><Link href="/games">← Games</Link><span>/ Discover quizzes</span></nav>
  <section className="zk-discover-hero">
   <span className="zk-kicker">ZOKIVO ORIGINAL QUIZ LIBRARY</span>
   <h1>Discover something <em>amazing.</em></h1>
   <p>Find questions for your classroom or study on your own. Choose a topic, pick a quiz, and start playing.</p>
   <form className="zk-discover-search" role="search" onSubmit={submit}>
    <label className="sr-only" htmlFor="zk-search-quizzes">Search quiz sets by keyword</label>
    <input id="zk-search-quizzes" type="search" maxLength={80} value={draftSearch} onChange={e=>setDraftSearch(e.target.value)}
     placeholder="Search Maths, IQ, Science, English…" aria-label="Search quizzes"/>
    <button type="submit">Search <span aria-hidden="true">⌕</span></button>
   </form>
  </section>
  <section className="zk-discover-main" aria-label="Public quiz sets">
   <div className="zk-discover-toolbar"><div><h2>Explore quizzes ✨</h2>
     <p role="status">{loadingPublic?"Finding quizzes…":total+" public quiz"+(total===1?"":"zes")+" available"}</p>
    </div><label>Subject
     <select aria-label="Filter public quiz by subject" value={subject} onChange={e=>{setSubject(e.target.value);setPage(1)}}>
      {subjects.map(s=><option key={s} value={s}>{s}</option>)}
     </select></label></div>
   {(search||subject!=="All subjects")&&<div className="zk-filter-hint">Showing {search?<strong>“{search}”</strong>:"all titles"}
    {subject!=="All subjects"?" in "+subject:""} <button type="button" onClick={reset}>Clear filters ×</button></div>}
   {publicError&&<p role="alert" className="quiz-info">{publicError}</p>}
   {loadingPublic?<p className="zk-discover-loading" role="status">Loading quizzes…</p>:
    publicItems.length?<div className="zk-discover-grid">
     {publicItems.map(q=>{const theme=cover(q.subject);return <article className="zk-discover-card" key={q.id}>
      <div className={"zk-quiz-cover zk-quiz-cover--"+theme.color} aria-hidden="true">
       <span className="zk-cover-sparks">✦ ⋆ ✧</span><span className="zk-cover-mark">{theme.icon}</span>
       <span className="zk-cover-count">{q.question_count} questions</span>
      </div>
      <div className="zk-discover-card-body"><span className="zk-card-subject">{q.subject}</span>
       <h3>{q.title}</h3><p>{q.grade_level} · {q.language==="zh"?"中文":q.language==="ms"?"Bahasa Melayu":"English"}</p>
       <div className="zk-quiz-card-actions"><Link href={"/host?quiz="+q.id}>Host game →</Link><Link href={"/study?quiz="+q.id}>Study →</Link></div>
      </div>
     </article>})}</div>:<div className="quiz-empty">No quizzes match yet. Try another subject or search. <button type="button" onClick={reset}>Show all quizzes</button></div>}
   {!loadingPublic&&total>pageSize&&<nav className="zk-discover-pagination" aria-label="Quiz result pages">
    <button type="button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Previous</button>
    <span>Page {page} of {Math.ceil(total/pageSize)}</span>
    <button type="button" disabled={page*pageSize>=total} onClick={()=>setPage(p=>p+1)}>Next →</button>
   </nav>}
  </section>
  <section className="quiz-library-section zk-my-quizzes"><div className="quiz-list-heading"><h2>My quizzes</h2>
   <Link className="zk-add-quiz" href="/create">+ Create your own</Link></div>
   {error&&<div className="quiz-info" role="status">{error} {!loggedIn&&<Link href="/auth/login?next=/library">Sign in ↗</Link>}</div>}
   {loading?<p>Loading your quizzes…</p>:mine.length?<div className="quiz-list-grid">{mine.map(q=><article className="quiz-library-card" key={q.id}>
    <span className="quiz-chip">{q.status==="published"?"PUBLISHED":"PRIVATE DRAFT"}</span><h3>{q.title}</h3>
    <p>{q.subject} · {q.grade_level}</p><span className="quiz-count">{q.question_count} questions</span>
    <div className="quiz-card-actions">{q.status==="draft"?<Link href={"/create?edit="+q.id}>Edit draft →</Link>:<Link href={"/host?quiz="+q.id}>Host quiz →</Link>}</div>
   </article>)}</div>:<div className="quiz-empty">No private quizzes yet. <Link href="/create">Create your first quiz →</Link></div>}
  </section>
 </main>;
}
