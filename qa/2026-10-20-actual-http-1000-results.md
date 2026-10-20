# ZoKivo: Real authenticated 1,000-player API load result

**Test date:** 2026-10-20 UTC, observed completion 02:46:51Z
**Overall verdict:** FAIL (latency SLO), PASS (answer and score integrity)
**Scope:** Dedicated Vercel **Preview build-time** Next.js `next start` on localhost with isolated Neon **Preview branch** `br-muddy-king-b36czqzt`.
**Evidence:** Vercel Preview build `dpl_6aFsGuDLfmMrtDi3oQPJ4jVZANHd`, `QA_FINAL_REPORT` and `QA_PERFORMANCE_ACCEPTANCE` log entries.

## Test design
- 10 synthetic game rooms × 100 unique player sessions.
- 1,000 *actual HTTP* join requests (worker pool limit 25).
- Four 100/250/500/1,000 **simultaneous authenticated room GET** bursts.
- Two game rounds with 1,000 answer POSTs each (up to 120 in-flight writes), plus 1,000 state reads and 1,000 settled score reads per round.
- 10% session reconnect sample per round, 200 GETs.
- Live Postgres final answer count and per-room score reconciled for both rounds.
- QA database guard verified before any writes. QA-only session secret generated in Vercel Preview build process; no user/Production secret entered or transferred.

## Actual HTTP measurements

| Operation | Requests | Successful | Failed | P50 ms | P90 ms | P95 ms | P99 ms | Max ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Join | 1,000 | 1,000 | 0 | 329 | 337 | 343 | 873 | 1,116 |
| During-round state read | 2,000 | 2,000 | 0 | 992 | 1,103 | 1,333 | 1,428 | 1,490 |
| Answer write | 2,000 | 2,000 | 0 | 508 | 720 | 982 | 1,046 | 1,072 |
| Settled leaderboard read | 2,000 | 2,000 | 0 | 1,148 | 1,244 | 1,325 | 1,555 | 1,622 |
| Reconnect state read | 200 | 200 | 0 | 1,139 | 1,182 | 1,193 | 1,199 | 1,200 |
| Concurrent 100 GET | 100 | 100 | 0 | 1,251 | 1,314 | 1,325 | 1,348 | 1,363 |
| Concurrent 250 GET | 250 | 250 | 0 | 1,613 | 1,888 | 1,921 | 1,952 | 2,089 |
| Concurrent 500 GET | 500 | 500 | 0 | 2,331 | 3,322 | 3,368 | 3,382 | 3,399 |
| Concurrent 1,000 GET | 1,000 | 1,000 | 0 | 2,411 | 3,965 | 4,127 | 4,319 | 4,324 |

**Total HTTP:** 9,050 successful / 9,050 (1,000 + 2,000 + 2,000 + 2,000 + 200 + 100 + 250 + 500 + 1,000).
**HTTP 429/5xx/timeouts:** None observed in this Preview-local test.
**Postgres integrity:** Both rounds PASS; exactly 100 answers per room per round, 2,000 persisted answers; 50% correct in each classroom, per-room total points 10,000 after round two, no duplicate or missing scores.
**Observed run duration:** 97 seconds.

## SLO verdict
- Join P95 < 2,000 ms: PASS.
- Answer write P95 < 1,000 ms: PASS (982 ms).
- State read P95 < 1,000 ms: **FAIL** (1,333 ms).
- Settled leaderboard P95 < 1,000 ms: **FAIL** (1,325 ms).
- Reconnect P95 < 1,000 ms: **FAIL** (1,193 ms).
- 1,000 concurrent state reads P95 < 1,000 ms: **FAIL** (4,127 ms).
- 1,000 concurrent state reads P99 < 2,000 ms: **FAIL** (4,319 ms).
- Persisted answer integrity: PASS (2,000/2,000).

**Conclusion:** This test does NOT certify 1,000-player lag-free gameplay. High-concurrency room GET is the current observed bottleneck. The QA Preview build deliberately exited nonzero because its strict P95/P99 thresholds were violated. This is a successful *test execution* with a **failed performance acceptance**.

## Limitations
This load generator and Next.js instance ran in the Vercel **build worker**, not the Production Vercel Serverless topology. Neon Preview compute tier may differ from Production. No Cloudflare edge routing, browser rendering, Neon/Supabase WebSocket fanout, or actual 1,000 independently connected phones were tested. The client app's perceived lag may differ from these server timings.

## Suggested follow-up
Profile the `GET /api/rooms/[pin]` hot path, which currently performs multiple DB round trips per request. Reduce redundant shared room score/question queries via short-lived coalesced per-room read snapshots with explicit consistency tests. Re-run precisely the same Preview QA benchmark for an A/B comparison, then test official preview serverless and Realtime with separate authorized credentials. Never infer a Production SLA from this build-worker result.

> Safety: QA-only branch; **do not merge** temporary `postbuild` load generator into Production.
