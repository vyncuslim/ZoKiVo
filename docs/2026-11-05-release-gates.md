# ZoKivo P0 release gates — 2026-11-05

**Status: OPEN. Neither real Google login nor physical 20/100 school devices have passed.** PR #32 remains Draft. The production site, live Cloudflare WAF and databases remain untouched by this plan.

## A. Google OAuth — real account/browser required
1. In the existing **Mother Supabase** Auth project, verify Google is enabled. Google Cloud must redirect to Mother Supabase's /auth/v1/callback; Supabase in turn redirects to the ZoKivo application's /auth/callback.
2. In Mother Supabase Redirect URLs, allow the exact application callbacks for enabled hosts:
   - https://zokivo.xyz/auth/callback
   - https://www.zokivo.xyz/auth/callback
   - https://zokivo.vynalthai.com/auth/callback
   - https://zokivo.vercel.app/auth/callback
3. Custom QA previews require exact ZOKIVO_AUTH_ALLOWED_ORIGINS plus explicit corresponding Supabase redirect allowlist entries. Do not wildcard arbitrary preview hosts.
4. With an authorized disposable Google account in a real desktop and mobile browser: start OAuth from each host, complete consent, confirm final callback remains on the same host as the PKCE cookie, check authenticated /api/auth/me, refresh, visit /teacher, sign out, then verify /api/auth/me is unauthenticated. Never log an OAuth code, cookie, token or Google profile PII.
5. Check user-selected Teacher mode does NOT grant independently verified educator authority; app_metadata educator verification is separate.
**Gate:** 100% valid end-to-end login/out, refresh, and correct same-host callbacks across every enabled public host. A 307 redirect by itself is not a real login PASS.

## B. Cloudflare 403/429 — find and safely split offending rule
The prior 2026-10-17 historical evidence in vyncuslim/vynalth-cloudflare-edge/docs/zokivo-guarded-waf-remediation.md identifies rule 5704ae8e4b2a4460b4ad8d31a7353d4b. Its then-current setting counted IPs at 20 requests / 10 seconds across all zone /api paths and blocked ZoKivo 100-player operations. The **current Cloudflare rule has not been reread**.
1. Filter Security Events to ZoKivo host, timestamp, Ray ID, 403/429, and affected API path; identify WAF source, specific rule, zone/account scope, GPS/school policy, and whether request reached the Worker/origin.
2. Read current expression, counting_expression, characteristics, requests_per_period, period, mitigation_timeout and precedence. If the rule remains shared, narrow only its **reviewed shared-host expression** and create a separate ZoKivo-scoped classroom rule. Preserve Vynova, authentication limits, WAF, GPS and school restrictions.
3. Consider Cloudflare IP with NAT support for classroom shared public IPs, but measure actual cookies and request rates first. Visitors without _cfuvid may still share a counter. Never use an unverified user-provided token as a trusted rate key.
4. Do not force the existing guarded WAF edit script against a broad shared rule: it correctly rejects unsafe cases.
5. Use scripts/qa-auth-edge-smoke.mjs for at most nine serial read-only GETs, with first-403/429 stop, and retain sanitized Ray IDs. Do not confuse that with a full Security Events audit.
**Gate:** eligible classroom requests are not incorrectly blocked, while unauthorized abuse still produces appropriate denials. No blanket skip or unrestricted WAF disable.

## C. Actual localhost HTTP 20/100 sessions with isolated QA Neon
The existing manual workflow .github/workflows/manual-qa-1000-isolated.yml now accepts input RUN_CLASSROOM_20_100_QA_ONLY on branch fix/p0-classroom-security-20261105.
- Protected environment: zokivo-loadtest-qa, secrets ZOKIVO_QA_DATABASE_URL and ZOKIVO_QA_SESSION_SECRET.
- Enforces an isolated Neon hostname and required QA marker exclusive-qa-1000-20261020 before any writes.
- Targets only localhost:3000. Realtime and Cloudflare Edge explicitly off. No production writes or billable public traffic.
- Runs 20 unique session joins, authenticated room reads, answer writes, persisted-score reconciliation and settled leaderboard, then repeats with 100 unique sessions.
- Records per-stage HTTP status and P95/P99, without tokens or personal names.
**Gate:** both sizes have all sessions, zero failed writes, exact score reconciliation, and strict measured latency targets. This is NOT physical device evidence. QA credentials/environment availability and manual run remain unverified.

## D. Physical 20, then 100 school device acceptance
Obtain teacher/school IT permission and use disposable questions plus minimum necessary data. Do not bypass school GPS, WAF or authentication. Start with 20 devices and do not escalate unless all eligible traffic succeeds; use a fresh room for 100 students.
Record operating system/browser/mobile carrier, school NAT, join success, duplicate nickname and 101st-player refusal, answer exactly once, leaderboard reconciliation, reconnect/resume, WebSocket/poll fallback, 403/429 with Ray IDs and P95/P99 timings.
**Proposed thresholds, NOT achieved results:** zero unauthorized disclosures, zero lost/duplicated accepted answers, zero unexplained WAF blocks, 100% reconciled scores, join P95 below 3s, room-read and answer P95 below 2s.
**Gate:** 20 and 100 real device sessions completed on authorized networks, with dated evidence.

## E. Change control
Keep PR #32 in Draft until A–D have dated evidence and a reviewer approves. An isolated localhost pass never establishes Cloudflare or real device capacity. After owner approval, merge, confirm Production deployment commit, perform low-volume post-deploy login and guest smoke, and retain both Vercel and WAF rollback plans. Do not claim 1M real Cloudflare sessions from 10k local sockets.
