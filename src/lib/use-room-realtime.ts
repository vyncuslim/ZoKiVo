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
     if(now-lastRefresh<250)return; // Throttle unsolicited messages, never trust payload.
     lastRefresh=now;latest.current.refresh();
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
   if(client){void client.removeAllChannels().catch(()=>{});client.realtime.disconnect()}
  };
 },[kind,pin]);
 return connected;
}
