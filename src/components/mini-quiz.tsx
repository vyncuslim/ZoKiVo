"use client";
import { useState } from "react";
export function MiniQuiz() {
  const [answer,setAnswer] = useState<number | null>(null);
  const picks = ["Jupiter", "Mars", "Venus"];
  return (
    <section className="demo-quiz" aria-label="Interactive quiz preview">
      <div className="demo-top"><span className="demo-small-pill">QUESTION 01 / 04</span><span className="demo-live"><span className="demo-live-dot"/> QUICK PLAY</span></div>
      <p className="demo-label">A LITTLE WARM-UP</p>
      <h2>Which planet is known as the <em>Red Planet?</em></h2>
      <div className="demo-picks">{picks.map((item,index)=>(
        <button key={item} onClick={()=>setAnswer(index)} className={"demo-pick "+(answer===index?(index===1?"demo-pick--correct":"demo-pick--wrong"):"")} aria-pressed={answer===index}>
          <span className="pick-letter">{String.fromCharCode(65+index)}</span>{item}{answer===index&&<span className="pick-tick">{index===1?"✓":"×"}</span>}
        </button>
      ))}</div>
      <div className={"demo-response "+(answer===null?"demo-response--empty":"")} aria-live="polite">
        {answer===null ? "Choose an answer to give it a try." : answer===1 ? "NICE ONE!  +100 imaginary points ✦" : "Not quite! Try another answer."}
      </div>
    </section>
  );
}
