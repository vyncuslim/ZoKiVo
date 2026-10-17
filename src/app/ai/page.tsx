"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {findSuggestedQuiz,parseSuggestedQuiz,type SuggestedQuiz} from "@/lib/ai-quiz-import";

type Message={id:string;role:"user"|"assistant";text:string};
type Conversation={id:string;title:string;updated_at:string};
type Status="idle"|"connecting"|"ready"|"closed";
const uuid=()=>crypto.randomUUID();
const urlFor=(id:string)=>"/api/ai/conversations/"+encodeURIComponent(id);
const tidy=(x:string)=>x.replace(/\[(?:warmly|excited|calmly|friendly|thoughtfully|cheerfully|curiously|laughs|smiles)\]\s*/gi,"").trim();
async function apiJson(input:string,init?:RequestInit){
 const r=await fetch(input,{...init,cache:"no-store",headers:{"Content-Type":"application/json",...init?.headers}});
 const v=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(v.error||"Unable to save or load your conversation.");
 return v;
}
export default function AIPage(){
 const [conversations,setConversations]=useState<Conversation[]>([]);
 const [active,setActive]=useState("");
 const [messages,setMessages]=useState<Message[]>([]);
 const [status,setStatus]=useState<Status>("idle"),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [draft,setDraft]=useState(""),[loading,setLoading]=useState(true),[working,setWorking]=useState(false);
 const [quizSubject,setQuizSubject]=useState("English"),[quizGrade,setQuizGrade]=useState("Year 7");
 const [quizLevel,setQuizLevel]=useState("5"),[quizCount,setQuizCount]=useState("4");
 const [quizLanguage,setQuizLanguage]=useState<"en"|"zh"|"ms">("en");
 const socket=useRef<WebSocket|null>(null),activeRef=useRef(""),messagesRef=useRef<Message[]>([]);
 const seenReply=useRef<{id:string;text:string;at:number}|null>(null);
 const lastSent=useRef<{text:string;at:number}|null>(null);
 const latestSession=useRef(0),bottom=useRef<HTMLDivElement>(null),sending=useRef(false);
 const queuedQuizPrompt=useRef<string|null>(null),awaitingQuiz=useRef(false),expectedQuizCount=useRef<number|null>(null);
 const setChat=(m:Message[]|((old:Message[])=>Message[]))=>{
  const next=typeof m==="function"?m(messagesRef.current):m;
  messagesRef.current=next;setMessages(next);
 };
 const stop=useCallback(()=>{
  const old=socket.current;socket.current=null;latestSession.current++;
  if(old)old.close(1000,"Session ended");
  setStatus("closed");
 },[]);
 const refreshList=useCallback(async()=>{
  const r=await apiJson("/api/ai/conversations");
  setConversations(r.conversations||[]);
  return r.conversations as Conversation[];
 },[]);
 const loadChat=useCallback(async(id:string)=>{
  stop();setError("");setNotice("");setLoading(true);
  try{
   const r=await apiJson(urlFor(id));
   const m=(r.messages||[]).map((x:Message)=>({id:x.id,role:x.role,text:x.text}));
   activeRef.current=id;setActive(id);setChat(m);seenReply.current=null;awaitingQuiz.current=false;queuedQuizPrompt.current=null;
   history.replaceState(null,"","/ai?conversation="+encodeURIComponent(id));
  }catch(e){setError(e instanceof Error?e.message:"Could not load saved chat")}
  finally{setLoading(false)}
 },[stop]);
 useEffect(()=>{
  let mounted=true;
  void (async()=>{
   try{
    const list=await refreshList();if(!mounted)return;
    const requested=new URLSearchParams(location.search).get("conversation");
    const first=requested&&list.some(x=>x.id===requested)?requested:list[0]?.id;
    if(first)await loadChat(first);else setLoading(false);
   }catch(e){if(mounted){setError(e instanceof Error?e.message:"Sign in to save your AI history.");setLoading(false)}}
  })();
  return()=>{mounted=false;socket.current?.close(1000,"Leaving page");socket.current=null};
 },[loadChat,refreshList]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth",block:"end"})},[messages.length,active]);
 async function createChat(){
  if(working)return;
  setWorking(true);setError("");stop();
  try{
   const r=await apiJson("/api/ai/conversations",{method:"POST"});
   const id=r.conversation.id as string;
   activeRef.current=id;setActive(id);setChat([]);setDraft("");setNotice("");awaitingQuiz.current=false;queuedQuizPrompt.current=null;
   history.replaceState(null,"","/ai?conversation="+encodeURIComponent(id));
   await refreshList();setLoading(false);
  }catch(e){setError(e instanceof Error?e.message:"Could not create a chat")}
  finally{setWorking(false)}
 }
 async function deleteChat(){
  const id=activeRef.current;
  if(!id||working||!confirm("Delete this saved conversation and every message permanently?"))return;
  setWorking(true);stop();setError("");
  try{
   await apiJson(urlFor(id),{method:"DELETE"});
   const remaining=await refreshList();
   if(remaining.length)await loadChat(remaining[0].id);
   else{activeRef.current="";setActive("");setChat([]);history.replaceState(null,"","/ai");setLoading(false)}
  }catch(e){setError(e instanceof Error?e.message:"Could not delete chat")}
  finally{setWorking(false)}
 }
 async function save(m:Message,chatId:string){
  await apiJson(urlFor(chatId)+"/messages",{method:"POST",body:JSON.stringify({clientMessageId:m.id,role:m.role,text:m.text})});
 }
 async function connect(){
  if(status==="connecting"||status==="ready"||working)return;
  let id=activeRef.current;
  if(!id){
   setWorking(true);
   try{
    const r=await apiJson("/api/ai/conversations",{method:"POST"});
    id=r.conversation.id;activeRef.current=id;setActive(id);await refreshList();
    history.replaceState(null,"","/ai?conversation="+encodeURIComponent(id));
   }catch(e){setError(e instanceof Error?e.message:"Unable to create a saved conversation.");setWorking(false);return}
   setWorking(false);
  }
  setError("");setNotice("");setStatus("connecting");
  const run=++latestSession.current;
  try{
   const j=await apiJson("/api/ai/voice/session",{method:"POST"});
   if(run!==latestSession.current)return;
   if(typeof j.signedUrl!=="string")throw Error("Invalid signed AI conversation.");
   const ws=new WebSocket(j.signedUrl);socket.current=ws;
   const conversationId=id;
   ws.onopen=()=>{
    if(run!==latestSession.current)return;
    setStatus("ready");
    setNotice("Connected. Saved messages remain available after refresh.");
    // Historical context is a hint, not guaranteed to restore provider-side state.
    const recent=messagesRef.current.slice(-8).map(m=>(m.role==="user"?"Student":"ZoKivo AI")+": "+m.text).join("\n").slice(-2800);
    if(recent)ws.send(JSON.stringify({type:"contextual_update",text:"Previous messages for conversational continuity only:\n"+recent}));
    const queued=queuedQuizPrompt.current;
    queuedQuizPrompt.current=null;
    if(queued)void send(queued);
   };
   ws.onmessage=event=>{
    if(run!==latestSession.current)return;
    try{
     const data=JSON.parse(event.data);
     if(data.type==="agent_response"){
      const text=tidy(data.agent_response_event?.agent_response||"");
      if(!text)return;
      if(awaitingQuiz.current){
       const proposed=parseSuggestedQuiz(text);
       if(proposed&&proposed.questions.length===expectedQuizCount.current){awaitingQuiz.current=false;setNotice("Quiz ready: "+proposed.questions.length+" questions. Review every answer in Creator before saving.");}
       else setNotice("The Agent replied without complete quiz JSON. Select Retry JSON below, or configure the ElevenLabs Agent's instructions.");
      }
      const last=seenReply.current,now=Date.now();
      // Final AI replies can repeat or extend an earlier partial response; replace rather than append.
      const prefix=last?Math.min(70,Math.max(20,Math.floor(last.text.length/2))):0;
      const sameTurn=!!last&&now-last.at<9000&&(text===last.text||text.startsWith(last.text)||last.text.startsWith(text)||(last.text.length>=40&&text.length>=last.text.length&&text.slice(0,prefix)===last.text.slice(0,prefix)));
      if(sameTurn&&last){
       const replacement={id:last.id,role:"assistant" as const,text:text.length>=last.text.length?text:last.text};
       seenReply.current={id:last.id,text:replacement.text,at:now};
       setChat(all=>all.map(m=>m.id===last.id?replacement:m));
       void save(replacement,conversationId).catch(()=>setNotice("Unable to save the latest AI reply. Please copy anything important."));
      }else{
       const answer={id:uuid(),role:"assistant" as const,text};
       seenReply.current={id:answer.id,text,at:now};
       setChat(all=>[...all,answer]);
       void save(answer,conversationId).then(()=>refreshList()).catch(()=>setNotice("AI reply appeared, but could not be saved. Please copy it before refreshing."));
      }
     }
     if(data.type==="ping"&&data.ping_event?.event_id!==undefined)ws.send(JSON.stringify({type:"pong",event_id:data.ping_event.event_id}));
     if(data.type==="client_tool_call"&&data.client_tool_call?.tool_call_id){
      const call=data.client_tool_call,toolId=call.tool_call_id;
      // Only this local, review-only tool is allowed. Never grant publishing privileges to AI.
      if(call.tool_name==="submit_quiz_draft"&&awaitingQuiz.current){
       const proposed=parseSuggestedQuiz(JSON.stringify(call.parameters??null));
       if(!proposed||proposed.questions.length!==expectedQuizCount.current){
        ws.send(JSON.stringify({type:"client_tool_result",tool_call_id:toolId,is_error:true,result:"Invalid quiz schema. Require title, subject, grade_level, language, description, 1-40 questions, four distinct options and a numeric correct_option_index (0-3)."}));
       }else{
        const record={id:uuid(),role:"assistant" as const,text:JSON.stringify(proposed)};
        // Persist reviewable data to the same authenticated/encrypted conversation.
        void save(record,conversationId).then(()=>{
         if(run!==latestSession.current)return;
         seenReply.current={id:record.id,text:record.text,at:Date.now()};
         setChat(all=>[...all,record]);
         awaitingQuiz.current=false;
         setNotice(proposed.questions.length+" validated questions are ready. Select Review in Creator; nothing has been published.");
         ws.send(JSON.stringify({type:"client_tool_result",tool_call_id:toolId,is_error:false,result:"Draft validated and saved for local human review only. The teacher will decide whether to save or publish."}));
        }).catch(()=>{
         ws.send(JSON.stringify({type:"client_tool_result",tool_call_id:toolId,is_error:true,result:"Unable to store the quiz draft. No draft was accepted."}));
         setError("AI drafted questions but the secure save failed. Retry quiz generation.");
        });
       }
      }else{
       ws.send(JSON.stringify({type:"client_tool_result",tool_call_id:toolId,is_error:true,result:"Tool not available. Only submit_quiz_draft is enabled during a user-requested quiz generation. Direct publishing or database access is prohibited."}));
      }
     }
    }catch{setError("One AI event could not be decoded.")}
   };
   ws.onerror=()=>setError("AI WebSocket disconnected. Your saved history is still available.");
   ws.onclose=()=>{if(run===latestSession.current){socket.current=null;setStatus("closed")}};
  }catch(e){if(run===latestSession.current){queuedQuizPrompt.current=null;setError(e instanceof Error?e.message:"Could not connect AI.");setStatus("idle")}}
 }
 async function send(textOverride?:string){
  const text=(textOverride||draft).trim(),ws=socket.current,id=activeRef.current;
  if(!text||text.length>2000||!id||sending.current||ws?.readyState!==WebSocket.OPEN)return;
  if(lastSent.current?.text===text&&Date.now()-lastSent.current.at<1200)return;
  sending.current=true;setWorking(true);setError("");seenReply.current=null;
  const message={id:uuid(),role:"user" as const,text};
  try{
   // Persist before sending. If saving fails, retain draft; do not falsely claim persistence.
   await save(message,id);
   if(socket.current!==ws||ws.readyState!==WebSocket.OPEN)throw Error("AI disconnected after saving your message. Reconnect to continue.");
   setChat(all=>[...all,message]);setDraft("");
   ws.send(JSON.stringify({type:"user_message",text}));
   lastSent.current={text,at:Date.now()};
   void refreshList();
  }catch(e){setError(e instanceof Error?e.message:"Message could not be sent.");setDraft(text)}
  finally{sending.current=false;setWorking(false)}
 }
 function buildQuizPrompt(){
  const subject=quizSubject.trim().slice(0,80)||"English";
  const grade=quizGrade.trim().slice(0,40)||"Year 7";
  const languageName={en:"English",zh:"Simplified Chinese",ms:"Bahasa Melayu"}[quizLanguage];
  return [
   "Create a COMPLETE classroom-ready quiz DATA EXPORT now. This is NOT a spoken lesson or an interactive single-question game.",
   "Subject: "+subject+". Grade: "+grade+". Difficulty: level "+quizLevel+" of 5. Language: "+languageName+". EXACT number of questions: "+quizCount+".",
   "You have all required details. Do NOT ask follow-up questions. Produce ALL questions in ONE response, not one at a time.",
   "Return ONLY valid JSON, no Markdown, narration, greetings, tool explanations or code fences.",
   'Strict JSON schema: {"title":"string","subject":"string","grade_level":"string","language":"'+quizLanguage+'","description":"string","questions":[{"question":"string","options":["string A","string B","string C","string D"],"correct_option_index":0,"explanation":"string"}]}',
   "Use exactly "+quizCount+" DISTINCT questions. Every question has four DISTINCT plausible options and exactly one verified correct answer. correct_option_index MUST be an integer 0, 1, 2 or 3. Include a concise explanation for each answer.",
   "Do not say you cannot save or lack tools. You only need to return JSON; a teacher can review it in Creator before saving."
  ].join("\n");
 }
 function requestQuiz(){
  const prompt=buildQuizPrompt();
  setError("");setNotice("Preparing a "+quizCount+"-question quiz with ZoKivo AI…");
  awaitingQuiz.current=true;expectedQuizCount.current=Number(quizCount);
  if(socket.current?.readyState===WebSocket.OPEN){void send(prompt);return;}
  queuedQuizPrompt.current=prompt;
  if(status!=="connecting")void connect();
 }
 function retryQuizJson(){
  const prompt="Your last response was not importable. Return the COMPLETE quiz as ONE valid JSON object, without Markdown, speech, follow-up questions, or tool disclaimers. Follow the exact structure and parameters in my previous request; include ALL requested questions and exactly four options plus numeric correct_option_index and explanation for each.";
  setError("");setNotice("Requesting structured JSON from ElevenLabs…");
  awaitingQuiz.current=true;expectedQuizCount.current=Number(quizCount);
  if(socket.current?.readyState===WebSocket.OPEN){void send(prompt);return;}
  queuedQuizPrompt.current=buildQuizPrompt();
  if(status!=="connecting")void connect();
 }
 function useQuiz(q:SuggestedQuiz){
  sessionStorage.setItem("zokivo-ai-quiz-import-v1",JSON.stringify(q));
  location.assign("/create?source=ai");
 }
 const suggestion=awaitingQuiz.current?null:findSuggestedQuiz(messages);
 return <main className="ai-page wrap">
  <nav className="quiz-breadcrumb"><Link href="/">← ZoKivo</Link><span>/ ZoKivo AI</span></nav>
  <header className="ai-header"><div><span className="eyebrow eyebrow--mini">POWERED BY VYNALTH AI + ELEVENLABS</span><h1>Meet <em>ZoKivo AI.</em></h1><p>Explore subjects, create quiz ideas and revisit your learning conversations.</p></div><div className="ai-status"><span>{status==="ready"?"● CONNECTED":status==="connecting"?"◌ CONNECTING":"○ DISCONNECTED"}</span><strong>EN · 中文 · BM</strong></div></header>
  <div className="ai-workspace">
   <aside className="ai-history"><div className="ai-history-top"><h2>Chats</h2><button type="button" onClick={()=>void createChat()} disabled={working}>+ New chat</button></div>
    <div className="ai-history-list">{conversations.length?conversations.map(c=><button type="button" key={c.id} className={"ai-history-item"+(active===c.id?" is-active":"")} disabled={working} onClick={()=>void loadChat(c.id)}><span>{c.title}</span><small>{new Date(c.updated_at).toLocaleDateString()}</small></button>):<p>New conversations will be saved to your account.</p>}</div>
    <p className="ai-history-privacy">🔒 Stored encrypted in ZoKivo Neon and accessible only after account verification.</p>
   </aside>
   <section className="ai-chat-card">
    <div className="ai-toolbar"><div><h2>Learning chat</h2><small>{messages.length} saved messages</small></div><div className="ai-chat-actions">{active&&<button type="button" className="ai-delete" disabled={working} onClick={()=>void deleteChat()}>Delete</button>}{status==="ready"?<button type="button" onClick={stop}>End session</button>:<button type="button" disabled={status==="connecting"||working||loading} onClick={()=>void connect()}>{status==="connecting"?"Connecting…":"Connect AI"}</button>}</div></div>
    <div className="ai-messages" role="log" aria-live="polite">{loading?<p className="ai-empty">Loading saved conversation…</p>:!messages.length?<div className="ai-start"><span className="ai-start-icon">✳</span><h3>Your ideas start here.</h3><p>Ask a question, revise a topic or request a quiz. Your messages are saved to your account, even if you refresh.</p><button type="button" onClick={requestQuiz} disabled={working||status==="connecting"}>✦ Generate a Year 7 quiz →</button></div>:messages.map(m=><div key={m.id} className={"ai-message ai-message-"+m.role}><strong>{m.role==="user"?"You":"ZoKivo AI"}</strong><p>{m.text}</p></div>)}<div ref={bottom}/></div>
    <form className="ai-compose" onSubmit={e=>{e.preventDefault();void send()}}><input aria-label="Message ZoKivo AI" placeholder={status==="ready"?"Ask a question or request a quiz…":"Connect AI to continue this chat…"} maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} disabled={working||loading}/><button type="submit" disabled={status!=="ready"||working||!draft.trim()}>Send →</button></form>
    {notice&&<p className="ai-notice" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error} {error.includes("Sign in")&&<Link href="/auth/login?next=/ai">Sign in →</Link>}</p>}
   </section>
   <aside className="ai-tasks"><span className="eyebrow eyebrow--mini">FOR TEACHERS & STUDENTS</span><h2>Turn learning into play.</h2><p>Generate question ideas with ZoKivo AI, then review and edit them before saving any quiz.</p>
    <div className="ai-generator">
     <label>Subject<input aria-label="Quiz subject" value={quizSubject} maxLength={80} onChange={e=>setQuizSubject(e.target.value)} placeholder="English, Science, Maths…" /></label>
     <label>Year / grade<input aria-label="Quiz grade" value={quizGrade} maxLength={40} onChange={e=>setQuizGrade(e.target.value)}/></label>
     <div className="ai-generator-grid">
      <label>Difficulty<select aria-label="Quiz difficulty" value={quizLevel} onChange={e=>setQuizLevel(e.target.value)}>{[1,2,3,4,5].map(n=><option key={n} value={n}>Level {n}</option>)}</select></label>
      <label>Questions<select aria-label="Quiz question count" value={quizCount} onChange={e=>setQuizCount(e.target.value)}>{[4,6,8,10].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
     </div>
     <label>Quiz language<select aria-label="Quiz language" value={quizLanguage} onChange={e=>setQuizLanguage(e.target.value as "en"|"zh"|"ms")}><option value="en">English</option><option value="zh">简体中文</option><option value="ms">Bahasa Melayu</option></select></label>
     <button type="button" className="button button-yellow" onClick={requestQuiz} disabled={working||status==="connecting"||loading||!quizSubject.trim()}>✦ Generate full quiz with AI →</button>
     {messages.some(m=>m.role==="assistant")&&!suggestion&&<button type="button" className="button button-outline" disabled={working||status==="connecting"} onClick={retryQuizJson}>Retry as structured JSON ↻</button>}
    </div>
    {suggestion?<button type="button" className="button button-dark" onClick={()=>useQuiz(suggestion)}>Review {suggestion.questions.length} AI questions in Creator →</button>:<p className="ai-quiz-hint">ZoKivo AI must reply with complete valid quiz JSON to unlock Creator import. If it gives a spoken question instead, use Retry as structured JSON. Teachers review and approve before publishing.</p>}
    <Link className="button button-outline" href="/create">Open Quiz Creator →</Link><Link className="button button-outline" href="/library">My quiz library →</Link>
    <div className="ai-beta-note">🔒 Only account-authenticated history is saved in Neon. ElevenLabs processes messages you send to its Agent separately. Direct tools, live answer keys and automatic publication remain disabled.</div>
   </aside>
  </div>
 </main>;
}
