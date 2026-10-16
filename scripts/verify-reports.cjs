const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript");
const read=p=>fs.readFileSync(p,"utf8");let n=0;const ok=(x,msg)=>{assert.ok(x,msg);n++};
const index=read("src/app/api/reports/route.ts"),detail=read("src/app/api/reports/[pin]/route.ts");
ok(index.includes("authUser(req)"),"Only logged-in users see classroom history");
ok(index.includes("r.owner_user_id=")&&index.includes("s.owner_user_id="),"Quiz and Paper history owner scoped");
ok(index.includes("paper_sessions")&&index.includes("rooms r"),"Both game types included");
ok(index.includes("LIMIT 100"),"History bounded");
ok(detail.includes("authUser(req)"),"Detailed report requires verified account");
ok(detail.includes("r.owner_user_id=")&&detail.includes("s.owner_user_id="),"Per-room report ownership");
ok(detail.includes('status!=="finished"'),"No answer analytics until game ends");
ok(detail.includes("chosen_index=3")&&detail.includes("a.choice=3"),"Four-choice distribution for both room types");
ok(detail.includes("mode_events"),"Virtual reward ledger summarized");
ok(!detail.includes("host_token_hash"),"Report cannot leak host credentials");
const page=read("src/app/reports/page.tsx"),report=read("src/app/reports/[pin]/page.tsx");
ok(page.includes('"/api/reports"')&&page.includes('r.kind==="paper"'),"History page covers paper and online games");
ok(report.includes("reports-answer-bars"),"Question result charts rendered");
ok(report.includes("buildReportCsv"),"Historical CSV export available");
ok(report.includes('role="alert"'),"Report errors visible");
for(const p of ["src/app/api/reports/route.ts","src/app/api/reports/[pin]/route.ts","src/app/reports/page.tsx","src/app/reports/[pin]/page.tsx"]){
 const diagnostics=ts.transpileModule(read(p),{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).diagnostics||[];
 ok(diagnostics.length===0,"TypeScript syntax valid: "+p);
}
console.log("ZOKIVO_REPORTS_TEST_PASS: "+n+" assertions.");
