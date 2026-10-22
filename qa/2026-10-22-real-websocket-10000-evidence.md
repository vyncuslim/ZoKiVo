# ZoKivo Edge WebSocket integration evidence — 2026-10-22

## Verified result

**PASS in local Cloudflare `workerd`/Miniflare CI**, with genuine RFC 6455 WebSocket connections, signed room capabilities, per-room notification fanout, and actual client receipt timestamps.

This is **NOT 1 million real Cloudflare edge connections**, nor a genuine quiz answer-to-scoreboard P95 certification. Cloudflare production Workers, Cloudflare billing, Neon, Vercel production and external networks were not exercised.

### Run evidence

GitHub Actions: [real local Edge WebSocket integration #39784519236](https://github.com/vyncuslim/ZoKiVo/actions/runs/39784519236)

| Integration stage | Active real sockets | Rooms | Receipts | P50 | P95 | P99 | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| Full single room, run 1 | 100 | 1 | 100/100 | 293.1ms | 293.8ms | 293.9ms | 293.9ms |
| 1k concurrently connected, 10 rooms | 1,000 | 10 | 1,000/1,000 | 227.3ms | 233.6ms | 234.2ms | 234.4ms |
| Full single room, run 2 | 100 | 1 | 100/100 | 194.3ms | 194.8ms | 194.9ms | 194.9ms |
| **10k concurrently connected, 100 rooms** | **10,000** | **100** | **10,000/10,000** | **703.2ms** | **757.3ms** | **823.4ms** | **824.6ms** |

*Time definition:* from triggering 1 authenticated server-to-Durable-Object room notification per room until each client receives the `refresh` frame, measured on the same CI host. Includes the DO's 180ms alarm-coalescing period and local networking. This does NOT include `POST /answer`, Neon write acknowledgement, browser parsing/rendering, or global edge RTT. Do not call these "game operation" latencies.

**Security**: Actual WebSocket handshakes using forged capabilities and disallowed Origins were denied, and other mock-based regressions for HMAC, room isolation and 128 socket cap continue to pass.

**Resource controls**: hard-coded target `127.0.0.1:18878`, only 1,000 default sockets or separately gated max 10,000; no external load-test URLs; generated random test-only secret; no live cloud account tokens; CI job 12-minute deadline.

## What remains necessary for real million users and end-to-end P95 ≤2s

1. Deploy the disabled-by-default pilot Worker to an authorized, isolated Cloudflare account with a dedicated staging route and cost alerts. **This step cannot be carried out without an authorized Cloudflare connection**, and has not occurred.
2. Verify 100-connection rooms on actual Cloudflare and progressively test 1k, 10k, 100k, then 1M independent *real cloud sockets*, distributed across at least 10,000 different rooms and multiple independent load-generator machines. Prevent test traffic from hitting real user rooms.
3. Allocate sufficient cloud quotas and approve a **hard spending ceiling** before stages above 10k. At 1M connections, ordinary Supabase project limits are insufficient; the tested room DO tier needs separate capacity evidence.
4. Load test real end-to-end game operations, measuring a correlation marker from validated quiz answer request → *durable Neon commit* → room notification → final authenticated scoreboard converged on a client. The current local socket test stops at the notification event.
5. If all 1M users submit within 2s, assess **500,000 answer writes per second**. Current Neon writes and one API/notification per answer are not proven at anything approaching this rate. Requires partitioned ingestion/commit strategy and backpressure with correct score integrity.
6. Run failure drills, token revocation, reconnect storms, cold starts, latency by Malaysia/regions, DO persistence and quotas, P95/P99/error rates, and precise bill tracking. Zero failed/dropped scores remains mandatory.

### Current verdict

- 1,000 genuine local WS sockets: **PASS**, P95 233.6ms in the latest CI run.
- 10,000 genuine local WS sockets: **PASS**, P95 757.3ms.
- 1,000,000 real Cloudflare WS sockets: **NOT TESTED / NOT CERTIFIED**.
- 1,000,000 complete quiz actions, P95 ≤2s: **NOT TESTED / NOT CERTIFIED**.

There is no credible way to infer one million successes from a ten-thousand-connection local emulator run. Do not deploy the test harness in production or claim that these thresholds have passed without real remote evidence.
