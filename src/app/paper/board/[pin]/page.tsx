"use client";
import {useParams} from "next/navigation";
import Link from "next/link";
import {useEffect,useState} from "react";
import {BrandMark} from "@/components/brand";
type Board={pin:string;status:"lobby"|"playing"|"finished";index:number;total:number;question:{question:string;choices:string[]}|null;submittedCount:number};
export default function PaperBoard(){
 const {pin}=useParams<{pin:string}>();const [board,setBoard]=useState<Board|null>(null),[error,setError]=useState("");
 useEffect(()=>{let on=true;const reload=async()=>{try{const r=await fetch("/api/paper/"+pin,{cache:"no-store"}),d=await r.json();if(!r.ok)throw Error(d.error||"Session unavailable");if(on){setBoard(d);setError("")}}catch(e){if(on)setError(e instanceof Error?e.message:"Unable to connect")}};void reload();const id=setInterval(()=>void reload(),1800);return()=>{on=false;clearInterval(id)}},[pin]);
 return <main className="paper-board"><header className="boardbar"><Link href="/paper" className="boardbar-brand"><BrandMark size={46}/> ZoKivo! <span>Paper Mode</span></Link><div className="boardbar-code">SESSION PIN <strong>{pin}</strong></div></header>
 {error&&<p className="board-error" role="alert">{error}</p>}
 {!board?<div className="board-wait">Connecting to classroom session…</div>:board.status==="lobby"?<section className="board-wait"><BrandMark size={180}/><span>GET THOSE Q-CARDS READY</span><h1>Waiting for the teacher!</h1><p>Keep your card handy. Rotate it so A, B, C or D points up.</p></section>:board.status==="finished"?<section className="board-wait"><BrandMark size={170}/><span>CLASS COMPLETE</span><h1>Great game, everyone!</h1><p>The teacher can view the scores on their device.</p></section>:<section className="paper-projected-question"><div className="projected-top"><span>QUESTION {String(board.index+1).padStart(2,"0")} / {String(board.total).padStart(2,"0")}</span><span>✳ HOLD UP YOUR PAPER ANSWER</span></div><h1>{board.question?.question}</h1><div className="projected-options">{(board.question?.choices||[]).map((choice,i)=><div className={"projected-option projected-option-"+i} key={i}><span>{["A","B","C","D"][i]}</span><strong>{choice}</strong></div>)}</div><p className="projected-bottom">Choose your answer · Rotate your card · Hold it up ✳</p></section>}
 </main>
}
