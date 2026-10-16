"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
export function AuthNav(){
 const [signedIn,setSignedIn]=useState(false);
 useEffect(()=>{let mounted=true;void fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(j=>{if(mounted)setSignedIn(!!j?.authenticated)}).catch(()=>{});return()=>{mounted=false}},[]);
 return signedIn?<Link className="nav-auth" href="/account">My account ↗</Link>:<Link className="nav-auth" href="/auth/login">Sign in ↗</Link>;
}
