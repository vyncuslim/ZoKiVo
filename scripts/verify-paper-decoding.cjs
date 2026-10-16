/* Tests the real production decoding modules on generated camera-like ImageData.
   Executed before each Vercel build: a failing decoder must block deployment.
   Does not substitute for actual phone/webcam performance testing. */
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const ts=require("typescript");
const qr=require("qrcode");
const start=Date.now();
function loadTs(file){
 const src=fs.readFileSync(path.join(process.cwd(),file),"utf8");
 const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function("require","module","exports",compiled)(require,module,module.exports);
 return module.exports;
}
const zk=loadTs("src/lib/paper-detection.ts");
const wg=loadTs("src/lib/wayground-cards.ts");
const source=fs.readFileSync("src/lib/wayground-cards.ts","utf8");
const literal=/const WORDS = ("(?:[^"\\]|\\.)*");/.exec(source);
assert.ok(literal,"Wayground marker dictionary must exist");
const words=JSON.parse(literal[1]).split("\n");
function blank(w,h){const data=new Uint8ClampedArray(w*h*4);data.fill(255);return {width:w,height:h,data}}
function putPixel(img,x,y,color){
 if(x<0||y<0||x>=img.width||y>=img.height)return;
 const i=(y*img.width+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=color;img.data[i+3]=255;
}
function drawWord(img,word,ox,oy,scale){
 for(let y=0;y<6;y++)for(let x=0;x<6;x++){
  const v=word[y*6+x]==="1"?0:255;
  for(let yy=0;yy<scale;yy++)for(let xx=0;xx<scale;xx++)putPixel(img,ox+x*scale+xx,oy+y*scale+yy,v);
 }
}
function rotateCCW(a){let word="";for(let r=0;r<6;r++)for(let c=0;c<6;c++)word+=a[c*6+5-r];return word}
function imageData(img){return {width:img.width,height:img.height,data:img.data}}
function fakeCanvas(image){
 return {width:image.width,height:image.height,getContext(){
  return {getImageData(x,y,w,h){
   x=x??0;y=y??0;w=w??image.width;h=h??image.height;
   const out=blank(w,h);
   for(let r=0;r<h;r++)for(let c=0;c<w;c++){
    const sx=x+c,sy=y+r;
    if(sx<0||sy<0||sx>=image.width||sy>=image.height)continue;
    const si=(sy*image.width+sx)*4,di=(r*w+c)*4;
    out.data[di]=image.data[si];out.data[di+1]=image.data[si+1];out.data[di+2]=image.data[si+2];out.data[di+3]=image.data[si+3];
   }
   return out;
  }};
 }};
}
function makeQr(card,quarter=0,scale=6){
 const code="ZK1:"+String(card).padStart(3,"0");
 const m=qr.create(code,{errorCorrectionLevel:"H"}).modules;
 const n=m.size+8,original=blank(n*scale,n*scale);
 for(let y=0;y<m.size;y++)for(let x=0;x<m.size;x++)if(m.get(y,x)){
  for(let py=0;py<scale;py++)for(let px=0;px<scale;px++)putPixel(original,(x+4)*scale+px,(y+4)*scale+py,0);
 }
 let image=original;
 for(let i=0;i<quarter;i++){
  const dst=blank(image.height,image.width);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
   const src=(y*image.width+x)*4,dstIndex=((image.width-1-x)*dst.width+y)*4;
   for(let k=0;k<4;k++)dst.data[dstIndex+k]=image.data[src+k];
  }
  image=dst;
 }
 return image;
}
function paste(target,source,ox,oy){
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
  const si=(y*source.width+x)*4,di=((oy+y)*target.width+ox+x)*4;
  for(let k=0;k<4;k++)target.data[di+k]=source.data[si+k];
 }
}
let pass=0;
function check(condition,name){assert.ok(condition,name);pass++}
(async()=>{
 const stats=wg.getWaygroundDictionaryStats();
 check(stats.cards===60&&stats.orientations===240&&stats.distinct===240,"All 60 Wayground markers have unique quarter-turn patterns");
 for(let c=1;c<=60;c++)for(let rot=0;rot<4;rot++){
  let word=words[c-1];for(let i=0;i<rot;i++)word=rotateCCW(word);
  const raw=blank(160,160);drawWord(raw,word,32,32,16);
  const results=wg.detectWaygroundFrame(imageData(raw));
  const expected=(c-1+rot)%4;
  check(results.length===1&&results[0].card===c&&results[0].choice===expected,"WG #"+c+" quarter "+rot+" expected "+expected+" got "+JSON.stringify(results));
 }
 for(const n of [1,4,10,16]){
  const cols=4,rows=Math.ceil(n/cols),frame=blank(cols*220,rows*220);
  for(let i=0;i<n;i++){
   let word=words[i];for(let k=0;k<i%4;k++)word=rotateCCW(word);
   drawWord(frame,word,((i%cols)*220)+50,Math.floor(i/cols)*220+50,20);
  }
  const got=wg.detectWaygroundFrame(imageData(frame));
  check(got.length===n,"WG same-frame "+n+" markers: got "+got.length);
  for(let c=1;c<=n;c++)check(got.some(x=>x.card===c&&x.choice===(c-1+(c-1)%4)%4),"WG frame "+n+" card "+c);
 }
 for(const id of [1,2,17,36,60])for(let turn=0;turn<4;turn++){
  const frame=makeQr(id,turn);
  const got=(await zk.scanCardFrame(fakeCanvas(frame),null)).detections;
  check(got.length===1&&got[0].card===id&&got[0].choice===turn,"ZoKivo QR #"+id+" quarter "+turn+" expected "+turn+" got "+JSON.stringify(got));
 }
 for(const count of [2,4]){
  const frame=blank(count*260,260);
  for(let i=0;i<count;i++)paste(frame,makeQr(i+1,i%4,5),i*260+25,28);
  const got=(await zk.scanCardFrame(fakeCanvas(frame),null,16)).detections;
  check(got.length===count,"ZoKivo same-frame "+count+" codes decoded "+got.length);
  for(let i=0;i<count;i++)check(got.some(x=>x.card===i+1&&x.choice===i%4),"ZK same-frame card "+(i+1));
 }
 // Two original Wayground-style markers and two ZoKivo QR markers in the same frame.
 const mixed=blank(900,240);
 for(let i=0;i<2;i++){
  const q=makeQr(i+1,i,5);paste(mixed,q,i*230+12,12);
  let w=words[i];for(let t=0;t<i;t++)w=rotateCCW(w);
  drawWord(mixed,w,i*230+500,40,21);
 }
 const qrHits=(await zk.scanCardFrame(fakeCanvas(mixed),null,16)).detections;
 const wgHits=wg.detectWaygroundFrame(imageData(mixed),16);
 check(qrHits.length===2&&wgHits.length===2,"mixed frame needs 2 of each (got QR="+qrHits.length+" WG="+wgHits.length+")");
 check(qrHits.some(x=>x.card===1&&x.choice===0)&&wgHits.some(x=>x.card===1&&x.choice===0),"both formats of card #1 distinct");
 console.log("PAPER_DETECTOR_TEST_PASS: "+pass+" assertions. Actual production TS modules, 60x4 Wayground, QR quarter turns, multi-card and mixed-format frames. "+(Date.now()-start)+" ms");
})().catch(e=>{console.error("PAPER_DETECTOR_TEST_FAILED:",e.stack||e);process.exitCode=1});
