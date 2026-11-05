/**
 * Bounded JSON reader for state-changing endpoints. Rejects oversized streams
 * before buffering, including when a client omits or lies about Content-Length.
 */
export type JsonReadResult =
 | {ok:true;value:Record<string,unknown>}
 | {ok:false;error:string;status:number};
export async function readBoundedJson(req:Request,maxBytes:number):Promise<JsonReadResult>{
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>262144)
  throw new Error("Invalid JSON byte cap");
 if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers.get("content-type")||""))
  return {ok:false,error:"JSON content type required.",status:415};
 const length=req.headers.get("content-length");
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))
  return {ok:false,error:"Request body too large.",status:413};
 if(!req.body)return {ok:false,error:"JSON object required.",status:400};
 const reader=req.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true});
 let bytes=0,text="";
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>maxBytes){await reader.cancel().catch(()=>{});return {ok:false,error:"Request body too large.",status:413}}
   text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
  const parsed:unknown=JSON.parse(text);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
   return {ok:false,error:"JSON object required.",status:400};
  return {ok:true,value:parsed as Record<string,unknown>};
 }catch{return {ok:false,error:"Malformed JSON.",status:400}}
}
