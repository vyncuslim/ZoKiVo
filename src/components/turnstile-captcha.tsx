"use client";
import {useEffect,useRef,useState} from "react";

type TurnstileAPI={
 render:(element:HTMLElement,options:{
  sitekey:string;theme:"auto";callback:(token:string)=>void;
  "expired-callback":()=>void;"error-callback":()=>void;
 })=>string;
 remove:(widgetId:string)=>void;
};
type TurnstileWindow=Window&{turnstile?:TurnstileAPI};

/** Supabase verifies the one-use CAPTCHA token; never send the Turnstile secret to this component. */
export function TurnstileCaptcha({siteKey,onToken}:{siteKey:string;onToken:(token:string)=>void}){
 const container=useRef<HTMLDivElement>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!siteKey)return;
  let active=true,widgetId:string|undefined;
  const page=window as TurnstileWindow;
  let script=document.querySelector<HTMLScriptElement>('script[data-zokivo-turnstile="true"]');
  if(!script){
   script=document.createElement("script");
   script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
   script.async=true;script.defer=true;script.dataset.zokivoTurnstile="true";
   document.head.appendChild(script);
  }
  function render(){
   if(!active||widgetId||!page.turnstile||!container.current)return;
   try{
    widgetId=page.turnstile.render(container.current,{
     sitekey:siteKey,theme:"auto",
     callback:token=>{if(active){setFailed(false);onToken(token)}},
     "expired-callback":()=>{if(active)onToken("")},
     "error-callback":()=>{if(active){onToken("");setFailed(true)}}
    });
   }catch{if(active)setFailed(true)}
  }
  const onFailure=()=>{if(active){setFailed(true);onToken("")}};
  script.addEventListener("load",render);
  script.addEventListener("error",onFailure);
  render();
  // A previously injected script might still be loading when this component mounts.
  const poll=window.setInterval(()=>{render();if(widgetId)window.clearInterval(poll)},200);
  return()=>{
   active=false;window.clearInterval(poll);
   script?.removeEventListener("load",render);script?.removeEventListener("error",onFailure);
   if(widgetId)page.turnstile?.remove(widgetId);
  };
 },[siteKey,onToken]);
 return <div className="auth-captcha" aria-label="Security verification">
  <div ref={container}/>
  {failed&&<p role="alert">Security verification could not load. Check your connection or content blocker and reload the page.</p>}
 </div>;
}
