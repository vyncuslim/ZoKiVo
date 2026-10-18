"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {parseSuggestedQuiz} from "@/lib/ai-quiz-import";
import {QuestionMedia} from "@/components/question-media";
type Item={question:string;options:[string,string,string,string];correct_option_index:number;explanation:string;image_url?:string;audio_url?:string;formula_text?:string;point_value?:number;time_limit?:number|null};
type Quiz={title:string;subject:string;grade_level:string;description:string;language:"en"|"zh"|"ms";questions:Item[]};
const fresh=():Item=>({question:"",options:["","","",""],correct_option_index:0,explanation:"",image_url:"",audio_url:"",formula_text:"",point_value:100,time_limit:null});
const initial=():Quiz=>({title:"",subject:"Geography",grade_level:"Year 7",language:"en",description:"",questions:[fresh()]});
const AB=["A","B","C","D"];
export default function CreateQuiz(){
 const router=useRouter();
 const [mediaOpen,setMediaOpen]=useState<number|null>(null),[mathOpen,setMathOpen]=useState<number|null>(null);
 const [quiz,setQuiz]=useState<Quiz>(initial),[id,setId]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(true),[status,setStatus]=useState("draft");
 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  if(params.get("source")==="ai"){
   const transfer=sessionStorage.getItem("zokivo-ai-quiz-import-v1");
   const imported=transfer?parseSuggestedQuiz(transfer):null;
   if(imported){
    setQuiz(imported);
    sessionStorage.removeItem("zokivo-ai-quiz-import-v1");
    setMessage("AI suggestions imported for your review. Verify each answer before saving your private draft.");
   }else setError("No valid AI quiz JSON was found. Ask ZoKivo AI to generate a structured quiz.");
   setLoading(false);
   return;
  }
  const edit=params.get("edit");
  if(!edit){setLoading(false);return}
  void fetch("/api/quizzes/"+encodeURIComponent(edit),{cache:"no-store"}).then(async r=>{
   const j=await r.json();if(!r.ok)throw Error(j.error||"Cannot load quiz");
   if(!j.quiz.editable)throw Error("Only your own unpublished drafts can be edited.");
   setId(j.quiz.id);setStatus(j.quiz.status);
   setQuiz({title:j.quiz.title,subject:j.quiz.subject,grade_level:j.quiz.grade_level,
    language:j.quiz.language,description:j.quiz.description,
    questions:j.quiz.questions.map((q:Item)=>({question:q.question,options:q.options,correct_option_index:q.correct_option_index,explanation:q.explanation,image_url:q.image_url||"",audio_url:q.audio_url||"",formula_text:q.formula_text||"",point_value:q.point_value??100,time_limit:q.time_limit??null}))});
  }).catch(e=>setError(e instanceof Error?e.message:"Unable to load quiz")).finally(()=>setLoading(false));
 },[]);
 function updateMeta(key:keyof Omit<Quiz,"questions">,value:string){setQuiz(q=>({...q,[key]:value}))}
 function questionChange(index:number,patch:Partial<Item>){setQuiz(q=>({...q,questions:q.questions.map((x,i)=>i===index?{...x,...patch}:x)}))}
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
  if(!window.confirm("Publish this quiz for hosting? Teacher mode is required; publication makes the quiz visible to other users."))return;
  setError("");setSaving(true);
  try{
   const r=await fetch("/api/quizzes/"+id+"/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirm:true})});
   const j=await r.json();if(!r.ok)throw Error(j.error||"Publication failed");
   setStatus("published");router.push("/library");
  }catch(e){setError(e instanceof Error?e.message:"Publication failed")}finally{setSaving(false)}
 }
 return <main className="quiz-workspace zk-creator-studio wrap">
  <nav className="quiz-breadcrumb"><Link href="/library">← Quiz library</Link><span>/ Create &amp; edit</span></nav>
  <div className="quiz-title-row"><div><span className="eyebrow eyebrow--mini">ZOKIVO CREATOR STUDIO</span><h1>Make your next <em>great quiz.</em></h1><p>Start with a title, add questions one at a time, and choose the right answers.</p></div><span className="quiz-chip">✦ {status.toUpperCase()}</span></div>
  {loading?<p>Loading your draft...</p>:<>
   <section className="quiz-work-card">
    <div className="zk-creator-section"><span>1</span><h2>About your quiz</h2></div><div className="quiz-input-grid">
     <label>Quiz title<input value={quiz.title} maxLength={140} placeholder="e.g. Polar Worlds Challenge" onChange={e=>updateMeta("title",e.target.value)}/></label>
     <label>Subject<input value={quiz.subject} maxLength={80} placeholder="e.g. Geography" onChange={e=>updateMeta("subject",e.target.value)}/></label>
     <label>Grade / age band<input value={quiz.grade_level} maxLength={40} onChange={e=>updateMeta("grade_level",e.target.value)}/></label>
     <label>Language<select value={quiz.language} onChange={e=>updateMeta("language",e.target.value)}><option value="en">English</option><option value="zh">简体中文</option><option value="ms">Bahasa Melayu</option></select></label>
    </div><label className="quiz-field-wide">Description<textarea rows={2} maxLength={600} value={quiz.description} placeholder="A quick overview of what students will practice." onChange={e=>updateMeta("description",e.target.value)}/></label>
   </section>
   <div className="quiz-question-heading"><h2>2 · Your questions <span>{quiz.questions.length}/40</span></h2><button type="button" disabled={quiz.questions.length>=40||status!=="draft"} onClick={()=>setQuiz(q=>({...q,questions:[...q.questions,fresh()]}))}>+ Add question</button></div>
   {quiz.questions.map((q,index)=><details className="quiz-question-editor zk-single-question" key={index} open={index===0}><summary className="zk-editor-summary"><span>Question {String(index+1).padStart(2,"0")}</span><strong>{q.question.trim()||"Tap to write a question"}</strong><span className="zk-editor-summary-arrow">Edit <span aria-hidden="true">⌄</span></span></summary><div className="zk-editor-body">
    <div className="quiz-editor-head"><strong>Multiple choice · Question {index+1}</strong><button type="button" disabled={quiz.questions.length<=1||status!=="draft"} onClick={()=>setQuiz(v=>({...v,questions:v.questions.filter((_,i)=>i!==index)}))}>Remove</button></div>
    <label className="quiz-field-wide zk-question-prompt">Your question<textarea disabled={status!=="draft"} rows={3} value={q.question} maxLength={750} placeholder="Type your question here…" onChange={e=>questionChange(index,{question:e.target.value})}/></label>
    <div className="zk-question-helpers"><button type="button" aria-expanded={mediaOpen===index} onClick={()=>setMediaOpen(mediaOpen===index?null:index)}>▧ Image &amp; audio {mediaOpen===index?"−":"+"}</button><button type="button" aria-expanded={mathOpen===index} onClick={()=>setMathOpen(mathOpen===index?null:index)}>∑ Math &amp; symbols {mathOpen===index?"−":"+"}</button></div>
 <div className={"quiz-media-editor zk-editor-advanced"+(mediaOpen===index||mathOpen===index?" is-expanded":"")}>
 <label className={mediaOpen===index?"":"zk-helper-hidden"}>Image URL (HTTPS)<input disabled={status!=="draft"} type="url" value={q.image_url||""} placeholder="https://example.com/image.png" maxLength={1024} onChange={e=>questionChange(index,{image_url:e.target.value})}/></label>
 <label className={mediaOpen===index?"":"zk-helper-hidden"}>Audio URL (HTTPS)<input disabled={status!=="draft"} type="url" value={q.audio_url||""} placeholder="https://example.com/audio.mp3" maxLength={1024} onChange={e=>questionChange(index,{audio_url:e.target.value})}/></label>
 <label className={mathOpen===index?"":"zk-helper-hidden"}>Math expression<input disabled={status!=="draft"} value={q.formula_text||""} placeholder="\\frac{a}{b} + x^{2}" maxLength={240} onChange={e=>questionChange(index,{formula_text:e.target.value})}/></label>
 <label>Points per correct answer<select disabled={status!=="draft"} value={q.point_value??100} onChange={e=>questionChange(index,{point_value:Number(e.target.value)})}>{Array.from({length:19},(_,i)=>50+i*25).map(n=><option key={n} value={n}>{n} points</option>)}</select></label>
 <label>Question time limit<select disabled={status!=="draft"} value={q.time_limit??""} onChange={e=>questionChange(index,{time_limit:e.target.value===""?null:Number(e.target.value)})}><option value="">Use host timer</option>{[10,15,20,30,45,60].map(n=><option key={n} value={n}>{n} seconds</option>)}</select></label>
 {mathOpen===index&&<div className="zk-math-keys">{[["×","\\times"],["÷","\\div"],["π","\\pi"],["√","\\sqrt{x}"],["a/b","\\frac{a}{b}"],["x²","x^{2}"],["≤","\\leq"],["≥","\\geq"],["≠","\\neq"],["∞","\\infty"]].map(([symbol,notation])=><button type="button" key={symbol} title={"Insert "+symbol} disabled={status!=="draft"} onClick={()=>questionChange(index,{formula_text:(q.formula_text||"")+notation})}>{symbol}</button>)}</div>}
 </div>
 <QuestionMedia imageUrl={q.image_url} audioUrl={q.audio_url} formula={q.formula_text}/>
 <div className="zk-correct-instruction"><h3>Choose the correct answer</h3><p>Enter four different options and tap the correct one. Students will not see your answer key during the round.</p></div><div className="quiz-choice-grid zk-creator-answer-grid">{AB.map((letter,i)=><div className={"zk-creator-answer zk-creator-answer-"+i+(q.correct_option_index===i?" is-correct":"")} key={letter}><div className="zk-creator-answer-head"><strong>{letter}</strong><button type="button" disabled={status!=="draft"} aria-pressed={q.correct_option_index===i} aria-label={"Mark answer "+letter+" correct"} onClick={()=>questionChange(index,{correct_option_index:i})}>{q.correct_option_index===i?"✓ Correct":"○ Mark correct"}</button></div><textarea rows={2} aria-label={"Answer "+letter} disabled={status!=="draft"} value={q.options[i]} maxLength={250} placeholder={"Answer "+letter} onChange={e=>questionChange(index,{options:q.options.map((v,j)=>j===i?e.target.value:v) as Item["options"]})}/></div>)}</div>
    <div className="quiz-editor-bottom"><label>Correct answer<select disabled={status!=="draft"} value={q.correct_option_index} onChange={e=>questionChange(index,{correct_option_index:Number(e.target.value)})}>{AB.map((l,i)=><option value={i} key={i}>{l}</option>)}</select></label><label>Explanation (shown after round)<input disabled={status!=="draft"} value={q.explanation} maxLength={800} placeholder="Explain the correct answer…" onChange={e=>questionChange(index,{explanation:e.target.value})}/></label></div>
<div className="zk-edit-done"><span>{q.options.every(x=>x.trim())?"✓ Four answers entered":"Fill in all four answers before saving"}</span><button type="button" onClick={e=>e.currentTarget.closest("details")?.removeAttribute("open")}>Done editing ✓</button></div></div></details>)}
   {error&&<p role="alert" className="form-error">{error}</p>}{message&&<p role="status" className="quiz-success">{message}</p>}
   <div className="quiz-toolbar"><button type="button" className="button button-dark" disabled={saving||status!=="draft"} onClick={()=>void save()}>{saving?"Please wait…":"Save draft ↗"}</button><button type="button" className="button button-yellow" disabled={saving||!id||status!=="draft"} onClick={()=>void publish()}>Publish for games ✓</button><Link className="button button-outline" href="/library">Back to library</Link></div>
   <p className="quiz-footnote">Answers stay private in your draft. Publishing requires a signed-in account in Teacher mode (or an independently verified educator). Only the owner can publish their draft; AI-generated claims cannot change account permissions.</p>
  </>}
 </main>;
}
