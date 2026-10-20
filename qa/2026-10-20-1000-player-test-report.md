# ZoKivo — 1,000-player capacity investigation
**Date:** 2026-10-20 · **Status:** PARTIAL / NOT CERTIFIED

## Scope and evidence

A dedicated **Neon QA branch** `qa-1000-20261020` was created with a positive guard marker (`zokivo_qa_sandbox_guard`), separate from Neon Production. A separate **Vercel Sandbox** (4 vCPU / 8 GiB, Singapore) cloned the current production repository and successfully built Next.js. The sandbox did not receive production credentials.

| Evidence | Result | What this does / does not prove |
|---|---:|---|
| Synthetic game handler regression | **PASS: 18 checks** | 10 rooms, 1,000 simulated joins and 1,000 answers through mocked DB; **no real network or latency** |
| Isolated QA DB fixture | **10 rooms, 1,000 players, 2,000 answers** | Actual test-only SQL rows in the Neon QA branch; **not submitted through HTTP** |
| QA DB answer correctness | **1,000 correct / 2,000 answered; 100,000 points total** | DB fixture checks out, but does not prove API atomic-write reliability |
| DB player ranking SQL EXPLAIN ANALYZE | **0.447 ms executor, 5.244 ms planning** | Single warm 100-player room query, **not end-to-end response under load** |
| DB answer summary SQL EXPLAIN ANALYZE | **0.062 ms** | Single query |
| DB player-token lookup SQL EXPLAIN ANALYZE | **0.022 ms** | Single query with staged dummy token hashes |
| DB submitted-answer listing SQL EXPLAIN ANALYZE | **0.058 ms** | Single query for 100 submitted answers |
| Previously measured public HTTP | **64/64 expected responses** (see PR #22) | Low concurrency (max 2 requests), public routes only; P95 170–485 ms depending on route/redirect |
| Actual 1,000 authenticated network clients | **NOT RUN** | Missing authorized secure staging database connection; do **not** cite a P95/P99 |
| Neon/Supabase real WebSocket fan-out / recovery | **NOT RUN** | Requires real provider credentials and account quotas |
| Cloudflare and Vercel serverless at 1,000-player peak | **NOT RUN** | Staging sandbox is not production edge/origin infrastructure |

## Why the 1,000-user HTTP run is blocked

The staging runtime was successfully created, and `qa/staged-real-1000.cjs` is ready to run. However, the secure action to transmit the isolated database connection string from the Neon connector to the Vercel Sandbox was **blocked by the platform's credential safety checks**. No attempt was made to bypass those checks or to redirect the load generator to Production. Vercel project environment mutation had previously returned HTTP 403 (insufficient permission). The sandbox started without a `DATABASE_URL`.

**Therefore it would be incorrect to claim that 1,000 simultaneous HTTP game sessions passed or that Realtime P95 is under 2 seconds.**

## Ready-to-run isolated end-to-end test

The script `qa/staged-real-1000.cjs` is a complete **real HTTP** harness (not a mock) that, *once authorized staging configuration is available*, will:

1. Reject execution without a staging-only confirmation flag and unique database guard marker.
2. Create a **synthetic published quiz** and ten **synthetic lobby rooms** through the isolated Neon branch.
3. Send **1,000 actual HTTP Join requests**, storing each returned unique player token only in process memory.
4. Start two rounds in the **QA DB only** (Host control API is not covered because it requires a real signed-in teacher), issue a game-state GET for every player, and submit **1,000 real HTTP answers per round** with a capped maximum 120 inflight writes.
5. Observe settled rank lists, have 10% of players reconnect using their original token, and reconcile question/answer counts and points against the QA database.
6. Report success counts, status codes, and P50/P90/P95/P99/max latencies per operation. Store the summary locally at `/tmp/zokivo-1000-qa-summary.json`.

Preflight requires a **dedicated QA Neon branch connection string**, a **separate QA-only 32+-character session secret**, and `ZOKIVO_QA_CONFIRM=BRANCH_ONLY_1000` in the **authorized test process**, never in GitHub, chat or a public .env. Both the Next.js test server and the test runner must use the same QA-only secret. Keep Supabase and Neon Realtime transports disabled for this first API/database-only baseline.

> The code is restricted to the guard marker `exclusive-qa-1000-20261020` on the QA branch. The marker is intentionally **not present on Production**, so a mistaken connection to production must fail before fixture writes.

## Capacity acceptance plan (not yet satisfied)

- 1,000 authenticated clients in 10 test rooms × 100 people, two or more live questions.
- End-to-end per-operation API P95 below 1,000 ms; P99 below 2,000 ms; at least 99.9% valid writes accepted.
- Exactly 100 players per room; zero missing, duplicated, or incorrect persisted answers; 100% correct final scoring.
- Browser/WebSocket test with 50/50 Neon/Supabase distribution, P95 leaderboard convergence below 2 seconds, provider-switch, 10% forced disconnect/rejoin, and verified quota headroom.
- Distinct controlled tests on the Cloudflare route and Vercel serverless Preview, observing 429 and 5xx. These must use disposable dedicated rooms and graduated load with stop conditions; no unauthorized production flood.
- Repeat during at least two test windows for stable results.

## Resource hygiene

The temporary Neon branch contains **synthetic data in addition to a snapshot of the parent branch**; keep its connection credentials private. It should be deleted **only after explicit user authorization**, following Neon tool policy. The dedicated Vercel Sandbox should be stopped after collecting evidence to release compute resources.
