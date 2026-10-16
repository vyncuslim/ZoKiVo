"use client";
import type {ReactNode} from "react";
const symbol:Record<string,string>={times:"×",div:"÷",cdot:"·",pi:"π",theta:"θ",alpha:"α",beta:"β",leq:"≤",geq:"≥",neq:"≠",pm:"±",infty:"∞",sqrt:"√",rightarrow:"→"};
function renderMath(text:string):ReactNode[]{
 const tokens=text.match(/\\frac\{[^{}]+\}\{[^{}]+\}|\\sqrt\{[^{}]+\}|\^\{[^{}]+\}|_\{[^{}]+\}|\\[a-z]+|[^^_\\]+|./g)||[];
 return tokens.map((part,i)=>{
  if(part.startsWith("\\frac{")){
   const match=part.match(/^\\frac\{([^{}]+)\}\{([^{}]+)\}$/);
   if(match)return <span className="zokivo-fraction" key={i}><span>{renderMath(match[1])}</span><span>{renderMath(match[2])}</span></span>;
  }
  if(part.startsWith("\\sqrt{"))return <span key={i}>√<span className="zokivo-radicand">{renderMath(part.slice(6,-1))}</span></span>;
  if(part.startsWith("^{"))return <sup key={i}>{renderMath(part.slice(2,-1))}</sup>;
  if(part.startsWith("_{"))return <sub key={i}>{renderMath(part.slice(2,-1))}</sub>;
  if(part.startsWith("\\"))return <span key={i}>{symbol[part.slice(1)]||part}</span>;
  return <span key={i}>{part}</span>;
 });
}
export function QuestionMedia({imageUrl,audioUrl,formula}:{
 imageUrl?:string|null;audioUrl?:string|null;formula?:string|null;
}){
 if(!imageUrl&&!audioUrl&&!formula)return null;
 return <div className="zokivo-question-media">
  {imageUrl&&<img src={imageUrl} alt="Illustration provided by the quiz author" referrerPolicy="no-referrer" loading="lazy" decoding="async"/>}
  {formula&&<div className="zokivo-formula" role="math" aria-label={formula}>{renderMath(formula)}</div>}
  {audioUrl&&<div className="zokivo-audio"><span>🔊 Listen to the question</span><audio controls preload="none" src={audioUrl}>Audio is unavailable on this browser.</audio></div>}
 </div>;
}
