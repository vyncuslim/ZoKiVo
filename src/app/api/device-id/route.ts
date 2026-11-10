import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// First-party fallback when an applicable Cloudflare Worker route is absent.
// A browser Device ID is not an authenticated account or hardware identifier.
const allowedHosts = new Set(["zokivo.xyz","www.zokivo.xyz"]);
const COOKIE = '__Host-vyn_edge_device';
const TTL = 90 * 86400;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respond(body: Record<string,unknown>, status=200) {
  const res=NextResponse.json(body,{status});
  res.headers.set('Cache-Control','private, no-store, max-age=0');
  res.headers.set('Referrer-Policy','no-referrer');
  res.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  res.headers.set('X-Content-Type-Options','nosniff');
  res.headers.set('Cross-Origin-Resource-Policy','same-origin');
  res.headers.set('Vary','Cookie');
  return res;
}
function validCookie(token:string,key:Buffer,now:number) {
  if(token.length>512) return null;
  const p=token.split('.');
  if(p.length!==4||p[0]!=='e1'||!UUID.test(p[1])||!/^\d{10}$/.test(p[2])) return null;
  const when=Number(p[2]);
  if(when<=0||when>now+300||now-when>TTL) return null;
  const payload=['e1',p[1].toLowerCase(),p[2]].join('.');
  const expected=crypto.createHmac('sha256',key).update(payload).digest();
  const actual=Buffer.from(p[3],'base64url');
  if(actual.length!==expected.length||actual.toString('base64url')!==p[3]) return null;
  return crypto.timingSafeEqual(actual,expected) ? {id:p[1].toLowerCase(),issued:when} : null;
}
export async function GET(req:NextRequest) {
  const host=String(req.headers.get('host')||'').toLowerCase().split(':')[0];
  if(!allowedHosts.has(host))return respond({error:'UNKNOWN_DEVICE_HOST'},421);
  if(req.headers.get('sec-fetch-site')==='cross-site') return respond({error:'SAME_ORIGIN_REQUIRED'},403);
  const origin=req.headers.get('origin');
  if(origin && origin !== 'https://'+host) return respond({error:'ORIGIN_MISMATCH'},403);
  const secret=String(process.env.EDGE_DEVICE_ID_SIGNING_SECRET||'');
  if(secret.length<32) return respond({enabled:false,error:'SIGNER_UNAVAILABLE'},503);
  const key=crypto.createHash('sha256')
    .update('vynalth-domain-device:key-derivation:v1:'+secret+':'+host).digest();
  const now=Math.floor(Date.now()/1000);
  const parsed=validCookie(req.cookies.get(COOKIE)?.value||'',key,now);
  const id=parsed?.id||crypto.randomUUID();
  const mode=parsed ? now-parsed.issued>=30*86400?'rotated':'valid':'issued';
  const res=respond({
    enabled:true,scope:'host-only',host,deviceId:id,
    signedAndVerified:mode!=='issued',credentialState:mode,
    accountLinked:false,hardwareIdentityVerified:false,
    note:'A signed browser credential is not account authentication, a hardware ID, or a universal cross-site identifier.'
  });
  if(mode!=='valid'){
    const payload='e1.'+id+'.'+now;
    const token=payload+'.'+crypto.createHmac('sha256',key).update(payload).digest('base64url');
    res.cookies.set(COOKIE,token,{path:'/',maxAge:TTL,httpOnly:true,secure:true,sameSite:'lax',priority:'high'});
  }
  return res;
}
