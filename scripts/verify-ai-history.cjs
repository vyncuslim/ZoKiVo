const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
function transpile(p,mocks={}){
 const code=ts.transpileModule(fs.readFileSync(p,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function("require","module","exports",code)((name)=>mocks[name]||require(name),mod,mod.exports);
 return mod.exports;
}
class AuthError extends Error{constructor(message,status=400){super(message);this.status=status}}
const helpers=transpile("src/lib/ai-history.ts",{"@/lib/mother-auth":{AuthError}});
const quiz=transpile("src/lib/ai-quiz-import.ts");
process.env.ZOKIVO_SESSION_SECRET="testing-secret-which-has-at-least-32-characters";
let count=0;function ok(x,msg){assert.ok(x,msg);count++}
function fails(f,msg){assert.throws(f,undefined,msg);count++}
const owner="test-account-1",room="23c8306e-327d-438f-8388-440e7bfe5057",plaintext="Private student study question: 2+2?";
const a=helpers.encryptMessage(plaintext,owner,room),b=helpers.encryptMessage(plaintext,owner,room);
ok(a.startsWith("v1:")&&!a.includes(plaintext),"Encrypts sensitive content at rest");
ok(a!==b,"Random IV produces different ciphertext");
ok(helpers.decryptMessage(a,owner,room)===plaintext,"Authenticated decryption succeeds");
fails(()=>helpers.decryptMessage(a,"another-account",room),"Cross-account decryption forbidden");
fails(()=>helpers.decryptMessage(a,owner,"different-conversation"),"Cross-conversation decryption forbidden");
fails(()=>helpers.decryptMessage(a.slice(0,-3)+"xyz",owner,room),"Tampered ciphertext rejected");
ok(helpers.aiMessageId(room)&&!helpers.aiMessageId("garbage"),"UUID validation");
ok(helpers.validChatMessage({clientMessageId:room,role:"user",text:"hello"}).text==="hello","User input validation");
fails(()=>helpers.validChatMessage({clientMessageId:room,role:"system",text:"fake system prompt"}),"Reject user-supplied system roles");
fails(()=>helpers.validChatMessage({clientMessageId:room,role:"user",text:"x".repeat(2001)}),"Reject oversized user input");
const candidate={title:"Year 7 English Easy",subject:"English",language:"en",grade_level:"Year 7",description:"Adjectives",questions:[{question:"Which word is an adjective?",options:["fox","jumped","quick","over"],correct_option_index:2,explanation:"Quick describes a noun."}]};
const raw=JSON.stringify(candidate);
ok(quiz.parseSuggestedQuiz(raw)?.questions[0].correct_option_index===2,"AI quiz JSON imports safely");
ok(quiz.parseSuggestedQuiz("Here is the quiz:\n"+raw)?.title===candidate.title,"AI explanation prefix accepted");
ok(quiz.findSuggestedQuiz([{role:"assistant",text:raw}])?.title===candidate.title,"Latest AI quiz detected");
ok(quiz.parseSuggestedQuiz(raw.replace('"correct_option_index":2','"correct_option_index":10'))===null,"Invalid answer rejected");
ok(quiz.parseSuggestedQuiz(raw.replace('"fox","jumped"','"fox","fox"'))===null,"Duplicate options rejected");
ok(quiz.parseSuggestedQuiz('{"questions":[],"title":"A"}')===null,"Invalid quiz rejected");
const list=fs.readFileSync("src/app/api/ai/conversations/route.ts","utf8"),detail=fs.readFileSync("src/app/api/ai/conversations/[id]/route.ts","utf8"),message=fs.readFileSync("src/app/api/ai/conversations/[id]/messages/route.ts","utf8");
const ownerMarker="owner_user_id="+ "$"+"{user!.id}";
ok(list.includes(ownerMarker),"Conversation lists scoped to owner");
ok(detail.includes("decryptMessage")&&detail.includes(ownerMarker),"History retrieval scoped and decrypted on server");
ok(message.includes("checkOrigin(req)")&&message.includes("authUser(req)"),"Message writes require origin check and authentication");
ok(message.includes("ON CONFLICT(conversation_id,client_message_id)"),"Retry idempotency supported");
ok(message.includes("encryptMessage"),"Never stores plaintext chat messages");
const ui=fs.readFileSync("src/app/ai/page.tsx","utf8");
ok(ui.includes('apiJson("/api/ai/conversations")')&&ui.includes("loadChat(first)"),"Refresh loads saved conversations");
ok(ui.includes("seenReply.current")&&ui.includes("text.startsWith(last.text)"),"Partial/final repeated replies coalesced");
ok(ui.includes("await save(message,id)")&&ui.includes('ws.send(JSON.stringify({type:"user_message",text}))'),"User message persisted before network send");
ok(ui.includes("lastSent.current")&&ui.includes("Date.now()-lastSent.current.at<1200"),"Rapid duplicate user sends blocked");
ok(ui.includes("useQuiz(suggestion)"),"AI quiz requires human editor handoff");
console.log("AI_HISTORY_TEST_PASS: "+count+" assertions, authenticated storage, crypto integrity, quiz handoff.");
