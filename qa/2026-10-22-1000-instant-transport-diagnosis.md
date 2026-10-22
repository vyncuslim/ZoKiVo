# ZoKivo instantaneous 1,000-request diagnostic — 2026-10-22

## Result: FAIL against strict P95 <1,000ms

A new response-prefix serialization experiment was run via a **QA-only Vercel Preview build** with a **separate Neon Preview branch**, 10 synthetic quiz rooms and 1,000 independent players. It preserves signed player authorization and score integrity.

**The experiment did not improve the single-process 1,000-request worst-case performance and MUST NOT be merged to Production.**

| Workload | Requests | Successful | P95 ms | P99 ms |
|---|---:|---:|---:|---:|
| Original Production implementation, previously measured | 1,000 | 1,000 | 1,537 | 1,573 |
| JSON-prefix-cache experiment (run 1) | 1,000 | 1,000 | 1,583 | 1,677 |
| JSON-prefix-cache experiment (repeat) | 1,000 | 1,000 | 1,543 | 1,617 |
| **Minimal JSON response with NO DB/auth**, identical localhost and load generator | 1,000 | 1,000 | **1,209** | 1,255 |
| Authenticated 1,000-player staggered wave (700ms spread) | 1,000 | 1,000 | 956 | 975 |
| Real answer writes (two rounds) | 2,000 | 2,000 | 919 | 1,083 |
| Normal room state reads (two rounds) | 2,000 | 2,000 | 462 | 469 |

Every request in this repeat run succeeded and both rounds passed DB score reconciliation (2,000 persisted answers). The strict test **correctly returned FAIL** due to 1,543ms instantaneous status GET P95. The classroom spread-based target passed.

## Critical diagnosis

The **minimal no-database response also exceeded the 1,000ms P95 threshold**, demonstrating a material contribution from the **single Next.js process / socket-accept / Node.js HTTP load generator / test worker resource topology**, not just ZoKivo SQL queries and response generation. This is an observation in one shared QA environment, NOT proof that Production serverless has the same capacity ceiling or that the database can never be improved.

Do not claim that more caching alone can push the measured single-process 1,000-cold-connection benchmark under 1s: the same test worker could not do so for a trivial response. Also do not weaken the original P95 budget, send 1,000 requests to actual student rooms, or silently replace the raw instantaneous test with staggered refreshes.

## Correct next measurement

1. Use a **separate machine or k6 workers** as the load generator to avoid sharing a process/CPU with the Next.js target.
2. Provision an isolated Vercel Preview **serverless** target backed by disposable Neon QA branch; verify scaling limits, region, price and access policy.
3. Run identical 1,000 simultaneous authorized GETs, including a trivial no-DB control in the same isolated target; report cold/new and pre-warmed connections distinctly.
4. Collect server-side handler duration, request queueing, CPU, network/TLS handshake and Vercel instance-level concurrency.
5. If P95 still fails, explore enough isolated service instances or authorized higher concurrency to meet the budget; repeat full scoring and Realtime/WebSocket tests.

## Safety and deployment

The cache-experiment branch `perf/instant-1000-serialized-snapshot-20261022` remains unmerged. Test-only public ping handler is gated on `VERCEL_ENV=preview` and QA branch name and is NOT in Production. No secrets were copied to chat or checked into Git. Production remains on PR #27, which previously achieved P95 876ms with 700ms staggered refreshes.

Evidence: Vercel build `dpl_BtkYnUtQ54QBA19Bf6dVqnRyhjCo` (log markers `QA_BURST`, `QA_TRANSPORT_1000`, `QA_FINAL_REPORT`, `QA_PERFORMANCE_ACCEPTANCE`).
