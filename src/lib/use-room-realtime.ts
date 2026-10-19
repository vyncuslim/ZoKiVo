"use client";
import {useEffect,useRef,useState} from "react";
import {createClient} from "@supabase/supabase-js";
import type {RoomKind} from "@/lib/realtime";

/**
 * Supabase Broadcast is only a non-authoritative "refresh" signal.
 * Real game state always comes from ZoKivo's authenticated Neon-backed API.
 * Polling must remain available if Realtime is disabled/disconnected.
 */
export function useRoomRealtime(kind:RoomKind,pin:string,getHeaders:()=>Record<string,string>,refresh:()=>void){
 const latest=useRef({getHeaders,refresh});
 latest.current={getHeaders,refresh};
 const [connected,setConnected]=useState(false);
 useEffect(()=>{
  if(!/^\d{6}$/.test(pin))return;
  let active=true,client:ReturnType<typeof createClient>|null=null;
  let lastRefresh=0;
  let pendingTimer:ReturnType<typeof setTimeout>|null=null;
  // Coalesce bursts from up to 100 classmates into at most one refresh
  // per 1.5 seconds. Preserve a trailing refresh so the final event is seen.
  const attach=async()=>{
   try{
    const query=new URLSearchParams({kind,pin}).toString();
    const r=await fetch("/api/realtime/config?"+query,{headers:latest.current.getHeaders(),cache:"no-store"});
    if(!r.ok)return;
    const config=await r.json();
    if(!active||!config.enabled||typeof config.topic!=="string"||typeof config.url!=="string"||typeof config.publishableKey!=="string")return;
    client=createClient(config.url,config.publishableKey,{
     auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    const channel=client.channel(config.topic,{config:{private:false}});
    channel.on("broadcast",{event:"refresh"},()=>{
     if(!active)return;
     const now=Date.now();
     const minimumInterval=kind==="quiz"?1500:250;
     const remaining=minimumInterval-(now-lastRefresh);
     if(remaining<=0&&!pendingTimer){
      lastRefresh=now;latest.current.refresh();
     }else if(!pendingTimer){
      pendingTimer=setTimeout(()=>{
       pendingTimer=null;
       if(!active)return;
       lastRefresh=Date.now();
       latest.current.refresh();
      },Math.max(25,remaining));
     }
    });
    channel.subscribe(status=>{
     if(!active)return;
     setConnected(status==="SUBSCRIBED");
     if(status==="SUBSCRIBED")latest.current.refresh(); // Close the subscribe/fetch race.
    });
   }catch{if(active)setConnected(false)}
  };
  void attach();
  return ()=>{
   active=false;setConnected(false);
   if(pendingTimer)clearTimeout(pendingTimer);
   if(client){void client.removeAllChannels().catch(()=>{});client.realtime.disconnect()}
  };
 },[kind,pin]);
 return connected;
}
