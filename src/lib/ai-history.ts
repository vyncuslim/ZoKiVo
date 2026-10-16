import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import {AuthError} from "@/lib/mother-auth";
export function aiMessageId(v:unknown):v is string{return typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)}
function secretKey(){
 const secret=process.env.ZOKIVO_SESSION_SECRET;
 if(!secret||secret.length<32)throw new AuthError("AI history encryption is not configured.",503);
 return createHash("sha256").update("zokivo-history-key-v1:").update(secret).digest();
}
export function encryptMessage(text:string,owner:string,conversation:string){
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",secretKey(),iv);
 cipher.setAAD(Buffer.from(owner+":"+conversation));
 const encrypted=Buffer.concat([cipher.update(text,"utf8"),cipher.final()]);
 return "v1:"+iv.toString("base64url")+":"+cipher.getAuthTag().toString("base64url")+":"+encrypted.toString("base64url");
}
export function decryptMessage(value:string,owner:string,conversation:string){
 const p=value.split(":");
 if(p.length!==4||p[0]!=="v1")throw new AuthError("Unsupported encrypted chat record.",503);
 const iv=Buffer.from(p[1],"base64url"),tag=Buffer.from(p[2],"base64url");
 if(iv.length!==12||tag.length!==16)throw new AuthError("Invalid encrypted chat record.",503);
 const decipher=createDecipheriv("aes-256-gcm",secretKey(),iv);
 decipher.setAAD(Buffer.from(owner+":"+conversation));decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(Buffer.from(p[3],"base64url")),decipher.final()]).toString("utf8");
}
export function validChatMessage(raw:unknown){
 if(!raw||typeof raw!=="object")throw new AuthError("Invalid message.");
 const r=raw as Record<string,unknown>;
 if(!aiMessageId(r.clientMessageId)||!["user","assistant"].includes(String(r.role)))throw new AuthError("Invalid message metadata.");
 if(typeof r.text!=="string"||r.text.trim().length<1||r.text.length>(r.role==="user"?2000:10000))throw new AuthError("Invalid message length.");
 return {clientMessageId:r.clientMessageId,role:r.role as "user"|"assistant",text:r.text.trim()};
}
