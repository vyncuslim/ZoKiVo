const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const root=fs.readFileSync("src/app/layout.tsx","utf8");
const sitemap=fs.readFileSync("src/app/sitemap.ts","utf8");
const robots=fs.readFileSync("src/app/robots.ts","utf8");
let checks=0;
function test(v,msg){assert.ok(v,msg);checks++}
test(root.includes('metadataBase:new URL("https://zokivo.vynalthai.com")'),"Public canonical origin");
test(root.includes('uYmJ_568JPu-rjsyRzA2KU2vQpiQDOvN97G5Qgd5-38'),"Google verification preserved");
test(sitemap.includes('https://zokivo.vynalthai.com'),"Sitemap matches canonical host");
test(robots.includes('https://zokivo.vynalthai.com/sitemap.xml'),"Robots sitemap points at canonical host");
for(const p of ["/","/games","/how-it-works","/try","/paper","/paper/cards","/library"]){
 test(sitemap.includes('path:"'+p+'"'),"Public page in sitemap: "+p);
}
for(const p of ["/auth/","/account","/game/","/api/","/paper/scan/","/paper/board/"]){
 test(!sitemap.includes('path:"'+p+'"'),"Private page excluded: "+p);
 test(robots.includes('"'+p+'"'),"Private path disallowed: "+p);
}
for(const p of ["src/app/sitemap.ts","src/app/robots.ts"]){
 const file=fs.readFileSync(p,"utf8");
 const out=ts.transpileModule(file,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 test(!out.diagnostics?.length,"Metadata route compiles: "+p);
}
console.log("SEO_METADATA_TEST_PASS: "+checks+" assertions for canonical URLs, sitemap, robots and verification.");
