/** Cookie jar for synthetic browser sessions; intentionally never logs cookie values. */
export function newQaCookieJar(){
 const cookies=new Map();
 return {
  capture(headers){
   const all=typeof headers.getSetCookie==="function"?headers.getSetCookie():
     (headers.get("set-cookie")?[headers.get("set-cookie")]:[]);
   for(const line of all){
    const segment=line.split(";")[0]?.trim(),i=segment?.indexOf("=")??-1;
    if(i<=0)continue;
    const name=segment.slice(0,i),value=segment.slice(i+1);
    if(!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name))continue;
    if(/(?:^|;)\s*max-age\s*=\s*0(?:;|$)/i.test(line)||!value)cookies.delete(name);
    else cookies.set(name,value);
   }
  },
  header(){return [...cookies].map(([k,v])=>k+"="+v).join("; ")},
  has(name){return cookies.has(name)}
 };
}
