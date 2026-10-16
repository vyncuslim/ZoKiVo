import {db,hash,same,bad} from "@/lib/store";
export const runtime="nodejs";
type CardSource="zokivo"|"wayground";
type Answer={card:number;choice:number;card_source:CardSource};
export async function POST(req:Request,{params}:{params:Promise<{pin:string}>}){
 const{pin}=await params,t=req.headers.get("x-host-token");
 if(!/^\d{6}$/.test(pin)||!t)return bad("Host authorization required",401);
 try{
  const body=await req.json() as {index?:unknown;responses?:unknown};
  const index=body.index,raw=body.responses;
  if(!Number.isInteger(index)||typeof index!=="number"||index<0||!Array.isArray(raw)||raw.length<1||raw.length>120)return bad("Submit 1 to 120 valid cards for this question");
  const responses:Answer[]=[];
  for(const x of raw){
    if(!x||!Number.isInteger(x.card)||x.card<1||x.card>60||!Number.isInteger(x.choice)||x.choice<0||x.choice>3)return bad("Invalid card number or answer");
    const source=x.card_source??x.format??"zokivo";
    if(source!=="zokivo"&&source!=="wayground")return bad("Invalid card type");
    responses.push({card:x.card,choice:x.choice,card_source:source});
  }
  if(new Set(responses.map(r=>r.card_source+":"+r.card)).size!==responses.length)return bad("Duplicate card identities",400);
  const sql=db(),sessions=await sql`SELECT host_token_hash FROM paper_sessions WHERE pin=${pin}`;
  if(!sessions.length||!same(sessions[0].host_token_hash,hash(t)))return bad("Not authorized",403);
  const json=JSON.stringify(responses);
  const result=await sql`WITH active AS(
    SELECT quiz_set_id FROM paper_sessions WHERE pin=${pin} AND status='playing' AND current_index=${index}
  ), q AS(
    SELECT correct_index FROM questions JOIN active ON questions.quiz_set_id=active.quiz_set_id AND questions.position=${index}
  ), incoming AS(
    SELECT * FROM jsonb_to_recordset(${json}::jsonb) AS x(card integer, choice smallint, card_source text)
  ), inserted AS(
    INSERT INTO paper_card_submissions(session_pin,question_index,card_source,card_number,choice,correct,points)
    SELECT ${pin},${index},incoming.card_source,incoming.card,incoming.choice,incoming.choice=q.correct_index,
           CASE WHEN incoming.choice=q.correct_index THEN 100 ELSE 0 END
    FROM incoming CROSS JOIN q
    ON CONFLICT(session_pin,question_index,card_source,card_number) DO NOTHING
    RETURNING card_source,card_number
  ) SELECT count(*)::integer AS saved FROM inserted`;
  if(result[0].saved===0){
    const active=await sql`SELECT 1 FROM paper_sessions WHERE pin=${pin} AND status='playing' AND current_index=${index}`;
    if(!active.length)return bad("This question is no longer accepting answers",409);
  }
  return Response.json({saved:result[0].saved,requested:responses.length},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("paper submit",e);return bad("Unable to submit paper answers",503)}
}
