# ZoKivo 1,000-player classroom optimization — 2026-10-22

## Status
**Classroom API SLO (1,000 authenticated active players, 700ms deterministic refresh spread): PASS.**

**Adversarial 1,000 same-millisecond GET burst under one isolated Next.js process: FAIL.**

This distinction is intentional: a 1,000-person *playing* workload and a 1,000-request instantaneous stampede are different arrival patterns. The production app now applies stable player-specific jitter to suppress that stampede.

## Isolated test setup
- Real Next.js production-mode HTTP server in a Vercel Preview build worker
- Dedicated Neon Preview branch with verified `zokivo_qa_sandbox_guard` marker
- 10 disposable classrooms × 100 independently authenticated test players
- 2 full answer rounds and PostgreSQL score/answer reconciliation
- No production student rooms or accounts touched
- No Production Cloudflare routing, distributed Vercel Serverless scale or WebSocket latency measured

## Results, milliseconds

| Operation | Count | Success | P95 | P99 |
|---|---:|---:|---:|---:|
| Join | 1,000 | 1,000 | 463 | 1,095 |
| Round status | 2,000 | 2,000 | 465 | 470 |
| Answer submit | 2,000 | 2,000 | 902 | 971 |
| Settled scoreboard | 2,000 | 2,000 | 464 | 468 |
| Reconnect state | 200 | 200 | 479 | 486 |
| 1,000 players, 700ms refresh spread | 1,000 | 1,000 | **876** | **906** |
| 1,000 simultaneous state requests | 1,000 | 1,000 | **1,537** | 1,573 |

Strict instantaneous burst P95 target is <1,000ms: NOT MET.
Classroom latency target is P95 <1,000ms per operation: MET in this isolated run.
All 2,000 answers in Neon match expected persisted grades/points; no 429/5xx observed locally.

### Before/after for the exact same adversarial burst
- Before performance changes: **P95 4,127ms**, P99 4,319ms.
- After coalesced room query only: P95 1,759ms, P99 1,774ms.
- After signed room read and atomic answer: P95 1,333ms, P99 1,392ms in one run.
- After player-specific jitter (which does not change instant request semantics): P95 1,537ms, P99 1,573ms for instant burst. Sampling variability matters; do not compare runs as deterministic.
- With 700ms event spread: P95 876ms, P99 906ms.

## Architecture
- Per-user read-only HMAC capability minted only following a successful database join, scoped to PIN and UUID for one hour.
- GET validates HMAC and checks player membership against at-most-200ms-old room snapshot. Answer writes require original DB-authenticated player token; read proof cannot write or read Host-only results.
- Shared room leaderboard and answer summary are recomputed at most once per 200ms per Node isolate. This is NOT globally distributed cache: Vercel serverless multi-isolate behavior differs.
- One atomic SQL for write authorization, unique answer insert and score award, with optional score-goal settlement only when configured.
- Realtime notifications spread over 700ms and periodic fallback polling starts staggered by up to 1,500ms, while initial page load remains immediate.

## What remains to certify real Production 1,000-user play
1. Live 1,000-player browser/WebSocket test with Neon/Supabase failover (provisioning and quota checks).
2. Controlled Vercel Preview **serverless** and Cloudflare/WAF path tests with dedicated QA rooms (not localhost build-only).
3. Malaysia device and network samples and leaderboards P95 sync under 2 seconds.
4. Exact simultaneous 1,000-request burst P95 still >1,000ms in one-process benchmark. Production autoscaling and abuse-rate limits require independent verification.

**No absolute 100% smoothness guarantee or global production capacity certification is claimed.**
