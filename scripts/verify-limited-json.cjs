const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict");
const content=fs.readFileSync("src/lib/limited-json.ts","utf8");
const js=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function("require","module","exports",js)(require,mod,mod.exports);
const {readBoundedJson}=mod.exports;
const url="https://qa.example/api/quizzes";
let checks=0;
function eq(actual,expected,title){assert.equal(actual,expected,title);checks++}
function post(body,headers={"content-type":"application/json"}){
 return new Request(url,{method:"POST",headers,body});
}
(async()=>{
 const normal=await readBoundedJson(post(JSON.stringify({questions:[1]})),1024);
 eq(normal.ok,true,"Normal JSON accepted");eq(normal.value.questions.length,1,"Object preserved");
 const mime=await readBoundedJson(post("{}",{"content-type":"application/json; charset=utf-8"}),1024);
 eq(mime.ok,true,"JSON charset accepted");
 eq((await readBoundedJson(post("{}",{"content-type":"text/plain"}),1024)).status,415,"Non-JSON blocked");
 eq((await readBoundedJson(post("{}",{"content-type":"application/json-fake"}),1024)).status,415,"MIME spoof blocked");
 eq((await readBoundedJson(post("{}",{"content-type":"application/json","content-length":"999999"}),1024)).status,413,"Oversized announced length blocked");
 eq((await readBoundedJson(post("{}",{"content-type":"application/json","content-length":"oops"}),1024)).status,413,"Invalid Content-Length blocked");
 eq((await readBoundedJson(post("{" ),1024)).status,400,"Malformed JSON blocked");
 eq((await readBoundedJson(post("[]"),1024)).status,400,"Root array blocked");
 eq((await readBoundedJson(post("null"),1024)).status,400,"Root null blocked");
 eq((await readBoundedJson(post("1"),1024)).status,400,"Scalar blocked");
 eq((await readBoundedJson(post(JSON.stringify({padding:"x".repeat(1600)})),1024)).status,413,"Unannounced oversized stream rejected");
 eq((await readBoundedJson(post(new Uint8Array([0xff])),1024)).status,400,"Malformed UTF-8 rejected");
 eq((await readBoundedJson(new Request(url,{method:"POST",headers:{"content-type":"application/json"}}),1024)).status,400,"Missing body rejected");
 const near=await readBoundedJson(post(JSON.stringify({padding:"x".repeat(980)})),1024);
 eq(near.ok,true,"Valid near-limit body accepted");
 await assert.rejects(()=>readBoundedJson(post("{}"),300000));checks++;
 console.log("LIMITED_JSON_TEST_PASS: "+checks+" assertions for strict JSON API body limits and parser safety.");
})().catch(e=>{console.error("LIMITED_JSON_TEST_FAILED",e.stack||e);process.exitCode=1});
