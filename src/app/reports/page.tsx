"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type Entry={pin:string;archive_id?:string;kind:"quiz"|"paper";created_at:string;status:string;game_mode:string;title:string;players:number;submissions:number;correct:number};
export default function Reports(){
 const [reports,setReports]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{void fetch("/api/reports",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Sign in to view your reports.");return j}).then(j=>setReports(j.reports||[])).catch(e=>setError(e instanceof Error?e.message:"Reports unavailable")).finally(()=>setLoading(false))},[]);
 return <main className="reports-page wrap"><nav className="quiz-breadcrumb"><Link href="/account">← Account</Link><span>/ Reports</span></nav>
  <header className="reports-heading"><span className="eyebrow eyebrow--mini">YOUR CLASSROOM DATA</span><h1>Every quiz. <em>Every insight.</em></h1><p>View historical game results and question-level performance. Reports are visible only to the original hosting account.</p><Link className="button button-yellow" href="/host">Host a new game →</Link></header>
  {loading?<p>Loading your room history…</p>:error?<p role="alert" className="form-error">{error} <Link href="/auth/login?next=/reports">Sign in →</Link></p>:!reports.length?<div className="reports-empty"><h2>No classroom reports yet.</h2><p>After hosting your first Quiz Party or Paper Mode session, it will appear here.</p></div>:<section className="reports-list" aria-label="Game history">{reports.map(r=><article className="reports-row" key={r.kind+(r.archive_id||r.pin)}><div><span className="eyebrow eyebrow--mini">{r.kind==="paper"?"PAPER MODE":r.game_mode.replaceAll("_"," ").toUpperCase()}</span><h2>{r.title}</h2><p>{new Date(r.created_at).toLocaleString()} · PIN {r.pin}</p></div>
   <div className="reports-metrics"><span>👥 {r.players} players</span><span>📝 {r.submissions} answers</span><span>🎯 {r.submissions?Math.round(r.correct/r.submissions*100):0}% correct</span></div>
   <div className="reports-action"><b>{r.status==="finished"?"FINISHED":r.status.toUpperCase()}</b>{r.status==="finished"?<Link className="button button-dark" href={"/reports/"+(r.archive_id||r.pin)+"?kind="+r.kind}>View report →</Link>:<span>Results unlock after the game ends</span>}</div>
  </article>)}</section>}
 </main>;
}
