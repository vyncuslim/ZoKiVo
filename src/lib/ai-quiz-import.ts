export type SuggestedQuestion={question:string;options:[string,string,string,string];correct_option_index:number;explanation:string};
export type SuggestedQuiz={title:string;subject:string;grade_level:string;language:"en"|"zh"|"ms";description:string;questions:SuggestedQuestion[]};
function isObj(x:unknown):x is Record<string,unknown>{return !!x&&typeof x==="object"&&!Array.isArray(x)}
function clean(s:unknown,n:number){return typeof s==="string"&&s.trim().length<=n?s.trim():""}
export function parseSuggestedQuiz(text:string):SuggestedQuiz|null{
 if(text.length>18000)return null;
 const start=text.indexOf("{"),end=text.lastIndexOf("}");
 const candidates=[start>=0&&end>start?text.slice(start,end+1):""].filter(Boolean);
 for(const candidate of candidates){
  try{
   const item:unknown=JSON.parse(candidate);
   if(!isObj(item))continue;
   const title=clean(item.title,140),subject=clean(item.subject,80);
   const grade_level=clean(item.grade_level,40)||"Mixed",description=clean(item.description,600);
   const language=item.language;
   if(title.length<3||subject.length<2||!["en","zh","ms"].includes(String(language)))continue;
   if(!Array.isArray(item.questions)||item.questions.length<1||item.questions.length>40)continue;
   const questions:SuggestedQuestion[]=[];
   for(const entry of item.questions){
    if(!isObj(entry))throw Error("Invalid question");
    const question=clean(entry.question??entry.question_text,750);
    const opts=entry.options;
    if(!Array.isArray(opts)||opts.length!==4)throw Error("Four answers required");
    const choices=opts.map(o=>clean(o,250));
    const answer=entry.correct_option_index;
    if(question.length<4||choices.some(c=>c.length===0)||new Set(choices.map(c=>c.toLowerCase())).size!==4||
      !Number.isInteger(answer)||typeof answer!=="number"||answer<0||answer>3)throw Error("Incorrect question structure");
    questions.push({question,options:choices as [string,string,string,string],correct_option_index:answer,explanation:clean(entry.explanation,800)});
   }
   return {title,subject,grade_level,language:language as SuggestedQuiz["language"],description,questions};
  }catch{continue}
 }
 return null;
}
export function findSuggestedQuiz(messages:{role:string;text:string}[]):SuggestedQuiz|null{
 for(let i=messages.length-1;i>=0;i--){
  if(messages[i].role!=="assistant")continue;
  const quiz=parseSuggestedQuiz(messages[i].text);
  if(quiz)return quiz;
 }
 return null;
}
