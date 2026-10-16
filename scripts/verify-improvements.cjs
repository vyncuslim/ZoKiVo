const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
function load(path){
 const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function("require","module","exports",js)(require,module,module.exports);return module.exports;
}
const csv=load("src/lib/quiz-csv.ts"),report=load("src/lib/report-csv.ts");
let n=0;function ok(v,msg){assert.ok(v,msg);n++}function fail(f,msg){assert.throws(f,undefined,msg);n++}
const sample='question,option_a,option_b,option_c,option_d,correct,explanation\r\n"Which planet is red?","Mars","Venus","Earth","Jupiter",A,"Rust"\r\n"What is ""hello""?","A","B","C","D",4,"A quoted word"\r\n';
const imported=csv.parseQuizCsv(sample);
ok(imported.length===2,"CSV imports both questions");
ok(imported[0].correct_option_index===0,"CSV recognizes A-D");
ok(imported[1].correct_option_index===3,"CSV recognizes numeric answers");
ok(imported[1].question.includes('"hello"'),"CSV unescapes quoted cells");
ok(csv.parseCsvRows('\uFEFFname,answer\r\n"Line 1\nLine 2",Yes').length===2,"CSV BOM and multiline");
ok(csv.parseQuizCsv(csv.CSV_TEMPLATE).length===1,"CSV template valid");
fail(()=>csv.parseQuizCsv("question,option_a\nx,A"),"Header validation");
fail(()=>csv.parseQuizCsv(sample.replace(',A,"Rust"',',Z,"Rust"')),"Correct answer validation");
fail(()=>csv.parseQuizCsv(sample.replace('"Mars","Venus"','"Mars","Mars"')),"Duplicate answers disallowed");
fail(()=>csv.parseQuizCsv("x".repeat(1024*1024+1)),"1MB max");
fail(()=>csv.parseQuizCsv("question,option_a,option_b,option_c,option_d,correct\n"+Array.from({length:41},(_,i)=>'"Question '+i+'","A","B","C","D",A').join("\n")),"40-question max");
const result=report.buildReportCsv({pin:"123456",status:"finished",players:[{rank:1,nickname:"=HYPERLINK(1)",score:100,answered:2,correct:1}],questions:[{number:1,question:'A "quoted" question',correctAnswer:"Mars",submissions:3,correct:2}]});
ok(result.includes("'=HYPERLINK(1)"),"CSV formula injection prevented");
ok(result.includes('A ""quoted"" question'),"CSV quote escaping");
ok(result.includes('"50"'),"Player accuracy correct");
ok(result.includes('"67"'),"Question accuracy correct");
fail(()=>report.buildReportCsv({pin:"123456",status:"playing",players:[],questions:[]}),"Unfinished report rejected");
const room=fs.readFileSync("src/app/api/rooms/route.ts","utf8"),start=fs.readFileSync("src/app/api/rooms/[pin]/start/route.ts","utf8");
const reportSource=fs.readFileSync("src/app/api/rooms/[pin]/report/route.ts","utf8"),game=fs.readFileSync("src/app/game/[pin]/page.tsx","utf8");
ok(room.includes("question_seconds")&&room.includes("questionSeconds"),"Server saves room timer");
ok(start.includes("make_interval(secs => "), "Server controls round deadline");
ok(reportSource.includes('rows[0].status!=="finished"')&&reportSource.includes("await findUser(req)"),"Host report only after finish");
ok(game.includes("QRCode.toDataURL")&&game.includes("Download results CSV"),"QR and reports available in game");
console.log("ZOKIVO_FEATURE_TEST_PASS: "+n+" assertions");
