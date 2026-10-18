/* One-time and prebuild regression for self-service Teacher publication policy.
   Only mocks signed-in accounts and SQL. Never uses live credentials or publishes data. */
const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const {NextRequest}=require("next/server");
const load=(path,mocks={})=>{
 const code=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 new Function("require","module","exports",code)((name)=>mocks[name]??require(name),mod,mod.exports);
 return mod.exports;
};
const auth=load("src/lib/mother-auth.ts");
const uuid="b91f4600-1000-4000-8000-000000000001";
const owner="self-teacher-owner";
let actor=null,ownsQuiz=true,draft=true,mutationCount=0;
const quiz=load("src/lib/quizzes.ts",{"@/lib/mother-auth":{
 AuthError:auth.AuthError,findUser:async()=>({user:actor})
}});
const db=()=>async(strings,...values)=>{
 const statement=strings.join("?");
 assert.match(statement,/UPDATE quiz_sets SET status='published'/,"Publishing must update existing quiz");
 assert.match(statement,/owner_user_id=/,"SQL must enforce same quiz owner");
 assert.match(statement,/status='draft'/,"Only unpublished drafts may be published");
 assert.match(statement,/SELECT count\(\*\) FROM questions/,"Quiz must not be empty");
 mutationCount++;
 if(ownsQuiz&&draft&&values[0]===uuid&&values[1]===owner)return [{id:uuid,status:"published"}];
 return [];
};
const route=load("src/app/api/quizzes/[id]/publish/route.ts",{
 "@/lib/store":{db},"@/lib/quizzes":{authUser:quiz.authUser,isId:quiz.isId},
 "@/lib/mother-auth":auth
});
const teachers=[
 {id:owner,email_confirmed_at:"2026-01-01T00:00:00Z",user_metadata:{zokivo_view_role:"teacher"}},
 {id:owner,email_confirmed_at:"2026-01-01T00:00:00Z",user_metadata:{zokivo_view_role:"student"},app_metadata:{zokivo_role:"teacher"}}
];
const student={id:owner,email_confirmed_at:"2026-01-01T00:00:00Z",user_metadata:{zokivo_view_role:"student"}};
const unverified={id:owner,user_metadata:{zokivo_view_role:"teacher"}};
let checks=0;
async function test(label,user,expected,{confirm=true,origin="https://zokivo.vercel.app",quizId=uuid,owns=true,isDraft=true}={}){
 actor=user;ownsQuiz=owns;draft=isDraft;mutationCount=0;
 const req=new NextRequest("https://zokivo.vercel.app/api/quizzes/"+quizId+"/publish",{
  method:"POST",headers:{"Content-Type":"application/json",origin},
  body:JSON.stringify({confirm})
 });
 const res=await route.POST(req,{params:Promise.resolve({id:quizId})});
 const text=await res.text(),data=JSON.parse(text);
 assert.equal(res.status,expected,label+": "+text);
 if(expected===200){assert.equal(data.status,"published");assert.equal(mutationCount,1);}
 if(expected===403||expected===401||expected===400)assert.equal(mutationCount,0,label+" must reject before SQL");
 checks++;
 console.log("PUBLISH_POLICY_CASE="+JSON.stringify({name:label,status:res.status,pass:true}));
}
(async()=>{
 assert.equal(auth.chosenRole(teachers[0]),"teacher");
 assert.equal(auth.verifiedTeacher(teachers[0]),false,"Do not forge verified teacher identity");
 assert.equal(auth.canPublishQuizzes(teachers[0]),true,"Self-selected Teacher may publish");
 assert.equal(auth.canPublishQuizzes(student),false,"Student cannot publish");
 assert.equal(auth.canPublishQuizzes(teachers[1]),true,"Approved legacy educator continues publishing");
 assert.equal(auth.safeUser(teachers[0]).teacherVerified,false);
 assert.equal(auth.safeUser(teachers[0]).canPublishQuizzes,true);
 await test("self-selected teacher can publish own draft",teachers[0],200);
 await test("already verified teacher still allowed",teachers[1],200);
 await test("student mode without approval blocked",student,403);
 await test("unauthenticated user blocked",null,401);
 await test("teacher email unconfirmed blocked",unverified,403);
 await test("teacher cannot publish someone else draft",teachers[0],409,{owns:false});
 await test("teacher cannot republish existing quiz",teachers[0],409,{isDraft:false});
 await test("teacher must explicitly confirm",teachers[0],400,{confirm:false});
 await test("teacher cross-site POST blocked",teachers[0],403,{origin:"https://evil.example"});
 await test("invalid UUID blocked",teachers[0],400,{quizId:"not-an-id"});
 console.log("SELF_SERVICE_TEACHER_PUBLISH_TEST_PASS="+JSON.stringify({checks}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
