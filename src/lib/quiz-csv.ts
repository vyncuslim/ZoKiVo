/** Client-side CSV import; imported items still undergo server-side quiz validation. */
export type ImportedQuestion={
 question:string;
 options:[string,string,string,string];
 correct_option_index:number;
 explanation:string;
};
export class CsvImportError extends Error{}
export function parseCsvRows(csv:string):string[][]{
 if(csv.charCodeAt(0)===0xfeff)csv=csv.slice(1);
 if(csv.length>1024*1024)throw new CsvImportError("CSV file exceeds the 1 MB limit.");
 const result:string[][]=[],row:string[]=[];let field="",quoted=false,closedQuote=false;
 const endField=()=>{row.push(field.trim());field="";closedQuote=false};
 const endRow=()=>{endField();if(row.some(x=>x!==""))result.push(row.splice(0));else row.splice(0)};
 for(let i=0;i<csv.length;i++){
  const ch=csv[i];
  if(quoted){
   if(ch==='"'&&csv[i+1]==='"'){field+='"';i++}
   else if(ch==='"') {quoted=false;closedQuote=true}
   else field+=ch;
  }else if(ch==='"'&&!field&&!closedQuote){quoted=true}
  else if(ch===","||ch==="\n"||ch==="\r"){
   if(ch===",")endField();else{if(ch==="\r"&&csv[i+1]==="\n")i++;endRow()}
  }else if(closedQuote){
   if(ch!==" "&&ch!=="\t")throw new CsvImportError("Unexpected characters after a quoted field.");
  }else field+=ch;
 }
 if(quoted)throw new CsvImportError("Unclosed quoted cell in CSV.");
 if(field!==""||row.length)endRow();
 return result;
}
const canonical=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
export function parseQuizCsv(csv:string):ImportedQuestion[]{
 const rows=parseCsvRows(csv);
 if(rows.length<2)throw new CsvImportError("CSV must contain a header and at least one question.");
 const head=rows[0].map(canonical);
 const choose=(options:string[],required=true)=>{
  const idx=head.findIndex(h=>options.includes(h));
  if(idx<0&&required)throw new CsvImportError("Missing CSV column: "+options[0]);
  return idx;
 };
 const q=choose(["question","questiontext","prompt"]);
 const answerFields=[
  ["optiona","answera","choicea","option1","answer1"],
  ["optionb","answerb","choiceb","option2","answer2"],
  ["optionc","answerc","choicec","option3","answer3"],
  ["optiond","answerd","choiced","option4","answer4"]
 ].map(v=>choose(v));
 const correct=choose(["correct","correctanswer","answer","correctoption","correctindex"]);
 const explanation=choose(["explanation","reason","feedback"],false);
 if(rows.length>41)throw new CsvImportError("Maximum 40 questions per quiz. Split the CSV.");
 return rows.slice(1).map((cells,i)=>{
  const question=cells[q]?.trim()||"",options=answerFields.map(j=>cells[j]?.trim()||"");
  const raw=(cells[correct]||"").trim().toUpperCase();
  let index:number;
  if(/^[A-D]$/.test(raw))index=raw.charCodeAt(0)-65;
  else if(/^[1-4]$/.test(raw))index=Number(raw)-1;
  else if(raw==="0")index=0;
  else throw new CsvImportError("Question "+(i+1)+": use A/B/C/D or 1/2/3/4 as correct answer.");
  if(question.length<4||question.length>750||options.some(x=>x.length<1||x.length>250)||
   new Set(options.map(x=>x.toLocaleLowerCase())).size!==4)throw new CsvImportError("Question "+(i+1)+": invalid question or four unique options.");
  const reason=explanation>=0?(cells[explanation]||"").trim():"";
  if(reason.length>800)throw new CsvImportError("Question "+(i+1)+": explanation too long.");
  return {question,options:options as [string,string,string,string],correct_option_index:index,explanation:reason};
 });
}
export const CSV_TEMPLATE="question,option_a,option_b,option_c,option_d,correct,explanation\r\n"+
 '"What is the capital of Malaysia?","Johor Bahru","Kuala Lumpur","Penang","Kuching",B,"Kuala Lumpur is the capital."\r\n';
