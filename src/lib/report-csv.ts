export type GameReport={pin:string;status:"finished";players:{rank:number;nickname:string;score:number;answered:number;correct:number}[];questions:{number:number;question:string;correctAnswer:string;submissions:number;correct:number}[]};
const cell=(v:string|number)=>{let x=String(v);if(/^\s*[=+\-@\t\r\n]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"'};
const line=(values:(string|number)[])=>values.map(cell).join(",");
export function buildReportCsv(r:GameReport){
 if(r.status!=="finished")throw Error("Game not finished.");
 return [line(["ZoKivo Game Report",r.pin]),line(["Rank","Nickname","Score","Answered","Correct","Accuracy %"]),
 ...r.players.map(p=>line([p.rank,p.nickname,p.score,p.answered,p.correct,p.answered?Math.round(p.correct/p.answered*100):0])),
 "",line(["Question","Prompt","Correct answer","Submissions","Correct","Accuracy %"]),
 ...r.questions.map(q=>line([q.number,q.question,q.correctAnswer,q.submissions,q.correct,q.submissions?Math.round(q.correct/q.submissions*100):0]))].join("\r\n")+"\r\n";
}
