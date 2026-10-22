# ZoKivo capacity program: 1,000 burst requests and 1,000,000 concurrent players

**Updated:** 2026-10-22. **Current status:** the 1,000-instant-request P95 <1s target has **PASS** in an isolated FOUR-origin QA build-worker test, but **NOT CERTIFIED in Production**. One million concurrent real connections remains NOT TESTED.

## Define the question and the performance target

A million people *online* is NOT a million people *answering at exactly the same instant*. In this project a game room supports at most **100 players**. One million concurrently connected students therefore requires at least **10,000 independent 100-player rooms**.

Three separate performance SLOs require real measurement:
1. **Instantaneous HTTP spike:** 1,000 genuinely simultaneous authenticated `GET /api/rooms/[pin]` requests, P95 <1,000ms. **PASS in four-process isolated QA:** 746ms P95, 1,110ms P99, all requests passed, with two correct scoring rounds; **Production Vercel Serverless remains unverified**.
2. **One-million online:** 1,000,000 real WebSocket clients across at least 10,000 rooms, steady-state **message delivery P95 <2,000ms**, integrity 100%, no overload and controlled reconnection. **NOT TESTED**.
3. **One-million answer burst:** if all players answer inside 2 seconds, **500,000 authenticated answer writes per second** plus realtime fanout. This is a separate write scalability project; **NOT TESTED** and not supported by any currently verified ZoKivo allocation.

**Target <2 seconds** must name the operation (join, answer commit, leaderboard delivery). A virtual routing test cannot establish network latency or capacity.

## Known measured results

| Benchmark | Observed P95 | Outcome |
|---|---:|---|
| Original real 1,000 simultaneous room GETs, isolated Next.js + Neon Preview | 4,127ms | FAIL |
| Single-process current Production code tested in QA | 1,537ms | FAIL (goal <1,000ms) |
| **Four parallel Next.js processes**, same private Preview DB and test host | **746ms** | **PASS in isolated QA**; 1,000/1,000 authorized GETs, 2,000/2,000 grades persisted |
| The same class of load against a trivial no-DB/no-auth Next.js endpoint | 1,209ms | FAIL, indicating substantial environment/HTTP transport overhead |
| 1,000-player 700ms-jittered game status GET (current Production code) | 876ms | PASS for **staggered classroom workload** ONLY |
| Real answer submissions, two rounds, current Production code | 902ms P95 | PASS in isolated run; 2,000/2,000 persisted and scored correctly |
| One million **virtual routing decisions** | See CI evidence | OFFLINE policy model only, not user traffic |

No production Vercel serverless concurrency, Cloudflare WAF, Supabase/Neon WebSocket fanout or Malaysian phone/browser latency certification is implied.

## Why current dual Realtime is insufficient for one million

The existing ZoKivo policy selects a Neon or Supabase primary **per verified player** (50/50 when both services are enabled) and switches to the secondary on failure. At 1,000,000 online players that means **approximately 500,000 client connections on each provider**. Supabase's published conventional tiers support 200/500/10,000 concurrent connections depending on plan, with higher custom limits requiring provider arrangements; actual ZoKivo quota is not verified. A single Neon Realtime beta endpoint cannot be assumed to accept 500,000 simultaneous subscribers without a published approved quota. These are not elastic, automatically shared pools.

Reverting all clients to HTTP polling can be even worse:
- polling every 5s → **200,000 room GET/s**
- polling every 3s → **333,334 room GET/s**
- answers in 2s → **500,000 POST/s**, if everyone answers in that window

These are planning calculations, not observed capacities.

## Recommended partitioned architecture — future rollout only

### WebSocket transport tier
Use a **Cloudflare Durable Object with WebSocket Hibernation per room**, initially **one DO/100-player room**. This would distribute one million students over about **10,000 independently addressable room objects**, rather than one Supabase or Neon realtime project carrying 500k WebSocket clients. Cloudflare documents hibernation for idle durable websocket state, but real quotas, billing and throughput must be verified for the exact account. DO placement and room ID must be derived from a valid server-issued authenticated capability, never from a user-controlled arbitrary tenant or ID.

- At websocket upgrade, verify a **short-lived, signed room-scoped capability** issued after a real Neon room join. Do not put bearer tokens or full answer bodies in URLs or logs.
- Every room only broadcasts a **minimal room update notification**. DO does **not** own grades, correctness or player balances. Do not echo answer keys, auth tokens or PII.
- The trusted API validates player tokens and commits answers **idempotently** to the authoritative score database. Only after committed writes may it emit versioned room update events. Acknowledgements must not falsely claim durability.
- Rejoin/resume requires a monotonic `room_revision` or server-derived snapshot, ensuring no duplicate grades and convergence after missed notifications. A slow or unresponsive client must not delay peers; apply per-client backpressure.
- Move individual room state snapshots near the edge only with safe cache invalidation and privacy controls; verify Host-only fields cannot leak.
- Reduce fallback-polling storm risk with token-scoped stagger + backoff. The existing 700ms jitter already improves 1,000-player classroom timings.
- Maintain Supabase and Neon as **optional fallback for their independently verified capacity**, not as the sole transport tier for a million participants.

### Answer ingestion and database tier
An eight-CU Neon Postgres endpoint and a single `answers` table have not been benchmarked or approved for **500,000 writes/s**. To approach such a target, measure a realistic concurrency/arrival profile first, use deterministic room sharding plus idempotency keys, obtain appropriate database capacity and write queue architecture, and design graceful admission control. A queue before committing an answer means "accepted for processing" must never be reported as "grade persisted"; an answer ACK SLO requires end-to-end durable-write telemetry.

### HTTP routing/edge tier
Do not assume the single-process local Next.js benchmark represents Vercel Production serverless. Test from **independent load generator machines** to a paid/approved isolated Vercel Preview, with the same room and token model. The prior 1,209ms P95 for an empty handler indicates a single-worker/transport test bottleneck. Collect Vercel concurrency, cold starts, HTTP queueing, CPU, TLS and origin DB query time. Verify WAF/429 and avoid test traffic to real classrooms.

## Staged paid-load approval gates

**No automatic million-connection load is scheduled or authorized by this repo.** Any real load work requires a staging tenancy, billing approval, verified cloud quotas, provider permission if necessary, and stop conditions:

| Stage | Online sessions | Gate before next stage |
|---|---:|---|
| S0 | 1,000 | Separate-machine GET P95 <1s and grade integrity |
| S1 | 10,000 | E2E WebSocket P95 <2s, no quotas or 429/503 |
| S2 | 100,000 | Room sharding, provider capacity and bill alerts verified |
| S3 | 1,000,000 | Only with explicit account/provider authorization and reserved staging budget |

At every stage measure request P50/P95/P99, bytes, active sockets, dropped messages, join rate, score reconciliation, DB writes per second, Cloudflare Workers/DO bills, and Vercel 429/503 throttling. Abort on abnormal cost, infrastructure saturation, 429/5xx >0.1%, scoreboard mismatch, or repeated P95 violation. Do not artificially lower the target or swap the tested workload after a failure.

## Implemented now (safe, zero billable traffic)

`qa/model-million-routing.cjs` invokes ZoKivo's **actual routing function** for **1,000,000 synthetic participant identities** across 10,000 synthetic rooms. It asserts stable 50/50-ish provider selection, secondary ordering, same-user consistency, room distribution, and disabled/bad-config fail-safe. This is a million **CPU decisions**, **not a million WebSockets or page loads**. It never accesses a network or database. CI is scoped to this file and can run without special secrets.

**Production status:** Unchanged by this research branch. The 1,000-instant-request gate **passed only in isolated four-origin QA**; **real Vercel Production/serverless is not certified** pending independent-machine capacity testing. Four-process evidence: `qa/four-origin-instant-burst-20261022`, Preview `dpl_CVXweNPmqEWqWCqjyUPU8j4FYsQA`.
