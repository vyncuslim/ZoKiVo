import {db,hash,same,bad} from "@/lib/store";
export const runtime="nodejs";
type Answer={card:number;choice:number};
export async function POST(req:Request,{params}:{params:Promise<{pin:string}>}){
 const{pin}=await params,t=req.headers.get("x-host-token");
 if(!/^\d{6}$/.test(pin)||!t)return bad("Host authorization required",401);
 try{
  const body=await req.json() as {index?:unknown;responses?:unknown};
  const index=body.index,raw=body.responses;
  if(!Number.isInteger(index)||typeof index!=="number"||index<0||!Array.isArray(raw)||raw.length<1||raw.length>60)return bad("Provide 1 to 60 scanned cards for a valid question");
  const responses:Answer[]=[];
  for(const x of raw){if(!x||!Number.isInteger(x.card)||x.card<1||x.card>60||!Number.isInteger(x.choice)||x.choice<0||x.choice>3)return bad("Invalid card number or choice");responses.push({card:x.card,choice:x.choice})}
  if(new Set(responses.map(r=>r.card)).size!==responses.length)return bad("Duplicate card numbers",400);
  const sql=db(),sessions=await sql`SELECT host_token_hash FROM paper_sessions WHERE pin=${pin}`;
  if(!sessions.length||!same(sessions[0].host_token_hash,hash(t)))return bad("Not authorized",403);
  const json=JSON.stringify(responses);
  const result=await sql`WITH active AS(
    SELECT quiz_set_id FROM paper_sessions WHERE pin=${pin} AND status='playing' AND current_index=${index}
  ), q AS(
    SELECT correct_index FROM questions JOIN active ON questions.quiz_set_id=active.quiz_set_id AND questions.position=${index}
  ), incoming AS(
    SELECT * FROM jsonb_to_recordset(${json}::jsonb) AS x(card integer, choice smallint)
  ), inserted AS(
    INSERT INTO paper_submissions(session_pin,question_index,card_number,choice,correct,points)
    SELECT ${pin},${index},incoming.card,incoming.choice,incoming.choice=q.correct_index,
           CASE WHEN incoming.choice=q.correct_index THEN 100 ELSE 0 END
    FROM incoming CROSS JOIN q
    ON CONFLICT(session_pin,question_index,card_number) DO NOTHING
    RETURNING card_number
  ) SELECT count(*)::integer AS saved FROM inserted`;
  return Response.json({saved:result[0].saved,requested:responses.length},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("paper submit",e);return bad("Unable to submit paper answers",503)}
}
