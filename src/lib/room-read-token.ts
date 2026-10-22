import {createHmac,timingSafeEqual} from "node:crypto";

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxAgeSeconds=60*60;

function sign(data:string):string{
 const secret=process.env.ZOKIVO_SESSION_SECRET;
 if(!secret||secret.length<32)throw Error("Room read token secret unavailable");
 return createHmac("sha256",secret).update("zokivo-read-v1:"+data).digest("base64url");
}

/** Read-only, room-scoped one-hour capability. This does NOT authorize writes. */
export function issueRoomReadToken(pin:string,playerId:string):string{
 if(!/^\d{6}$/.test(pin)||!uuidPattern.test(playerId))throw Error("Invalid room read identity");
 const data=Buffer.from(JSON.stringify([pin,playerId,Math.floor(Date.now()/1000)+maxAgeSeconds])).toString("base64url");
 return "zr1."+data+"."+sign(data);
}

export function verifyRoomReadToken(pin:string,value:string|null):string|null{
 if(!value||value.length>350||!value.startsWith("zr1."))return null;
 const pieces=value.split(".");
 if(pieces.length!==3||pieces[1].length>250||!(/^[A-Za-z0-9_-]+$/.test(pieces[1]))||!(/^[A-Za-z0-9_-]+$/.test(pieces[2])))return null;
 try{
  const expected=Buffer.from(sign(pieces[1]));
  const received=Buffer.from(pieces[2]);
  if(expected.length!==received.length||!timingSafeEqual(expected,received))return null;
  const decoded=JSON.parse(Buffer.from(pieces[1],"base64url").toString("utf8"));
  if(!Array.isArray(decoded)||decoded.length!==3)return null;
  const [claimPin,playerId,exp]=decoded;
  const now=Math.floor(Date.now()/1000);
  if(claimPin!==pin||typeof playerId!=="string"||!uuidPattern.test(playerId))return null;
  if(!Number.isInteger(exp)||exp<now||exp>now+maxAgeSeconds)return null;
  return playerId;
 }catch{return null}
}
