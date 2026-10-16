"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
type Message={role:"user"|"assistant"|"system";text:string};
export default function AIPage(){
 const [messages,setMessages]=useState<Message[]>([{role:"system",text:"ZoKivo AI text beta connects to your existing ElevenLabs Agent. Live game answers and database editing tools are disabled."}]);
 const [status,setStatus]=useState<"idle"|"connecting"|"ready"|"closed">("idle"),[error,setError]=useState(""),[draft,setDraft]=useState("");
 const socket=useRef<WebSocket|null>(null);
 useEffect(()=>()=>{socket.current?.close();socket.current=null},[]);
 async function connect(){
  if(status==="connecting"||status==="ready")return;
  setError("");setStatus("connecting");
  try{
   const r=await fetch("/api/ai/voice/session",{method:"POST",cache:"no-store"});
   const j=await r.json();if(!r.ok)throw Error(j.error||"Failed to connect AI session.");
   if(typeof j.signedUrl!=="string")throw Error("Invalid conversation session.");
   const ws=new WebSocket(j.signedUrl);socket.current=ws;
   ws.onopen=()=>{setStatus("ready");setMessages(v=>[...v,{role:"system",text:"Connected. Ask ZoKivo AI about learning or quiz ideas."}])};
   ws.onmessage=event=>{
    try{const data=JSON.parse(event.data);
     if(data.type==="agent_response"&&typeof data.agent_response_event?.agent_response==="string")setMessages(v=>[...v,{role:"assistant",text:data.agent_response_event.agent_response}]);
     if(data.type==="ping"&&data.ping_event?.event_id!==undefined)ws.send(JSON.stringify({type:"pong",event_id:data.ping_event.event_id}));
     if(data.type==="client_tool_call"&&data.client_tool_call?.tool_call_id){
      ws.send(JSON.stringify({type:"client_tool_result",tool_call_id:data.client_tool_call.tool_call_id,is_error:true,result:"This tool is not enabled in ZoKivo yet."}));
     }
    }catch{setError("An AI message could not be decoded.")}
   };
   ws.onerror=()=>setError("The AI connection failed. Agent publishing, permissions, or network access may need attention.");
   ws.onclose=()=>{socket.current=null;setStatus("closed")};
  }catch(e){setError(e instanceof Error?e.message:"Could not start AI session");setStatus("idle")}
 }
 function send(){
  const text=draft.trim();if(!text||text.length>2000||socket.current?.readyState!==WebSocket.OPEN)return;
  setMessages(v=>[...v,{role:"user",text}]);setDraft("");
  socket.current.send(JSON.stringify({type:"user_message",text}));
 }
 function disconnect(){socket.current?.close();socket.current=null;setStatus("closed")}
 return <main className="ai-page wrap">
  <nav className="quiz-breadcrumb"><Link href="/">← ZoKivo</Link><span>/ ZoKivo AI</span></nav>
  <header className="ai-header"><div><span className="eyebrow eyebrow--mini">POWERED BY VYNALTH AI + ELEVENLABS</span><h1>Meet <em>ZoKivo AI.</em></h1><p>Ask questions, explore a topic and plan quizzes with our multilingual learning companion.</p></div><div className="ai-status"><span>{status==="ready"?"● CONNECTED":status==="connecting"?"◌ CONNECTING":"○ PRIVATE BETA"}</span><strong>EN · 中文 · BM</strong></div></header>
  <div className="ai-layout"><section className="ai-chat-card">
    <div className="ai-toolbar"><h2>Learning chat</h2>{status==="ready"?<button type="button" onClick={disconnect}>End session</button>:<button type="button" disabled={status==="connecting"} onClick={()=>void connect()}>{status==="connecting"?"Connecting…":"Connect to ZoKivo AI"}</button>}</div>
    <div className="ai-messages" role="log" aria-live="polite">{messages.map((m,i)=><div key={i} className={"ai-message ai-message-"+m.role}>{m.role!=="system"&&<strong>{m.role==="user"?"You":"ZoKivo AI"}</strong>}<p>{m.text}</p></div>)}</div>
    <form className="ai-compose" onSubmit={e=>{e.preventDefault();send()}}><input type="text" aria-label="Message ZoKivo AI" placeholder="Ask about a topic or quiz idea…" maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} disabled={status!=="ready"}/><button disabled={status!=="ready"||!draft.trim()}>Send →</button></form>
    {error&&<p className="form-error" role="alert">{error}</p>}
   </section><aside className="ai-tasks"><span className="eyebrow eyebrow--mini">FOR TEACHERS</span><h2>Turn learning into play.</h2><p>Create classroom-ready quizzes in the ZoKivo Creator Studio. Every draft needs human review before publishing.</p><Link className="button button-yellow" href="/create">Open Quiz Creator →</Link><Link className="button button-outline" href="/library">My quiz library →</Link><div className="ai-beta-note">🔒 This private beta never sends live answer keys, student records, or account credentials to the AI Agent. Direct backend tools and voice streaming will remain disabled until individually authorized and tested.</div></aside>
  </div>
 </main>;
}
