# ZoKivo Room Edge Realtime — Million-connection readiness pilot

**Status: CODE ONLY / OFF / NO CLOUD DEPLOYMENT / ZERO VERIFIED REAL SOCKETS.**
This is one stage toward 1,000,000 real connected students and sub-2-second leaderboard convergence. It is **NOT a claim that one million connections have been tested**.

## What was implemented

- `edge-realtime/worker.mjs`: Cloudflare Worker with a Durable Object **per quiz room**, WebSocket Hibernation, up to 128 active sockets per DO as a safety guard (game room still limited to 100 players).
- `src/app/api/realtime/edge/route.ts`: checks stored database player-token or Host token, issues **120-second read-only capability**, scoped to a six-digit PIN. Secret never shipped to browser.
- The browser sends the short-lived capability in the WebSocket **subprotocol header**, not in the URL. Neither Player nor Host can submit answers through this socket. Worker enforces an explicit Origin allowlist; other origins and unsigned sockets are rejected.
- `src/lib/realtime.ts`: server-signed, narrowly scoped `POST /notify` happens only **after successful persisted quiz actions** and only in Edge-selected rooms; existing Supabase notice is fallback on notification failure. Durable Object batches notifications via alarm and sends only `{"type":"refresh","revision":N,"v":1}`.
- `src/lib/use-room-realtime.ts`: Client automatically prefers the optional Edge socket where enabled; on disconnect it uses existing Neon/Supabase failover and existing HTTP polling. No duplicate score writes.
- `src/lib/edge-realtime-auth.ts`: **default-off** deterministic room-level canary. At 1% the same sampled room sends all its participants to Edge, avoiding split fanout and wasting resources in unsampled rooms. Remaining rooms retain the existing Neon/Supabase 50/50 per-player preference.
- `scripts/verify-edge-realtime.cjs`: offline protocol checks for compatible HMAC signatures, cross-room and cross-origin isolation, invalid/stale notifications, Durable Object batching, and failover wiring. **Does not open real WebSockets.**

## Rollout — NOT AUTHORIZED YET

Review costs, quotas, abuse controls, account access, and a staged deployment of `edge-realtime/wrangler.toml`. `workers_dev = false` deliberately disables a public preview URL until a reviewed Worker route/custom domain is configured. Durable Objects availability, cost, regional latency and throughput must be checked on the actual Cloudflare account.

In Cloudflare use a securely generated secret stored as **`EDGE_REALTIME_SECRET`**. In Vercel use the **identical** secret under **`ZOKIVO_EDGE_REALTIME_SECRET`**; **do not commit secrets or paste them in chat**.

Only after Worker has a properly protected public HTTPS address and account authorization, configure Vercel:

```dotenv
ZOKIVO_EDGE_REALTIME_ENABLED=true
ZOKIVO_EDGE_REALTIME_PERCENT=1
ZOKIVO_EDGE_REALTIME_URL=https://<reviewed-edge-domain>
ZOKIVO_EDGE_REALTIME_SECRET=<server-only shared secret>
```

`ZOKIVO_EDGE_REALTIME_PERCENT=0` is immediate safe default; server emits zero Edge notifications with 0%. `ZOKIVO_EDGE_REALTIME_ENABLED=false` is another rollback flag. Increase 1 → 5 → 20 → 100 **only after** authenticated real socket smoke tests and error/latency evidence. A production rollout is **not part of this PR**.

Adjust Worker `ALLOWED_ORIGINS` only for exact approved ZoKivo origins. The subprotocol capability is a bearer credential visible to WebSocket infrastructure; ensure header logs do not retain it. Shared secret rotation immediately invalidates new handshakes; existing connections require explicit disconnection if revocation is necessary.

## Scale math, not certification

- ZoKivo gameplay cap remains 100 players per room. **1,000,000 / 100 = 10,000 room Durable Objects** in a fully allocated layout.
- At 50/50 without Edge, Neon and Supabase would each require **~500,000 simultaneously connected clients**. That is far beyond ordinary Supabase per-project limits. See https://supabase.com/docs/guides/realtime/limits.
- Cloudflare currently documents 32,768 sockets as an API maximum per object, but **CPU, memory, account quotas, fanout and billing** will limit real supported capacity. Our design intentionally uses at most 128, rather than one million sockets per object. See https://developers.cloudflare.com/durable-objects/api/state/#acceptwebsocket.
- If all one million users submit an answer in two seconds, that's **500,000 authenticated database writes/second**, which **is not solved by WebSocket fanout**. No proof the Neon database or Vercel answer API can handle this. Room-sharded write scaling, admission control, idempotency and capacity reservations need separate work.
- Notification batching on DO reduces websocket fanout *per room*, but as currently implemented it still requires one server-to-edge notify HTTP request **per successful answer**. True million-answer bursts would require a durable outbox/queue and aggregation upstream.

## Uncertified until real tests

1. Worker end-to-end connection and notification test with real Cloudflare staging Durable Object.
2. Independent load generators: 1k → 10k → 100k → 1M real socket handshakes and steady sessions, approved billing, explicit abort limits.
3. 10,000 independent rooms, verified isolation and reconnection storms.
4. 2-second P95 **leaderboard convergence** measured from answer commit to actual client receipt, 100% scoring accuracy.
5. Serverless Vercel API and Neon database saturated-answer tests, load-shedding behavior, 429/5xx, quotas and costs.
6. Browser/device observations across regions including Malaysia.

**Current honest verdict: Implementation pilot available, real million-client capacity and 2s latency still NOT CERTIFIED.**
