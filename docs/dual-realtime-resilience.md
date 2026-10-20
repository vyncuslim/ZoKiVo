# ZoKivo Realtime resilience — Neon + Supabase

## Scope and rollout
The existing **Mother Supabase Auth** is unchanged. Neon PostgreSQL remains the *single source of truth* for game state and scores. This change adds one possible **read-only realtime transport**; it does not duplicate game writes into two databases.

- **Primary/backup:** Each verified host or player uses one websocket transport at a time. If it fails, the client closes it and tries the secondary provider. A single room may have subscribers on both Neon and Supabase; Neon sees authorized database updates while Supabase receives the existing room refresh notice. Authenticated HTTP polling remains available throughout.
- **Supabase** sends existing minimal refresh notices to its room topic. No score or answer payloads.
- **Neon Realtime (Public Beta)** subscribes to one strictly parameterized, server-sealed SQL query returning only room PIN, status, current question index, and aggregated submitted-answer count. Server validates existing Host or player session before issuing short-lived sealed capabilities. No student names, answers, correct indices, points, or secrets are sent through the live query.
- **Automatic 50/50 participant routing:** Once Neon is explicitly enabled and both transports are configured, `ZOKIVO_NEON_REALTIME_PERCENT=50` uses a stable SHA-256 hash of the room and *server-verified player identity*. Approximately half of **connections**, including within large classrooms, prefer Neon and half prefer Supabase. The host has a separate stable allocation identity. No manual per-room assignment is required. Each participant establishes only one primary WebSocket; the other provider is tried if the first fails. Small samples are not guaranteed an exact 50/50 split.
- **Circuit handling:** Each provider has a 7 s connection timeout; unhealthy primary is dropped before the secondary is tried. Both down => authenticated HTTP polling with 30 s retry backoff.
- **Coalescing:** frontend limits bursts of room-update signals and always asks the authenticated room HTTP API for authoritative state.
- **No double broadcasting / scoring:** Database API remains sole grading authority, and two providers do not duplicate writes.

## Environment rollout (Vercel server-only vars)

```dotenv
NEON_REALTIME_URL=https://<Neon-provided-invocation-url>/
NEON_REALTIME_SECRET=<Neon-provided-secret>
ZOKIVO_NEON_REALTIME_ENABLED=false
ZOKIVO_NEON_REALTIME_PERCENT=50
```

Never use a `NEXT_PUBLIC_` variable for a Neon secret. Fetch from **Neon Production -> Postgres database -> Realtime**, or `neon env pull --service realtime`; store in Vercel encrypted environment settings, not GitHub or chat. Add the public Live SQL endpoint only to the server-side variable and verify its hostname. Supabase credentials remain as before.

Production ramp:
1. Keep `ZOKIVO_NEON_REALTIME_ENABLED=false` (default), deploy and pass existing CI. Observe that existing Supabase subscriptions still work.
2. Enable in QA/staging and run two independent roles against each provider; ensure an unauthorized user cannot obtain sealed capability.
3. Controlled first production canary: `ZOKIVO_NEON_REALTIME_ENABLED=true`, `ZOKIVO_NEON_REALTIME_PERCENT=5`. Deploy off-hours, verify no new error rate/PII disclosure, then move to 20 / 50 only after real metrics. At 50, allocation is fully automatic per verified player; there is nothing to assign manually.
4. Load-test 10 isolated rooms × 100 distinct clients, with each room explicitly attributed to provider. Verify p50/p90/p95 time to fetch game state, answer submission, websocket recovery and observed scoreboard convergence. Continue monitoring over 30 minutes.
5. Failback to Supabase instantly by setting `ZOKIVO_NEON_REALTIME_ENABLED=false` and redeploying. Do not rotate or disable shared database or authentication for this.

## Performance SLO proposal
- At least **90% of player interactions** settle in under **1,000 ms** for the authenticated HTTP request.
- 95% of scoreboard updates converge within **2 seconds**, with no incorrect/duplicate scores.
- >= 99.9% of eligible answer writes succeed (excluding deliberate duplicate submissions and invalid sessions).
- 100% final score/answer integrity against the DB.
These are *targets*, not guaranteed outcomes. Measure actual player UX on devices and school networks, not only 1,000-VU homepage traffic. Realtime does not remove Cloudflare WAF or Vercel API limits.

## Cloudflare third layer — future option
For bursty classroom gameplay, a room-bound Cloudflare **Durable Object** with WebSocket Hibernation can coordinate and broadcast minimal room-update notices to clients. Consider it only after real Supabase/Neon measurements. Treat DO as ephemeral transport/room coordinator, not as an independent scoring database. Verify every websocket connection's session at the edge with the existing trusted host/player verification service. Persist all scores to Neon in an idempotent manner. Review Cloudflare costs and migration safety before provisioning.

## Beta and authorization cautions
Neon Realtime beta has no published performance SLA, no Realtime-native RLS yet, and may change protocol; use only the supported `@neon/realtime` SDK. Its sealed query is a short-lived bearer capability and must never enter logs or URLs. Do not publish unrestricted SQL. Supabase Realtime usage quotas must be checked separately.

## Current state
The feature is **OFF by default** unless the server explicitly enables Neon and has both Neon credentials configured. Once enabled, the server automatically chooses an initial provider for each verified participant. This is **static proportional assignment with health-triggered client failover**, not measured adaptive load balancing or dynamic congestion pricing. A 50/50 *configuration* does not establish 50/50 working live sockets until environment credentials, provider limits, and real WebSocket sessions are verified. Backend Neon service enabled != frontend live connection successfully commissioned.
