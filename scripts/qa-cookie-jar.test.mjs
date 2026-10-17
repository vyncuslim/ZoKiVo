import test from "node:test";
import assert from "node:assert/strict";
import {newQaCookieJar} from "./qa-cookie-jar.mjs";
test("keeps independent region and Cloudflare NAT cookies",()=>{
 const jar=newQaCookieJar();
 jar.capture({getSetCookie:()=>[
  "__Host-vynalth-region=region1; Path=/; Secure; HttpOnly",
  "_cfuvid=distinct1; Path=/; Secure; HttpOnly"
 ]});
 assert.ok(jar.has("__Host-vynalth-region"));
 assert.ok(jar.has("_cfuvid"));
 assert.match(jar.header(),/\b_cfuvid=distinct1/);
 assert.match(jar.header(),/__Host-vynalth-region=region1/);
});
test("two synthetic players cannot share cookie state",()=>{
 const a=newQaCookieJar(),b=newQaCookieJar();
 a.capture({getSetCookie:()=>["_cfuvid=userA; Path=/"]});
 b.capture({getSetCookie:()=>["_cfuvid=userB; Path=/"]});
 assert.notEqual(a.header(),b.header());
});
test("removes expired cookies and preserves others",()=>{
 const j=newQaCookieJar();
 j.capture({getSetCookie:()=>["_cfuvid=userA; Path=/","__Host-vynalth-region=region1; Path=/"]});
 j.capture({getSetCookie:()=>["_cfuvid=; Max-Age=0; Path=/"]});
 assert.equal(j.has("_cfuvid"),false);
 assert.equal(j.has("__Host-vynalth-region"),true);
});
