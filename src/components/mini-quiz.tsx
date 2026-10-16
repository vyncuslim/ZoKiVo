"use client";
import {useState} from "react";
export function MiniQuiz(){
 const [answer,setAnswer]=useState<number|null>(null);
 const picks=["Jupiter","Mars","Venus"];
 return <section className="demo-quiz" aria-label="One question practice quiz">
   <div className="demo-top"><span className="demo-small-pill">PRACTICE ROUND</span><span className="demo-live"><span className="demo-live-dot"/> JUST FOR FUN</span></div>
   <p className="demo-label">QUESTION 01 / 01</p>
   <h2>Which planet is known as the <em>Red Planet?</em></h2>
   <div className="demo-picks">{picks.map((choice,i)=><button key={choice} className={"demo-pick "+(answer===i?(i===1?"demo-pick--correct":"demo-pick--wrong"):"")} aria-pressed={answer===i} onClick={()=>setAnswer(i)}><span className="pick-letter">{String.fromCharCode(65+i)}</span>{choice}{answer===i&&<span className="pick-tick" aria-hidden="true">{i===1?"✓":"×"}</span>}</button>)}</div>
   <div className={"demo-response "+(answer===null?"demo-response--empty":"")} aria-live="polite">{answer===null?"Pick your answer above.":answer===1?"YOU GOT IT! Mars is called the Red Planet. ✦":"Good try! Mars is the Red Planet. Give it another go."}</div>
   {answer!==null&&<button type="button" className="demo-again" onClick={()=>setAnswer(null)}>↻ Try again</button>}
 </section>;
}
