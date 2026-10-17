"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type Task={title:string;quizId:string;quizTitle:string;dueAt:string|null};
export default function AssignmentPage({params}:{params:Promise<{id:string}>}){
 const [task,setTask]=useState<Task|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let alive=true;void (async()=>{try{
  const {id}=await params;
  const res=await fetch("/api/assignments/"+encodeURIComponent(id),{cache:"no-store"});
  const j=await res.json();if(!res.ok)throw Error(j.error||"Assignment unavailable");
  if(alive)setTask(j.assignment);
 }catch(e){if(alive)setError(e instanceof Error?e.message:"Assignment unavailable")}finally{if(alive)setLoading(false)}})();
 return()=>{alive=false}},[params]);
 return <main className="quiz-workspace wrap"><nav className="quiz-breadcrumb"><Link href="/study">← Study</Link><span>/ Assignment</span></nav>
 <div className="quiz-work-card"><span className="eyebrow eyebrow--mini">ZOKIVO STUDY ASSIGNMENT</span>
 {loading?<p>Loading assignment…</p>:error?<p role="alert">{error}</p>:task?<>
  <h1>{task.title}</h1><p>Quiz: {task.quizTitle}</p>
  <p>Due: {task.dueAt?new Date(task.dueAt).toLocaleString():"No deadline"}</p>
  <p>Practice is saved in your own ZoKivo study history after sign-in. This link does not reveal other students' answers.</p>
  <Link className="button button-dark" href={"/study?quiz="+encodeURIComponent(task.quizId)}>Start assignment practice →</Link>
 </>:null}</div></main>
}
