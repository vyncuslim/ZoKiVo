import {createHash} from "node:crypto";
import {realtimeConfig} from "@/lib/realtime";

export type RealtimeTransport="neon"|"supabase";

/** Stable per-room assignment; one live transport at a time. */
export function realtimeProviders(kind:"quiz"|"paper",pin:string):RealtimeTransport[]{
 const supabase=!!realtimeConfig();
 if(kind==="paper")return supabase?["supabase"]:[];
 const neon=process.env.ZOKIVO_NEON_REALTIME_ENABLED==="true"
  &&!!process.env.NEON_REALTIME_SECRET
  &&!!process.env.NEON_REALTIME_URL;
 if(!neon)return supabase?["supabase"]:[];
 if(!supabase)return ["neon"];
 // Default to the requested 50/50 room-level split once Neon is safely enabled.
 // An explicitly configured 0 still forces Supabase-first for rapid rollback.
 const configured=process.env.ZOKIVO_NEON_REALTIME_PERCENT?.trim();
 const parsed=configured===undefined||configured===""?50:Number(configured);
 const percentage=Number.isFinite(parsed)?Math.max(0,Math.min(100,parsed)):0;
 const bucket=createHash("sha256").update("zokivo-room-realtime:"+pin).digest().readUInt32BE(0)%100;
 return bucket<percentage?["neon","supabase"]:["supabase","neon"];
}
