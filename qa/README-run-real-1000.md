# Real 1,000-player QA — authorization & runbook

This workflow intentionally **does not run automatically**. The repository owner must configure two **QA-only** GitHub Environment secrets, then explicitly dispatch the action.

## Single authorized setup

In GitHub repository **Settings → Environments**, create environment `zokivo-loadtest-qa`. Under this environment's secrets, add:

- `ZOKIVO_QA_DATABASE_URL`: connection string for the **isolated Neon branch `qa-1000-20261020`**, not Production. Copy from Neon dashboard, not from a chat message.
- `ZOKIVO_QA_SESSION_SECRET`: a separate newly generated random 32+-character secret used **only** by this QA run. Never reuse the Production session secret.

Do **not** add secrets as repo files, PR comments, screenshots or chat messages. Restrict the GitHub Environment to trusted maintainers, and require approval if desired. Workflow has explicit `workflow_dispatch` only.

Next, open **Actions → ZoKivo REAL 1000-player QA (isolated database only) → Run workflow**, enter:

```
RUN_1000_QA_ONLY
```

Only proceed if the host environment has sufficient approved test quota/budget. The test creates synthetic room/player/answer rows only on the guarded QA branch; no production traffic. It runs a Next.js server at local `127.0.0.1:3000`.

## What will be measured

- Ten isolated classrooms, 100 distinct players each.
- Real HTTP join requests and independent HMAC-authenticated player tokens.
- **100, 250, 500, and 1,000 concurrent authenticated HTTP GET calls** against QA game state (not 1,000 parallel writes).
- Two game rounds, with up to 120 concurrent answer writes and authenticated scoreboard/status reads.
- Ten percent rejoin/reconnect API reads with the same player token.
- Neon DB reconciliation of all answers and scores.
- Response codes, failures, P50/P90/P95/P99, max durations and temporary JSON artifact.
- Automatic escalation abort on failures at the 500+ concurrent GET wave.

## Scope limitations

This is an **isolated Next.js + Neon branch API test**, running on a GitHub-hosted machine; it does **not** measure Vercel Production serverless autoscaling, Cloudflare WAF/rate limits, Supabase/Neon WebSocket fan-out, actual phone/browser rendering, or Malaysia classroom connectivity. Do not publish a full 1,000-person real-time game certification based only on this workflow.

For a production-grade acceptance test, follow with a pre-approved safe Vercel Preview and staged WebSocket test using 1,000 distinct sessions, including an independent network vantage point in Malaysia. Record actual scoreboard convergence P95, disconnect/reconnect recovery and per-provider success rates. Never pressure-test real production student rooms.

## Acceptance goals (not current results)

| Metric | Goal |
|---|---:|
| 1,000 authenticated player connections | Verified |
| Dynamic API response P95 | Less than 1,000 ms |
| Dynamic API response P99 | Less than 2,000 ms |
| Legitimate answer submissions | At least 99.9% succeed |
| Score/answer integrity | 100% |
| WebSocket scoreboard convergence P95 | Under 2,000 ms |
| Rejoin reliability | 99.9% or better |
| HTTP 429/5xx under supported load | Under 0.1% |

**No system can guarantee zero latency or zero lag for every client or network**, even if all of these thresholds pass.
