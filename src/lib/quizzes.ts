import {NextRequest} from "next/server";
import {findUser,AuthError,type MotherUser} from "@/lib/mother-auth";
export type QuizItem={question:string;options:[string,string,string,string];correct_option_index:number;explanation:string};
export type QuizInput={title:string;subject:string;grade_level:string;language:"en"|"zh"|"ms";description:string;questions:QuizItem[]};
function stringField(x:unknown,max:number){return typeof x==="string"&&x.trim().length<=max?x.trim():""}
export function teacherApproved(user:MotherUser){
 const m=user.app_metadata||{};
 const roles=Array.isArray(m.zokivo_roles)?m.zokivo_roles:Array.isArray(m.roles)?m.roles:[];
 return m.zokivo_role==="teacher"||m.zokivo_role==="admin"||roles.includes("zokivo_teacher")||roles.includes("zokivo_admin");
}
export async function authUser(req:NextRequest){
 const result=await findUser(req);
 if(!result.user)throw new AuthError("Sign in to manage quizzes.",401);
 if(!result.user.email_confirmed_at)throw new AuthError("Confirm your email first.",403);
 return result;
}
export function validateQuiz(raw:unknown):QuizInput{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new AuthError("Invalid quiz data.");
 const obj=raw as Record<string,unknown>,title=stringField(obj.title,140),subject=stringField(obj.subject,80);
 if(title.length<3||subject.length<2)throw new AuthError("Enter a title and subject.");
 const language=obj.language;if(language!=="en"&&language!=="zh"&&language!=="ms")throw new AuthError("Choose a supported language.");
 if(!Array.isArray(obj.questions)||obj.questions.length<1||obj.questions.length>40)throw new AuthError("Quiz must contain between 1 and 40 questions.");
 const questions:QuizItem[]=obj.questions.map((item,i)=>{
  if(!item||typeof item!=="object")throw new AuthError("Invalid question "+(i+1));
  const q=item as Record<string,unknown>,question=stringField(q.question??q.question_text,750),opts=q.options??q.choices;
  if(question.length<4||!Array.isArray(opts)||opts.length!==4)throw new AuthError("Question "+(i+1)+" requires exactly four choices.");
  const answers=opts.map(x=>stringField(x,250));
  if(answers.some(x=>x.length===0)||new Set(answers.map(x=>x.toLowerCase())).size!==4)throw new AuthError("Question "+(i+1)+" requires four unique choices.");
  const answer=q.correct_option_index??q.correct_index;
  if(typeof answer!=="number"||!Number.isInteger(answer)||answer<0||answer>3)throw new AuthError("Question "+(i+1)+" needs a correct answer.");
  return {question,options:answers as [string,string,string,string],correct_option_index:answer,explanation:stringField(q.explanation,800)};
 });
 return {title,subject,language,grade_level:stringField(obj.grade_level,40)||"Mixed",description:stringField(obj.description,600),questions};
}
export function questionRows(q:QuizInput){
 return JSON.stringify(q.questions.map((entry,position)=>({position,question:entry.question,choices:entry.options,correct_index:entry.correct_option_index,explanation:entry.explanation})));
}
export function isId(id:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)}
