"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useParams,useSearchParams} from "next/navigation";
import {buildReportCsv} from "@/lib/report-csv";
type Player={nickname:string;score:number;answered:number;correct:number};
type Question={position:number;question:string;choices:string[];correct_index:number;explanation:string;submissions:number;correct:number;a:number;b:number;c:number;d:number};
type Data={room:{pin:string;kind:string;title:string;game_mode?:string};players:Player[];questions:Question[];rewards?:{action:string;events:number;earned:number}[]};
const letters=["A","B","C","D"];
export default function ReportDetail(){
 const {pin}=useParams<{pin:string}>(),kind=useSearchParams().get("kind")==="paper"?"paper":"quiz";
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;void fetch("/api/reports/"+pin+"?kind="+kind,{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Report not available");return j}).then(j=>{if(alive)setData(j)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Report cannot be loaded")}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[pin,kind]);
 const summary=data?.questions.reduce((a,q)=>({answers:a.answers+q.submissions,correct:a.correct+q.correct}),{answers:0,correct:0});
 function exportCsv(){
  if(!data)return;
  const csv=buildReportCsv({pin,status:"finished",
   players:data.players.map((p,i)=>({rank:i+1,nickname:p.nickname,score:p.score,answered:p.answered,correct:p.correct})),
   questions:data.questions.map(q=>({number:q.position+1,question:q.question,correctAnswer:q.choices[q.correct_index],submissions:q.submissions,correct:q.correct}))});
  const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="zokivo-report-"+pin+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <main className="reports-page wrap"><nav className="quiz-breadcrumb"><Link href="/reports">← All reports</Link><span>/ PIN {pin}</span></nav>
  {loading?<p>Loading your detailed report…</p>:error?<p role="alert" className="form-error">{error}</p>:data&&<>
  <div className="reports-heading"><span className="eyebrow eyebrow--mini">COMPLETED GAME REPORT</span><h1>{data.room.title}</h1><p>{data.room.kind==="paper"?"Paper Mode":"Quiz Party / "+(data.room.game_mode||"classic")}</p><button className="button button-yellow" type="button" onClick={exportCsv}>↓ Download CSV</button></div>
  <div className="reports-totals"><div><strong>{data.players.length}</strong><span>Players</span></div><div><strong>{data.questions.length}</strong><span>Questions</span></div><div><strong>{summary?.answers||0}</strong><span>Answers</span></div><div><strong>{summary?.answers?Math.round((summary.correct/summary.answers)*100):0}%</strong><span>Accuracy</span></div></div>
  <div className="reports-details"><section className="reports-analysis"><h2>Question-by-question analysis</h2>{data.questions.map(q=><article key={q.position} className="reports-question"><span className="eyebrow eyebrow--mini">QUESTION {q.position+1}</span><h3>{q.question}</h3><p>{q.correct}/{q.submissions} correct · {q.submissions?Math.round(q.correct/q.submissions*100):0}% accuracy</p>
  <div className="reports-answer-bars">{letters.map((letter,i)=>{const count=[q.a,q.b,q.c,q.d][i];return <div className={"reports-answer-row"+(i===q.correct_index?" is-correct":"")} key={i}><span>{letter}</span><label>{q.choices[i]}</label><div><i style={{width:(q.submissions?count/q.submissions*100:0)+"%"}}/></div><strong>{count}</strong></div>})}</div>
  {q.explanation&&<p className="reports-explanation">💡 {q.explanation}</p>}</article>)}</section>
   <aside className="reports-side"><h2>Player results</h2>{data.players.map((p,i)=><div key={i} className="reports-player"><strong>#{i+1} {p.nickname}</strong><span>{p.score} pts · {p.correct}/{p.answered} correct</span></div>)}
   {data.rewards?.length?<><h2>Game rewards</h2>{data.rewards.map(r=><div className="reports-player" key={r.action}><strong>{r.action}</strong><span>{r.events} events · {r.earned} virtual credits</span></div>)}</>:null}
   </aside></div></>}
 </main>;
}
