"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {avatarSymbol} from "@/lib/avatars";

type Player={id:string;nickname:string;score:number;avatar_id:string;mode_score?:number};
type GameSnapshot={gameMode?:string;total:number;players:Player[];viewer:{host:boolean;playerId:string|null}};
type Review={number:number;question:string;yourAnswer:string;correctAnswer:string;correct:boolean;points:number;explanation:string};
type InsightPlayer={id:string;rank:number;nickname:string;avatarId:string;score:number;answered:number;correct:number;wrong:number};
type Question={number:number;question:string;correctAnswer:string;explanation:string;submissions:number;correct:number;wrong:number;choices:string[];choiceCounts:number[]};
type HostData={scope:"host";title:string;metrics:{players:number;questions:number;submissions:number;correct:number;wrong:number;accuracy:number};players:InsightPlayer[];questions:Question[]};
type PlayerData={scope:"player";title:string;player:{nickname:string;avatarId:string;score:number;answered:number;correct:number;wrong:number};review:Review[]};
type Insight=HostData|PlayerData;
type Detail={scope:"host-student";student:InsightPlayer;review:Review[]};
type Filter="all"|"wrong"|"correct";

const percent=(correct:number,total:number)=>total>0?Math.round(correct/total*100):0;
const scoreOf=(player:Player,mode?:string)=>mode&&mode!=="quiz_party"?(player.mode_score??0):player.score;
function NumberRing({value,small=false}:{value:number;small?:boolean}){
 const safe=Math.max(0,Math.min(100,value));
 return <span role="img" aria-label={safe+" percent correct"} className={"zk-result-ring"+(small?" zk-result-ring-small":"")} style={{background:`conic-gradient(#37bc73 ${safe}%, #e85b6c ${safe}% 100%)`}}>
  <span><strong>{safe}%</strong>{!small&&<small>Correct</small>}</span>
 </span>;
}
function ReviewList({items}:{items:Review[]}){
 const [filter,setFilter]=useState<Filter>("all");
 const filtered=items.filter(item=>filter==="all"||(filter==="correct"?item.correct:!item.correct));
 return <div className="zk-review-list">
  <div className="zk-result-filters" role="group" aria-label="Filter answer results">
   {(["all","wrong","correct"] as const).map(f=><button key={f} type="button" className={filter===f?"is-active":""} aria-pressed={filter===f} onClick={()=>setFilter(f)}>
    {f==="all"?"All answers":f==="wrong"?"Incorrect only":"Correct only"} <b>{f==="all"?items.length:f==="wrong"?items.filter(x=>!x.correct).length:items.filter(x=>x.correct).length}</b>
   </button>)}
  </div>
  {filtered.length?<div className="zk-review-rows">
   {filtered.map(item=><details key={item.number} className={"zk-review-item "+(item.correct?"zk-review-ok":"zk-review-no")}>
    <summary><span className="zk-review-number">Q{item.number}</span><span className="zk-review-question">{item.question}</span>
     <span className={"zk-result-pill "+(item.correct?"zk-pill-good":"zk-pill-bad")}>{item.correct?"✓ Correct":"✕ Incorrect"}</span><span className="zk-review-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="zk-review-body"><div><small>Your answer</small><strong>{item.yourAnswer||"Not recorded"}</strong></div>
     <div><small>Correct answer</small><strong>{item.correctAnswer||"Unavailable"}</strong></div>
     <div><small>Points earned</small><strong>{item.points}</strong></div>
    </div>
    {item.explanation?<p className="zk-result-explanation">💡 {item.explanation}</p>:<p className="zk-result-explanation">Compare your answer with the correct answer to learn from this question.</p>}
   </details>)}</div>:<p className="zk-result-empty">No questions match this filter.</p>}
 </div>;
}
function PrivacyCard({host}:{host:boolean}){
 return <section className="zk-finish-card zk-result-policy" aria-label="Results access policy">
  <div className="zk-result-section-heading"><span className="zk-result-section-icon">🛡️</span><h2>{host?"Teacher results policy":"Answer review policy"}</h2></div>
  <p>{host?"Results are available only after the game ends.":"Your detailed answers unlock when the game ends."}</p>
  <ul>
   <li>Students can review only their own submitted answers.</li>
   <li>Only the original signed-in host can access class and individual reports.</li>
   <li>Use and share exported results according to your school&apos;s privacy rules.</li>
  </ul>
  <p className="zk-policy-note">Results are for learning feedback, not a public student ranking archive. Do not share game tokens or private reports.</p>
 </section>;
}
function WinnerCard({players,mode,host,onDownload,downloading}:{players:Player[];mode?:string;host:boolean;onDownload:()=>void;downloading:boolean}){
 const top=[...players].sort((a,b)=>scoreOf(b,mode)-scoreOf(a,mode)).slice(0,3);
 return <section className="zk-finish-card zk-winners" aria-label="Final standings">
  <div className="zk-result-kicker">🏆 GAME COMPLETE</div>
  <h2>{host?"Final standings":"The winners"}</h2>
  <p>Thanks for playing! Here are the top ZoKivo players.</p>
  {top.length?<div className="zk-winner-podium">{top.map((p,i)=><div className={"zk-winner zk-winner-"+(i+1)} key={p.id}>
   <span className="zk-winner-medal">{["🥇","🥈","🥉"][i]}</span><span className="zk-winner-avatar" aria-hidden="true">{avatarSymbol(p.avatar_id)}</span>
   <strong>{p.nickname}</strong><b>{scoreOf(p,mode).toLocaleString()} {mode&&mode!=="quiz_party"?"✦":"pts"}</b>
  </div>)}</div>:<p className="zk-result-empty">No players finished this game.</p>}
  <div className="zk-result-actions">{host?<Link href="/host" className="button button-dark">Host another game →</Link>:<Link href="/play" className="button button-dark">Play again →</Link>}
   {host&&<button className="button button-outline" disabled={downloading} onClick={onDownload} type="button">{downloading?"Preparing CSV…":"↓ Download results CSV"}</button>}
  </div>
 </section>;
}
export function FinishedResults({pin,host,state,getHeaders,onDownload,downloading}:{pin:string;host:boolean;state:GameSnapshot;getHeaders:()=>Record<string,string>;onDownload:()=>void;downloading:boolean}){
 const [insights,setInsights]=useState<Insight|null>(null);
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
 const [selectedId,setSelectedId]=useState<string|null>(null),[detail,setDetail]=useState<Detail|null>(null),[detailError,setDetailError]=useState(""),[detailLoading,setDetailLoading]=useState(false);
 const [questionFilter,setQuestionFilter]=useState<"all"|"missed">("missed");
 const [showAllPlayers,setShowAllPlayers]=useState(false);
 useEffect(()=>{
  let alive=true;
  setLoading(true);setLoadError("");
  void fetch("/api/rooms/"+pin+"/insights",{headers:getHeaders(),cache:"no-store"})
   .then(async res=>{const data=await res.json();if(!res.ok)throw Error(data.error||"Results are unavailable");return data as Insight})
   .then(data=>{if(alive){if(data.scope===(host?"host":"player"))setInsights(data);else setLoadError("Result access could not be verified.")}})
   .catch(e=>{if(alive)setLoadError(e instanceof Error?e.message:"Results are temporarily unavailable.")})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[pin,host,getHeaders]);
 async function selectStudent(id:string){
  if(selectedId===id){setSelectedId(null);setDetail(null);return}
  setSelectedId(id);setDetail(null);setDetailLoading(true);setDetailError("");
  try{
   const response=await fetch("/api/rooms/"+pin+"/insights?player="+encodeURIComponent(id),{headers:getHeaders(),cache:"no-store"});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Student report unavailable");
   if(data.scope!=="host-student")throw Error("Student report access denied");
   setDetail(data as Detail);
  }catch(e){setDetailError(e instanceof Error?e.message:"Student details are unavailable.")}
  finally{setDetailLoading(false)}
 }
 const ranked=[...state.players].sort((a,b)=>scoreOf(b,state.gameMode)-scoreOf(a,state.gameMode));
 const myPlace=state.viewer.playerId?ranked.findIndex(p=>p.id===state.viewer.playerId)+1:0;
 const hostData=insights?.scope==="host"?insights:null;
 const playerData=insights?.scope==="player"?insights:null;
 const displayedQuestions=hostData?.questions.filter(q=>questionFilter==="all"||q.wrong>0).sort((a,b)=>questionFilter==="missed"?b.wrong-a.wrong:a.number-b.number)||[];
 const displayedPlayers=showAllPlayers?ranked:ranked.slice(0,8);
 const me=ranked.find(p=>p.id===state.viewer.playerId);
 return <div className="zk-finish-screen">
  <header className="zk-finish-hero">
   <div><span className="eyebrow eyebrow--mini">{host?"TEACHER SCREEN":"STUDENT SCREEN"} · GAME COMPLETE</span>
    <h1>{host?"Game finished!":"Great work! 🎉"}</h1>
    <p>{host?"Here’s how your class performed. All statistics come from recorded answers.":"You finished the game. Review what you learned and celebrate your progress."}</p>
   </div>
   <div className="zk-finish-pin"><span>GAME PIN · COPY</span><button title="Copy game PIN" type="button" onClick={()=>void navigator.clipboard?.writeText(pin)}>{pin} ⧉</button></div>
  </header>
  <div className="zk-finish-top">
   <WinnerCard players={state.players} mode={state.gameMode} host={host} onDownload={onDownload} downloading={downloading}/>
   <section className="zk-finish-card zk-performance" aria-label={host?"Class performance":"Your performance"}>
    <div className="zk-result-section-heading"><span className="zk-result-section-icon">📊</span><h2>{host?"Class performance":"Your performance"}</h2></div>
    {loading?<p className="zk-result-empty" role="status">Loading verified results…</p>:hostData?
    <><div className="zk-result-overview"><NumberRing value={hostData.metrics.accuracy}/><div className="zk-result-metric-grid">
     <div><small>✓ Correct answers</small><strong>{hostData.metrics.correct}</strong></div><div><small>✕ Incorrect answers</small><strong>{hostData.metrics.wrong}</strong></div>
     <div><small>Questions</small><strong>{hostData.metrics.questions}</strong></div><div><small>Recorded responses</small><strong>{hostData.metrics.submissions}</strong></div>
    </div></div><p className="zk-result-caption">Accuracy is based on submitted answers, not unanswered questions.</p></>:playerData?
    <><div className="zk-result-overview"><NumberRing value={percent(playerData.player.correct,playerData.player.answered)}/><div className="zk-result-metric-grid">
     <div><small>✓ Correct answers</small><strong>{playerData.player.correct}</strong></div><div><small>✕ Incorrect answers</small><strong>{playerData.player.wrong}</strong></div>
     <div><small>Answered</small><strong>{playerData.player.answered} / {state.total}</strong></div><div><small>Class rank</small><strong>{myPlace?("#"+myPlace):"—"}</strong></div>
    </div></div><p className="zk-result-caption">Your score: {scoreOf(me||{id:"",nickname:"",score:0,avatar_id:""},state.gameMode).toLocaleString()} {state.gameMode&&state.gameMode!=="quiz_party"?"✦":"points"}. Rankings follow the game mode.</p></>:
    <div className="zk-result-empty" role="status"><strong>Detailed results unavailable</strong><p>{loadError||"The server could not return an authorized results report."}</p><button type="button" className="button button-outline" onClick={()=>window.location.reload()}>Retry</button></div>}
   </section>
   <PrivacyCard host={host}/>
  </div>
  {host?<div className="zk-finish-lower">
   <section className="zk-finish-card zk-finish-leaderboard" aria-label="Final leaderboard">
    <div className="zk-result-section-heading"><span className="zk-result-section-icon">🏅</span><div><h2>Leaderboard</h2><p>Scores, accuracy and completion from the completed game.</p></div></div>
    <div className="zk-finish-table-wrap"><table className="zk-finish-table"><thead><tr><th>Rank</th><th>Student</th><th>Accuracy</th><th>Correct / Wrong</th><th>Completion</th><th>Review</th></tr></thead>
     <tbody>{displayedPlayers.map((p,i)=>{
      const data=hostData?.players.find(a=>a.id===p.id);
      const correct=data?.correct??0,wrong=data?.wrong??0,answered=data?.answered??0;
      return <tr key={p.id}><td className="zk-rank-cell">{i<3?["🥇","🥈","🥉"][i]:"#"+(i+1)}</td>
       <td><span className="zk-table-avatar" aria-hidden="true">{avatarSymbol(p.avatar_id)}</span><strong>{p.nickname}</strong><small>{scoreOf(p,state.gameMode).toLocaleString()} {state.gameMode&&state.gameMode!=="quiz_party"?"✦":"pts"}</small></td>
       <td>{data?<NumberRing value={percent(correct,answered)} small/>:<span className="zk-placeholder-stat">—</span>}</td>
       <td>{data?<div className="zk-count-bar" aria-label={correct+" correct, "+wrong+" wrong"}><span style={{width:(answered?correct/answered*100:0)+"%"}}/><b>✓ {correct} / ✕ {wrong}</b></div>:"—"}</td>
       <td>{data?<span className="zk-result-pill">{answered}/{state.total}</span>:"—"}</td>
       <td>{data?<button type="button" className="zk-text-action" aria-expanded={selectedId===p.id} onClick={()=>void selectStudent(p.id)}>Details ↗</button>:"—"}</td>
      </tr>
     })}</tbody></table></div>
    {ranked.length>8&&<button className="zk-text-action zk-show-more" type="button" onClick={()=>setShowAllPlayers(!showAllPlayers)}>{showAllPlayers?"Show fewer students":"View all "+ranked.length+" students"} →</button>}
    {selectedId&&<div className="zk-student-insight"><div className="zk-result-section-heading"><h3>Student answer review</h3><button className="zk-text-action" onClick={()=>{setSelectedId(null);setDetail(null)}} type="button">Close ✕</button></div>
     {detailLoading?<p role="status">Loading the student’s answers…</p>:detailError?<p role="alert">{detailError}</p>:detail?<><p><strong>{detail.student.nickname}</strong> · {detail.student.correct} correct · {detail.student.wrong} wrong</p><ReviewList key={selectedId} items={detail.review}/></>:null}
    </div>}
   </section>
   <section className="zk-finish-card zk-question-insights" aria-label="Question analysis">
    <div className="zk-result-section-heading"><span className="zk-result-section-icon">📝</span><div><h2>Question review</h2><p>Understand which questions were challenging.</p></div></div>
    <div className="zk-result-filters" role="group" aria-label="Filter class questions"><button className={questionFilter==="missed"?"is-active":""} type="button" aria-pressed={questionFilter==="missed"} onClick={()=>setQuestionFilter("missed")}>Most missed</button><button type="button" className={questionFilter==="all"?"is-active":""} aria-pressed={questionFilter==="all"} onClick={()=>setQuestionFilter("all")}>All questions</button></div>
    {hostData?(displayedQuestions.length?<div className="zk-question-insights-list">{displayedQuestions.map(q=><details key={q.number} className="zk-question-insight">
     <summary><span className="zk-review-number">Q{q.number}</span><span className="zk-review-question">{q.question}</span><span className="zk-question-correct">{q.correct}/{q.submissions} correct</span><span className={"zk-result-pill "+(q.wrong?"zk-pill-bad":"zk-pill-good")}>{q.wrong?q.wrong+" incorrect":"All correct"}</span><span aria-hidden="true">⌄</span></summary>
     <div className="zk-question-insight-detail"><p><strong>Correct answer:</strong> {q.correctAnswer}</p>{q.explanation&&<p>💡 {q.explanation}</p>}
      <div className="zk-choice-results">{q.choices.map((choice,i)=><div key={i}><span>{["A","B","C","D"][i]} · {choice}</span><b>{q.choiceCounts[i]||0} answers</b></div>)}</div>
     </div>
    </details>)}</div>:<p className="zk-result-empty">No incorrect responses in this game. Try All questions to see the full review.</p>):<p className="zk-result-empty">Complete class question analytics are unavailable until the host’s identity is verified.</p>}
   </section>
  </div>:<div className="zk-finish-lower zk-player-results">
   <section className="zk-finish-card" aria-label="Your answer review">
    <div className="zk-result-section-heading"><span className="zk-result-section-icon">🔎</span><div><h2>Your answer review</h2><p>See which questions you got right and what to improve.</p></div></div>
    {playerData?<ReviewList items={playerData.review}/>:<p className="zk-result-empty">Detailed answers are available only through your valid player session after the game ends.</p>}
   </section>
   <section className="zk-finish-card zk-next-steps"><div className="zk-result-section-heading"><span className="zk-result-section-icon">💡</span><h2>What’s next?</h2></div>
    {playerData?.player.wrong?<><h3>Keep learning, one question at a time.</h3><p>You have {playerData.player.wrong} incorrect {playerData.player.wrong===1?"answer":"answers"} to review. Open each question to compare your answer with the correct one and read any teacher-provided explanation.</p>
     <a href="#review-policy" className="zk-next-note">Your results are private to your player session.</a></>:<><h3>Excellent effort! 🌟</h3><p>{playerData?"All your submitted answers were correct. Try another quiz to keep practising.":"Once your results load, you can review your answers here."}</p></>}
    <div className="zk-result-actions"><Link href="/play" className="button button-dark">Play again →</Link><Link href="/study" className="button button-outline">Study more ↗</Link><Link href="/account" className="button button-outline">My account ↗</Link></div>
   </section>
  </div>}
  <p className="zk-finish-footnote" id="review-policy">✳ PLAY NICE. THINK FAST. HAVE FUN. · Scores and answer reviews come from this completed game. No response-time statistics are shown unless the server records them.</p>
 </div>;
}
