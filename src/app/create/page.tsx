"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {parseQuizCsv,CSV_TEMPLATE} from "@/lib/quiz-csv";
type Item={question:string;options:[string,string,string,string];correct_option_index:number;explanation:string};
type Quiz={title:string;subject:string;grade_level:string;description:string;language:"en"|"zh"|"ms";questions:Item[]};
const fresh=():Item=>({question:"",options:["","","",""],correct_option_index:0,explanation:""});
const initial=():Quiz=>({title:"",subject:"Geography",grade_level:"Year 7",language:"en",description:"",questions:[fresh()]});
const AB=["A","B","C","D"];
export default function CreateQuiz(){
 const router=useRouter();
 const [importing,setImporting]=useState(false);
 const [quiz,setQuiz]=useState<Quiz>(initial),[id,setId]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(true),[status,setStatus]=useState("draft");
 useEffect(()=>{const edit=new URLSearchParams(location.search).get("edit");
  if(!edit){setLoading(false);return}
  void fetch("/api/quizzes/"+encodeURIComponent(edit),{cache:"no-store"}).then(async r=>{
   const j=await r.json();if(!r.ok)throw Error(j.error||"Cannot load quiz");
   if(!j.quiz.editable)throw Error("Only your own unpublished drafts can be edited.");
   setId(j.quiz.id);setStatus(j.quiz.status);
   setQuiz({title:j.quiz.title,subject:j.quiz.subject,grade_level:j.quiz.grade_level,
    language:j.quiz.language,description:j.quiz.description,
    questions:j.quiz.questions.map((q:Item)=>({question:q.question,options:q.options,correct_option_index:q.correct_option_index,explanation:q.explanation}))});
  }).catch(e=>setError(e instanceof Error?e.message:"Unable to load quiz")).finally(()=>setLoading(false));
 },[]);
 function updateMeta(key:keyof Omit<Quiz,"questions">,value:string){setQuiz(q=>({...q,[key]:value}))}
 function questionChange(index:number,patch:Partial<Item>){setQuiz(q=>({...q,questions:q.questions.map((x,i)=>i===index?{...x,...patch}:x)}))}
 async function importCsv(file:File|undefined){
  if(!file)return;
  setError("");setMessage("");
  if(status!=="draft"){setError("Published quizzes cannot be edited. Create a new draft.");return}
  if(file.size>1024*1024){setError("CSV file must be 1 MB or smaller.");return}
  setImporting(true);
  try{
   const items=parseQuizCsv(await file.text());
   const isEmpty=quiz.questions.length===1&&!quiz.questions[0].question.trim()&&quiz.questions[0].options.every(x=>!x.trim());
   const prior=isEmpty?[]:quiz.questions;
   if(prior.length+items.length>40)throw Error("This would exceed the 40-question limit.");
   setQuiz(q=>({...q,questions:[...prior,...items]}));
   setMessage(items.length+" question(s) imported. Review all answers and save your draft.");
  }catch(e){setError(e instanceof Error?e.message:"CSV import failed.");}
  finally{setImporting(false)}
 }
 function downloadTemplate(){
  const url=URL.createObjectURL(new Blob([CSV_TEMPLATE],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download="zokivo-quiz-template.csv";link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function save(){
  setError("");setMessage("");setSaving(true);
  try{
   const r=await fetch(id?"/api/quizzes/"+id:"/api/quizzes",{method:id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(quiz)});
   const j=await r.json();if(!r.ok)throw Error(j.error||"Could not save draft");
   if(j.id&&!id){setId(j.id);history.replaceState(null,"","/create?edit="+j.id)}
   setMessage("Draft saved to your private ZoKivo library. It is not published.");
  }catch(e){setError(e instanceof Error?e.message:"Save failed")}finally{setSaving(false)}
 }
 async function publish(){
  if(!id){setError("Save the quiz draft before publishing.");return}
  if(!window.confirm("Publish this quiz for hosting? This requires an approved teacher account."))return;
  setError("");setSaving(true);
  try{
   const r=await fetch("/api/quizzes/"+id+"/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirm:true})});
   const j=await r.json();if(!r.ok)throw Error(j.error||"Publication failed");
   setStatus("published");router.push("/library");
  }catch(e){setError(e instanceof Error?e.message:"Publication failed")}finally{setSaving(false)}
 }
 return <main className="quiz-workspace wrap">
  <nav className="quiz-breadcrumb"><Link href="/library">← Quiz library</Link><span>/ Create &amp; edit</span></nav>
  <div className="quiz-title-row"><div><span className="eyebrow eyebrow--mini">ZOKIVO CREATOR STUDIO</span><h1>Make something <em>awesome.</em></h1><p>Build your own four-choice classroom quiz. Save privately, review, then publish with verified educator authorization.</p></div><span className="quiz-chip">✦ {status.toUpperCase()}</span></div>
  {loading?<p>Loading your draft...</p>:<>
   <section className="quiz-work-card">
    <h2>Quiz details</h2><div className="quiz-input-grid">
     <label>Quiz title<input value={quiz.title} maxLength={140} placeholder="e.g. Polar Worlds Challenge" onChange={e=>updateMeta("title",e.target.value)}/></label>
     <label>Subject<input value={quiz.subject} maxLength={80} placeholder="e.g. Geography" onChange={e=>updateMeta("subject",e.target.value)}/></label>
     <label>Grade / age band<input value={quiz.grade_level} maxLength={40} onChange={e=>updateMeta("grade_level",e.target.value)}/></label>
     <label>Language<select value={quiz.language} onChange={e=>updateMeta("language",e.target.value)}><option value="en">English</option><option value="zh">简体中文</option><option value="ms">Bahasa Melayu</option></select></label>
    </div><label className="quiz-field-wide">Description<textarea rows={2} maxLength={600} value={quiz.description} placeholder="A quick overview of what students will practice." onChange={e=>updateMeta("description",e.target.value)}/></label>
   </section>
   <div className="quiz-question-heading"><h2>Questions <span>{quiz.questions.length}/40</span></h2><button type="button" disabled={quiz.questions.length>=40||status!=="draft"} onClick={()=>setQuiz(q=>({...q,questions:[...q.questions,fresh()]}))}>+ Add question</button></div>
   <div className="quiz-toolbar" aria-label="Question import tools">
    <label>Import CSV questions <input type="file" accept=".csv,text/csv" disabled={importing||saving||status!=="draft"} onChange={e=>{const f=e.target.files?.[0];e.target.value="";void importCsv(f)}}/></label>
    <button type="button" className="button button-outline" onClick={downloadTemplate}>Download CSV template ↓</button>
    <span className="quiz-footnote">Columns: question, option_a, option_b, option_c, option_d, correct, explanation</span>
   </div>
   {quiz.questions.map((q,index)=><section className="quiz-question-editor" key={index}>
    <div className="quiz-editor-head"><strong>QUESTION {String(index+1).padStart(2,"0")}</strong><button type="button" disabled={quiz.questions.length<=1||status!=="draft"} onClick={()=>setQuiz(v=>({...v,questions:v.questions.filter((_,i)=>i!==index)}))}>Remove</button></div>
    <label className="quiz-field-wide">Question<input disabled={status!=="draft"} value={q.question} maxLength={750} placeholder="What is ...?" onChange={e=>questionChange(index,{question:e.target.value})}/></label>
    <div className="quiz-choice-grid">{AB.map((letter,i)=><label key={letter}><span className="quiz-choice-letter">{letter}</span><input disabled={status!=="draft"} value={q.options[i]} maxLength={250} placeholder={"Answer "+letter} onChange={e=>questionChange(index,{options:q.options.map((v,j)=>j===i?e.target.value:v) as Item["options"]})}/></label>)}</div>
    <div className="quiz-editor-bottom"><label>Correct answer<select disabled={status!=="draft"} value={q.correct_option_index} onChange={e=>questionChange(index,{correct_option_index:Number(e.target.value)})}>{AB.map((l,i)=><option value={i} key={i}>{l}</option>)}</select></label><label>Explanation (shown after round)<input disabled={status!=="draft"} value={q.explanation} maxLength={800} placeholder="Explain the correct answer…" onChange={e=>questionChange(index,{explanation:e.target.value})}/></label></div>
   </section>)}
   {error&&<p role="alert" className="form-error">{error}</p>}{message&&<p role="status" className="quiz-success">{message}</p>}
   <div className="quiz-toolbar"><button type="button" className="button button-dark" disabled={saving||status!=="draft"} onClick={()=>void save()}>{saving?"Please wait…":"Save draft ↗"}</button><button type="button" className="button button-yellow" disabled={saving||!id||status!=="draft"} onClick={()=>void publish()}>Publish for games ✓</button><Link className="button button-outline" href="/library">Back to library</Link></div>
   <p className="quiz-footnote">Answers stay private in your draft. Publishing requires an administrator-approved teacher role from Mother Supabase; no AI-generated identity claim can override that check.</p>
  </>}
 </main>;
}
