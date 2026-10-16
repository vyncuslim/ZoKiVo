import {db,token,hash,bad} from "@/lib/store";
import {randomInt} from "node:crypto";
export const runtime="nodejs";
export async function POST(){
 if(process.env.PAPER_MODE_ENABLED!=="true")return bad("Paper Mode is not enabled on this environment",503);
 try{
  const sql=db(), secret=token();
  for(let i=0;i<6;i++){
    const pin=String(randomInt(100000,1000000));
    const rows=await sql`INSERT INTO paper_sessions(pin,quiz_set_id,host_token_hash)
     SELECT ${pin},id,${hash(secret)} FROM quiz_sets WHERE id='b91f4600-1000-4000-8000-000000000001'
     ON CONFLICT DO NOTHING RETURNING pin`;
    if(rows.length)return Response.json({pin,hostToken:secret},{headers:{"Cache-Control":"no-store"}});
  }
  return bad("Could not find a free PIN. Try again.",503);
 }catch(e){console.error("paper create",e);return bad("Paper session unavailable. Check database setup.",503)}
}
