const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const text=fs.readFileSync("src/lib/quizzes.ts","utf8");
const compiled=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
class AuthError extends Error{constructor(message,status=400){super(message);this.status=status}}
new Function("require","module","exports",compiled)((name)=>name==="@/lib/mother-auth"?{AuthError}:require(name),mod,mod.exports);
const q=mod.exports;let n=0;
function ok(b,msg){assert.ok(b,msg);n++}
function throws(f,msg){assert.throws(f,AuthError,msg);n++}
const normal={id:"id",user_metadata:{role:"teacher"},app_metadata:{}};
ok(!q.teacherApproved(normal),"User metadata is not a trusted teacher role");
ok(!q.teacherApproved({id:"id",app_metadata:{roles:["teacher"]}}),"Unscoped role cannot grant teacher role");
ok(q.teacherApproved({id:"id",app_metadata:{zokivo_role:"teacher"}}),"Trusted app metadata teacher role");
ok(q.teacherApproved({id:"id",app_metadata:{zokivo_roles:["zokivo_admin"]}}),"Trusted app metadata admin role");
const good={title:"Polar World Challenge",subject:"Geography",language:"en",grade_level:"Year 7",questions:[{question:"What animal lives in Antarctica?",options:["Krill","Camel","Lion","Lemur"],correct_option_index:0,explanation:"Krill is an Antarctic ecosystem species."}]};
const v=q.validateQuiz(good);
ok(v.questions.length===1&&v.questions[0].correct_option_index===0,"Valid quiz data normalized");
ok(JSON.parse(q.questionRows(v))[0].position===0,"Question positions set server-side");
throws(()=>q.validateQuiz({...good,questions:[]}),"Empty quiz rejected");
throws(()=>q.validateQuiz({...good,questions:Array.from({length:41},()=>good.questions[0])}),"41 questions rejected");
throws(()=>q.validateQuiz({...good,questions:[{...good.questions[0],options:["A","B","C"]}]}),"Less than 4 choices rejected");
throws(()=>q.validateQuiz({...good,questions:[{...good.questions[0],options:["A","a","B","C"]}]}),"Duplicate choices rejected");
throws(()=>q.validateQuiz({...good,questions:[{...good.questions[0],correct_option_index:4}]}),"Invalid answer index rejected");
throws(()=>q.validateQuiz({...good,language:"unknown"}),"Unsupported language rejected");
ok(q.isId("b91f4600-1000-4000-8000-000000000001"),"Valid UUID accepted");
ok(!q.isId("../../bad"),"Non-UUID rejected");
console.log("QUIZ_VALIDATION_TEST_PASS: "+n+" assertions; teacher authorization verified against app_metadata.");
