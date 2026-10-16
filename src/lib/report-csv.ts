export type ReportPlayer={rank:number;nickname:string;score:number;answered:number;correct:number};
export type ReportQuestion={number:number;question:string;correctAnswer:string;submissions:number;correct:number};
export type GameReport={pin:string;status:"finished";players:ReportPlayer[];questions:ReportQuestion[]};
function csvCell(value:string|number){
 let text=String(value);
 // Prevent spreadsheet formula injection when teachers open a downloaded CSV.
 if(/^[\s]*[=+\-@\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
function row(values:(string|number)[]){return values.map(csvCell).join(",")}
export function buildReportCsv(report:GameReport){
 if(report.status!=="finished")throw Error("Game report is not yet complete.");
 const lines=[
  row(["ZoKivo Game Report",report.pin]),
  row(["Rank","Nickname","Score","Answered","Correct","Accuracy %"]),
  ...report.players.map(p=>row([p.rank,p.nickname,p.score,p.answered,p.correct,p.answered?Math.round(p.correct/p.answered*100):0])),
  "",
  row(["Question","Prompt","Correct answer","Submissions","Correct","Accuracy %"]),
  ...report.questions.map(q=>row([q.number,q.question,q.correctAnswer,q.submissions,q.correct,q.submissions?Math.round(q.correct/q.submissions*100):0]))
 ];
 return lines.join("\r\n")+"\r\n";
}
