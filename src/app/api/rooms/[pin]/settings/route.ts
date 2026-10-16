import {db,bad} from "@/lib/store";
export const runtime="nodejs";
export async function GET(_req:Request,{params}:{params:Promise<{pin:string}>}){
 const {pin}=await params;
 if(!/^\d{6}$/.test(pin))return bad("Invalid PIN");
 try{
  const sql=db();
  const rows=await sql`SELECT status,allow_late_joining,random_player_names FROM rooms WHERE pin=${pin}`;
  if(!rows.length)return bad("Room not found",404);
  return Response.json({
   acceptingPlayers:rows[0].status==="lobby"||(rows[0].status==="playing"&&rows[0].allow_late_joining),
   randomNames:!!rows[0].random_player_names
  },{headers:{"Cache-Control":"no-store"}});
 }catch{return bad("Unable to check room settings",503)}
}
