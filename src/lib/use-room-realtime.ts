"use client";
import {useEffect,useRef,useState} from "react";
import {createClient} from "@supabase/supabase-js";
import {createRealtimeClient,type SealedLiveQuery} from "@neon/realtime/client";
import type {RoomKind} from "@/lib/realtime";

type Transport="neon"|"supabase";
type RoomMeta={pin:string;status:string;current_index:number;submitted:number};
type Plan={providers?:Transport[]};

/**
 * Select ONE live provider at a time; use the other only as failover.
 * Supabase sends refresh notices and Neon watches an authorized minimal SQL
 * projection. The authenticated room GET is always authoritative.
 * Polling remains active when both providers are disconnected.
 */
export function useRoomRealtime(kind:RoomKind,pin:string,getHeaders:()=>Record<string,string>,refresh:()=>void){
 const latest=useRef({getHeaders,refresh});
 latest.current={getHeaders,refresh};
 const [connected,setConnected]=useState(false);

 useEffect(()=>{
  if(!/^\d{6}$/.test(pin))return;
  let active=true;
  let fallbackTimer:ReturnType<typeof setTimeout>|null=null;
  let refreshTimer:ReturnType<typeof setTimeout>|null=null;
  let lastRefresh=0;
  let transitioning=false;
  let cleanupProvider=()=>{};
  let fallback:Transport[]=[];
  let original:Transport[]=[];

  const refreshCoalesced=()=>{
   if(!active)return;
   const now=Date.now(),interval=kind==="quiz"?1500:250;
   const delay=Math.max(0,interval-(now-lastRefresh));
   if(delay===0&&!refreshTimer){
    lastRefresh=now;latest.current.refresh();
   }else if(!refreshTimer){
    refreshTimer=setTimeout(()=>{
     refreshTimer=null;
     if(active){lastRefresh=Date.now();latest.current.refresh()}
    },delay||25);
   }
  };

  const loseProvider=()=>{
   if(!active||transitioning)return;
   transitioning=true;
   cleanupProvider();cleanupProvider=()=>{};
   setConnected(false);
   fallbackTimer=setTimeout(()=>{
    fallbackTimer=null;transitioning=false;void attemptNext();
   },1100);
  };

  async function connectSupabase():Promise<(()=>void)|null>{
   let client:ReturnType<typeof createClient>|null=null;
   let cleanup=()=>{};
   try{
    const query=new URLSearchParams({kind,pin}).toString();
    const result=await fetch("/api/realtime/config?"+query,{headers:latest.current.getHeaders(),cache:"no-store"});
    if(!result.ok||!active)return null;
    const config=await result.json();
    if(!config.enabled||typeof config.topic!=="string"||typeof config.url!=="string"||typeof config.publishableKey!=="string")return null;
    client=createClient(config.url,config.publishableKey,{
     auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    const channel=client.channel(config.topic,{config:{private:false}});
    let established=false;
    let settled=false;
    let done:(value:boolean)=>void=()=>{};
    const ready=new Promise<boolean>(resolve=>{done=resolve});
    const watchdog=setTimeout(()=>{if(!settled){settled=true;done(false)}},7000);
    channel.on("broadcast",{event:"refresh"},()=>refreshCoalesced());
    channel.subscribe(status=>{
     if(!active)return;
     if(status==="SUBSCRIBED"){
      established=true;
      if(!settled){settled=true;done(true)}
      refreshCoalesced();
     }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
      if(!settled){settled=true;done(false)}
      else if(established)loseProvider();
     }
    });
    cleanup=()=>{
     clearTimeout(watchdog);
     if(client){void client.removeAllChannels().catch(()=>{});client.realtime.disconnect()}
    };
    if(!(await ready)||!active){cleanup();return null}
    clearTimeout(watchdog);
    return cleanup;
   }catch{
    cleanup();
    if(client){void client.removeAllChannels().catch(()=>{});client.realtime.disconnect()}
    return null;
   }
  }

  async function connectNeon():Promise<(()=>void)|null>{
   let cleanup=()=>{};
   try{
    const response=await fetch("/api/realtime/neon?pin="+encodeURIComponent(pin),{
     headers:latest.current.getHeaders(),cache:"no-store"
    });
    if(!response.ok||!active)return null;
    const config=await response.json() as {
     enabled?:boolean;url?:string;query?:SealedLiveQuery<RoomMeta>
    };
    if(!config.enabled||!config.url||!config.query)return null;
    const client=createRealtimeClient({url:config.url});
    const subscription=client.subscribe(config.query);
    let settled=false,established=false;
    let done:(value:boolean)=>void=()=>{};
    const ready=new Promise<boolean>(resolve=>{done=resolve});
    const watchdog=setTimeout(()=>{if(!settled){settled=true;done(false)}},7000);
    const offChange=subscription.onChange(snapshot=>{
     if(!active)return;
     if(snapshot.status==="live"){
      if(!settled){settled=true;done(true)}
      else refreshCoalesced();
      established=true;
      refreshCoalesced();
     }
    });
    const offState=subscription.onStateChange(state=>{
     if(!active)return;
     if(state.status==="error"||state.status==="closed"){
      if(!settled){settled=true;done(false)}
      else if(established)loseProvider();
     }
    });
    cleanup=()=>{
     clearTimeout(watchdog);
     offChange();offState();
     subscription.unsubscribe();
     client.close();
    };
    if(!(await ready)||!active){cleanup();return null}
    clearTimeout(watchdog);
    return cleanup;
   }catch{cleanup();return null}
  }

  async function attemptNext(){
   if(!active)return;
   while(active&&fallback.length){
    const candidate=fallback.shift();
    const cleanup=candidate==="neon"?await connectNeon():await connectSupabase();
    if(cleanup&&active){
     cleanupProvider=cleanup;
     setConnected(true);
     refreshCoalesced();
     return;
    }
    cleanup?.();
   }
   if(!active)return;
   setConnected(false);
   // Do not reconnect-loop on every failure: authenticated HTTP polling survives.
   fallbackTimer=setTimeout(()=>{
    fallbackTimer=null;
    fallback=[...original];
    void attemptNext();
   },30000);
  }

  void (async()=>{
   try{
    const request=new URLSearchParams({kind,pin}).toString();
    const response=await fetch("/api/realtime/plan?"+request,{
     headers:latest.current.getHeaders(),cache:"no-store"
    });
    if(response.ok){
     const plan=await response.json() as Plan;
     if(Array.isArray(plan.providers))
      original=plan.providers.filter((p):p is Transport=>p==="supabase"||p==="neon");
    }else{
     original=["supabase"]; // Existing authorized Supabase config handles fallback.
    }
   }catch{original=["supabase"]}
   if(!active)return;
   fallback=[...original];
   await attemptNext();
  })();

  return()=>{
   active=false;cleanupProvider();
   if(refreshTimer)clearTimeout(refreshTimer);
   if(fallbackTimer)clearTimeout(fallbackTimer);
   setConnected(false);
  };
 },[kind,pin]);
 return connected;
}
