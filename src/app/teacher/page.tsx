"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type Member={role:"student"|"teacher";teacherVerified:boolean;email:string};
type Quiz={id:string;title:string;question_count:number};
type Assignment={id:string;title:string;quiz_title:string;due_at:string|null;created_at:string};
export default function TeacherWorkspace(){
 const [member,setMember]=useState<Member|null>(null),[loading,setLoading]=useState(true),[quizzes,setQuizzes]=useState<Quiz[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]),[selected,setSelected]=useState(""),[title,setTitle]=useState(""),[due,setDue]=useState("");
 const [working,setWorking]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const refresh=async()=>{const r=await fetch("/api/assignments",{cache:"no-store"});if(r.ok){const j=await r.json();setAssignments(j.assignments||[])}};
 useEffect(()=>{let mounted=true;void (async()=>{try{
  const r=await fetch("/api/auth/me",{cache:"no-store"}),j=await r.json();
  if(!mounted)return;if(!j.authenticated){setError("Sign in to access the teacher workspace.");return}
  setMember(j.user);
  if(j.user?.role!=="teacher")return;
  const q=await fetch("/api/quizzes",{cache:"no-store"}),v=await q.json();
  if(!mounted)return;
  const items=(v.quizzes||[]) as Quiz[];setQuizzes(items);setSelected(items[0]?.id||"");
  await refresh();
 }catch(e){if(mounted)setError(e instanceof Error?e.message:"Unable to load workspace")}
 finally{if(mounted)setLoading(false)}})();return()=>{mounted=false}},[]);
 async function assign(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setNotice("");setWorking(true);
  try{
   const r=await fetch("/api/assignments",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({quizId:selected,title:title.trim(),dueAt:due?new Date(due).toISOString():null})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||"Unable to create assignment");
   setNotice("Assignment created. Share the assignment link with students.");setTitle("");setDue("");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Could not create assignment")}finally{setWorking(false)}
 }
 return <main className="quiz-workspace wrap">
  <nav className="quiz-breadcrumb"><Link href="/account">← My account</Link><span>/ Teacher workspace</span></nav>
  <div className="quiz-title-row"><div><span className="eyebrow eyebrow--mini">ZOKIVO TEACHER WORKSPACE</span><h1>Teach. Create. <em>Play.</em></h1><p>Build draft quizzes, host classroom games and share study assignments.</p></div></div>
  {error&&<p role="alert" className="form-error">{error}</p>}
  {loading?<p>Checking account role…</p>:!member?<Link href="/auth/login?next=/teacher">Sign in to continue →</Link>:
   member.role!=="teacher"?<p>This workspace is in Teacher mode. <Link href="/account">Switch to Teacher Account →</Link></p>:<>
   <div className="quiz-library-section">
    <h2>Teaching tools</h2>
    <div className="auth-account-actions">
     <Link className="button button-dark" href="/create">Create quiz draft →</Link>
     <Link className="button button-outline" href="/host">Host live game →</Link>
     <Link className="button button-outline" href="/library">Quiz library →</Link>
    </div>
    <p className="auth-disclaimer">{member.teacherVerified?"✓ Verified educator: authorized quiz publication is available.":"Teacher account mode selected. Quiz publication still requires verified teacher authorization; you can create drafts and host already published quizzes."}</p>
   </div>
   <section className="quiz-work-card"><h2>Assign a practice quiz</h2>
    <p>Share a published quiz as a study assignment. Students sign in to save their own practice attempts. Per-assignment completion tracking is not yet available.</p>
    <form className="auth-form" onSubmit={e=>void assign(e)}>
     <label>Published quiz<select value={selected} onChange={e=>setSelected(e.target.value)} required>{quizzes.map(q=><option key={q.id} value={q.id}>{q.title} ({q.question_count} questions)</option>)}</select></label>
     <label>Assignment title<input value={title} onChange={e=>setTitle(e.target.value)} minLength={3} maxLength={120} required placeholder="Year 7 grammar practice"/></label>
     <label>Due date (optional)<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label>
     <button type="submit" className="button button-yellow" disabled={working||!selected||title.trim().length<3}>{working?"Creating…":"Create assignment link →"}</button>
    </form>
    {!quizzes.length&&<p>No published quizzes yet. Drafts must be reviewed and published by a verified educator.</p>}
    {notice&&<p role="status" className="quiz-success">{notice}</p>}
   </section>
   <section className="quiz-library-section"><h2>My assigned practice</h2>
    {assignments.length?assignments.map(a=><article className="quiz-library-card" key={a.id}>
     <strong>{a.title}</strong><p>{a.quiz_title}</p><p>Due: {a.due_at?new Date(a.due_at).toLocaleString():"No deadline"}</p>
     <a href={"/assignment/"+a.id}>Student assignment link ↗</a>
    </article>):<p>Assignments you create will appear here.</p>}
   </section>
  </>}
 </main>
}
