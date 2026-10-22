import {NextResponse} from "next/server";
export const runtime="nodejs";
/** QA branch ONLY; deliberately does no Neon I/O or token verification. */
export async function GET(){
 if(process.env.VERCEL_ENV!=="preview"||
  process.env.VERCEL_GIT_COMMIT_REF!=="qa/instant-1000-prefetch-20261022")
  return NextResponse.json({error:"Not found"},{status:404});
 return new Response('{"ok":true}',{
  headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
 });
}
