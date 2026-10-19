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
 const percentage=Math.max(0,Math.min(100,Number(process.env.ZOKIVO_NEON_REALTIME_PERCENT)||0));
 const bucket=createHash("sha256").update("zokivo-room-realtime:"+pin).digest().readUInt32BE(0)%100;
 return bucket<percentage?["neon","supabase"]:["supabase","neon"];
}
