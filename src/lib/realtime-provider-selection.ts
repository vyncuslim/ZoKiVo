import {createHash} from "node:crypto";
import {realtimeConfig} from "@/lib/realtime";

export type RealtimeTransport="neon"|"supabase";

/** One primary WebSocket per authenticated participant, and a standby provider.
 * Splitting by player (instead of by PIN) keeps large classrooms balanced.
 * Use a stable server-verified player UUID; never use a caller-provided value.
 */
export function realtimeProviders(kind:"quiz"|"paper",pin:string,participantId:string=pin):RealtimeTransport[]{
 const supabase=!!realtimeConfig();
 if(kind==="paper")return supabase?["supabase"]:[];
 const neon=process.env.ZOKIVO_NEON_REALTIME_ENABLED==="true"
  &&!!process.env.NEON_REALTIME_SECRET
  &&!!process.env.NEON_REALTIME_URL;
 if(!neon)return supabase?["supabase"]:[];
 if(!supabase)return ["neon"];
 // Automatically target 50/50 authenticated subscriptions when both providers are ready.
 // An explicitly configured 0 still forces Supabase-first for rapid rollback.
 const configured=process.env.ZOKIVO_NEON_REALTIME_PERCENT?.trim();
 const parsed=configured===undefined||configured===""?50:Number(configured);
 const percentage=Number.isFinite(parsed)?Math.max(0,Math.min(100,parsed)):0;
 const bucket=createHash("sha256").update("zokivo-participant-realtime:v2:"+kind+":"+pin+":"+participantId).digest().readUInt32BE(0)%100;
 return bucket<percentage?["neon","supabase"]:["supabase","neon"];
}
