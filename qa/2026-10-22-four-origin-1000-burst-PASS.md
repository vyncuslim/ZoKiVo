# ZoKivo 1,000 instant-request test: four isolated Next.js processes

**UTC:** 2026-10-22T12:01:58Z
**Verdict:** **PASS** in isolated four-origin QA benchmark; **Production not certified**.
**Test evidence:** Vercel Preview build `dpl_CVXweNPmqEWqWCqjyUPU8j4FYsQA`, `QA_PERFORMANCE_ACCEPTANCE {"passed":true}`, `QA_FOUR_ORIGIN_CAPACITY_GATE_PASS`.

## Isolation
- Dedicated Neon QA Preview branch `br-super-rain-b3p88oaf`, checked `zokivo_qa_sandbox_guard` before writes.
- One Vercel Preview **build worker** running **four independent Next.js production-mode processes**, localhost ports 3000–3003. Shared staging-only secret and QA DB; request generator distributed round-robin across four processes.
- 10 synthetic quiz rooms × 100 real HTTP player sessions.
- All 1,000 status requests for the strict burst issued together via `Promise.all`. Their resulting P95 includes Node HTTP load generator overhead; this is NOT a 4-machine independent-generator test.
- Realtime WebSockets, Cloudflare routing, production serverless scaling, browser rendering, and mobile network NOT measured.
- QA build only, not merged to main.

## Actual measurements

| Operation | Samples | Success | P95 (ms) | P99 (ms) |
|---|---:|---:|---:|---:|
| Join 1,000 players | 1,000 | 1,000 | 463 | 1,053 |
| Exactly simultaneous 100 GET | 100 | 100 | 497 | 497 |
| Exactly simultaneous 250 GET | 250 | 250 | 553 | 556 |
| Exactly simultaneous 500 GET | 500 | 500 | 576 | 581 |
| **Exactly simultaneous 1,000 GET** | **1,000** | **1,000** | **746** | **1,110** |
| 1,000 players with 700ms jitter | 1,000 | 1,000 | 924 | 962 |
| Active room state GET | 2,000 | 2,000 | 472 | 904 |
| Answer POST, 2 rounds | 2,000 | 2,000 | 852 | 1,157 |
| Settled leaderboard GET | 2,000 | 2,000 | 802 | 822 |
| Session reconnect GET | 200 | 200 | 911 | 925 |

All 2,000 answers passed database reconciliation for both rounds, no HTTP errors/429/5xx, zero missing scores. Test runtime about 57 seconds. Original single-origin isolated test was P95 1,537ms and failed; splitting over four Next.js origins gave P95 746ms and passed.

## What this means for production
The evidence supports **parallelizing origin processing** instead of spending more effort shaving SQL/JSON: the empty-handler 1,000-burst control had already measured P95 1,209ms on a single origin.

But Vercel Production cannot be claimed to use exactly four warm function instances merely because its Preview build worker ran four local processes. To claim production grade, use an **independent load generator** targeting a protected Vercel Preview **serverless deployment** with the same four-way or better distributed effective concurrency, and verify cold starts, serverless quotas, WAF/429, Neon limits, token privacy and Host workflow. Then repeat several times, including P99, DB integrity, and realtime fanout.

This four-origin QA branch **temporarily sets `package.json postbuild` to execute a load generator**; it is intentionally QA-only and **must not be merged to Production**. Do not use this architecture evidence to claim a million real connections or <2s worldwide.
