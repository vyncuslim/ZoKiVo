/** Independent Quizizz/Wayground Q-Cards optical code compatibility.
 * 60 six-by-six binary markers extracted from the publicly downloadable
 * Quizizz-QCards/en.pdf, one per participant. Not affiliated with Wayground.
 * Browser-side prototype: front-facing approximately axis-aligned cards.
 * Printed PDF top labels cycle A/B/C/D by (card number - 1) mod 4.
 */
import type {CardDetection,Choice,Point,Quad} from "./paper-detection";
const WORDS = "111111101111110011101111101001111111\n111111101101101001111111101101111111\n111111101011101001111001111001111111\n111111110001111001101111111001111111\n111111100001100011110111110001111111\n111111101001111011110011101111111111\n111111111011110001111001110101111111\n111111111101100011111101110011111111\n111111111011111101111011111001111111\n111111101101101001110001111101111111\n111111111101101111100011101111111111\n111111101011111111110001111111111111\n111111111001111011101111100111111111\n111111101011101001111111110011111111\n111111111101110001111011110111111111\n111111100011110011100001101111111111\n111111111011100101111001100001111111\n111111110111110011101001110111111111\n111111110001110111111111101011111111\n111111111111111101101111100101111111\n111111110011110001100101100001111111\n111111101001100101100111110101111111\n111111111111110101111111111101111111\n111111111101100111111011111011111111\n111111101111101001101011111011111111\n111111100011110001111011101101111111\n111111111001110011111011111101111111\n111111101101111011100111111011111111\n111111101111110101101101100111111111\n111111101101111111110111100001111111\n111111111101101101111001111001111111\n111111110101111001110011111011111111\n111111100111110101111001110001111111\n111111110001101111101001100101111111\n111111101011110111101101100001111111\n111111110111101011110111100011111111\n111111100011100011111011101011111111\n111111100101100111100001101101111111\n111111101011100011101011100111111111\n111111100001101111110011101111111111\n111111110001101011110011100011111111\n111111101111101001110011101001111111\n111111100001111011101001110001111111\n111111110001100001100101101101111111\n111111100001100011101011110011111111\n111111111101111011111101111111111111\n111111110011100111100001111011111111\n111111100011111111111011111111111111\n111111111111101011101111110011111111\n111111101101101101101001111011111111\n111111111101100011111111101111111111\n111111111111110111100111100101111111\n111111111101111011110001110111111111\n111111101001110011111111111011111111\n111111101101100001110101101111111111\n111111111111101111101011111001111111\n111111111111101101100001101001111111\n111111110011110111111011110101111111\n111111110111111101111111101111111111\n111111100011101011101111100111111111";
const DICT=WORDS.trim().split(/\s+/);
function rotateCCW(a:string):string {
 let s=""; for(let r=0;r<6;r++)for(let c=0;c<6;c++)s+=a[c*6+(5-r)];
 return s;
}
const patterns:{card:number;orientation:number;word:string}[]=[];
for(let n=0;n<DICT.length;n++){let word=DICT[n];for(let rot=0;rot<4;rot++){patterns.push({card:n+1,orientation:rot,word});word=rotateCCW(word)}}
function popcount(a:string,b:string){let n=0;for(let i=0;i<36;i++)if(a[i]!==b[i])n++;return n}
export function identifyWaygroundCode(word:string):{card:number;choice:Choice;distance:number}|null{
 if(!/^[01]{36}$/.test(word))return null;
 let best:{card:number;choice:Choice;distance:number}|null=null;let second=Infinity;
 for(const p of patterns){const distance=popcount(word,p.word);
  if(!best||distance<best.distance){second=best?.distance??Infinity;best={card:p.card,choice:((p.card-1+p.orientation)%4) as Choice,distance}}
  else if(distance<second)second=distance;
 }
 // The 240 expected orientations have minimum inter-code Hamming distance 3.
 // The PDF prints P1 with A up, P2 with B up, P3 with C up and P4 with D up;
 // do NOT interpret the raw rotation index as the answer for every card.
 // Accept exact and one-cell mismatch ONLY when unambiguous.
 if(!best||best.distance>1||second-best.distance<2)return null;
 return best;
}
export function getWaygroundDictionaryStats(){
 return {cards:DICT.length,orientations:patterns.length,distinct:new Set(patterns.map(p=>p.word)).size};
}
type Candidate={x:number;y:number;w:number;h:number;area:number};
/**
 * Find solid dark bounding square in a binary frame using 8-connected
 * components. Unlike a QR finder pattern, the outermost Wayground frame
 * is a contiguous 1-cell-thick 6x6 black square.
 */
export function detectWaygroundFrame(image:ImageData,cap=16):CardDetection[]{
 const {width:w,height:h,data}=image;
 // Subsample to control scan time on mobile devices.
 const stride=Math.max(1,Math.ceil(w/900));const dw=Math.floor(w/stride),dh=Math.floor(h/stride);
 const bits=new Uint8Array(dw*dh),seen=new Uint8Array(dw*dh);
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
  const offset=((y*stride)*w+x*stride)*4;
  const r=data[offset],g=data[offset+1],b=data[offset+2];
  bits[y*dw+x]=(r*0.299+g*0.587+b*0.114<105)?1:0;
 }
 const queue=new Int32Array(dw*dh),candidates:Candidate[]=[];
 for(let start=0;start<bits.length;start++){
  if(!bits[start]||seen[start])continue;
  let head=0,tail=1,lowX=start%dw,highX=lowX,lowY=Math.floor(start/dw),highY=lowY;
  queue[0]=start;seen[start]=1;
  while(head<tail){
   const v=queue[head++],x=v%dw,y=Math.floor(v/dw);
   if(x<lowX)lowX=x;if(x>highX)highX=x;if(y<lowY)lowY=y;if(y>highY)highY=y;
   for(const off of [-dw,-1,1,dw]){
    const k=v+off;if(k<0||k>=bits.length||seen[k]||!bits[k])continue;
    if(off===-1&&x===0 || off===1&&x===dw-1)continue;
    seen[k]=1;queue[tail++]=k;
   }
  }
  const cw=highX-lowX+1,ch=highY-lowY+1;
  if(cw<42||ch<42||Math.abs(cw-ch)/Math.max(cw,ch)>.16)continue;
  const ratio=tail/(cw*ch);
  if(ratio<.43||ratio>.92)continue;
  candidates.push({x:lowX*stride,y:lowY*stride,w:cw*stride,h:ch*stride,area:tail});
 }
 candidates.sort((a,b)=>b.area-a.area);
 const found:CardDetection[]=[];
 for(const candidate of candidates.slice(0,100)){
  const {x,y,w:cw,h:ch}=candidate;
  let word="";
  for(let r=0;r<6;r++)for(let c=0;c<6;c++){
   let black=0,samples=0;
   for(let sy=-1;sy<=1;sy++)for(let sx=-1;sx<=1;sx++){
    const xx=Math.round(x+(c+.5)*cw/6+sx*Math.max(1,cw/42));
    const yy=Math.round(y+(r+.5)*ch/6+sy*Math.max(1,ch/42));
    if(xx<0||xx>=w||yy<0||yy>=h)continue;
    const k=4*(yy*w+xx),val=data[k]*.299+data[k+1]*.587+data[k+2]*.114;
    black+=val<135?1:0;samples++;
   }
   word+=black>samples/2?"1":"0";
  }
  const hit=identifyWaygroundCode(word);
  if(!hit||found.some(d=>d.card===hit.card))continue;
  const corners:Quad=[{x,y},{x:x+cw,y},{x:x+cw,y:y+ch},{x,y:y+ch}];
  found.push({card:hit.card,choice:hit.choice,corners});
  if(found.length>=cap)break;
 }
 return found;
}
