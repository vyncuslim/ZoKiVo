# ZoKivo 1,000 authenticated player capacity validation

**Status:** Test design only. Do not claim production certification until a real network run and DB reconciliation have passed.

## Target architecture
- 10 independent dedicated QA rooms × 100 independently tokenized users
- Each room remains capped at 100 (see migration 016)
- Production public domain passes the existing real Cloudflare access flow; do not bypass WAF/GPS access rules
- The host progresses through questions normally and must not use real student accounts, quizzes, or scores
- The 1,000-VU homepage benchmark is not equivalent to 1,000 simultaneous game sessions

## Preparation
1. In an authorized, isolated Preview/staging deployment, create 10 dedicated QA rooms, allowing 100 test players each.
2. Prejoin 100 independent QA players per room through the ordinary join API; store each player's returned token safely.
3. Put an **uncommitted** `qa/qa-1000-private.json` next to the k6 script:
```json
{
  "baseUrl": "https://your-dedicated-qa-deployment.vercel.app",
  "testRoomsOnly": true,
  "rooms": [
    {
      "pin": "123456",
      "players": [
        {"token": "YOUR_QA_TEST_PLAYER_TOKEN"}
      ]
    }
  ]
}
```
Expand to **10 rooms with exactly 100 tokens each**, and never publish the file or tokens. The sample is only a template and will intentionally fail validation.
4. Start the 10 test games, using a safe fixed-length test quiz. Run the host controllers simultaneously while k6 clients answer.
5. Confirm the target environment and Cloudflare rate limit policy, as well as a stopping plan, before running a high-load production test.

## Invocation
```powershell
k6 run -e ZOKIVO_QA_CONFIRM=TEN_DEDICATED_ROOMS ./qa/k6-1000-multiplayer.js
```
For production only, an additional `-e ZOKIVO_QA_ALLOW_PRODUCTION=YES` is mandatory. Do not use this option without confirming all accounts and rooms are disposable QA resources.

## Acceptance checklist
- 1,000 independently authenticated players distributed across 10 rooms
- 1,000 unique joins and successful submissions per question, with no double credit
- Answer and game-state API p95 < 1,000 ms measured through both the Vercel origin and the real Cloudflare domain
- HTTP and gameplay error rate < 0.1%, no sustained 429 or 503
- P95 state convergence < 2 seconds *measured separately* with timed real clients (k6 HTTP timings alone do not measure Realtime delivery)
- Correctness: database rows per room, unique player answers, computed scores, rank ordering and eventual reports agree 100%
- Repeat 2+ minutes in-game and for multiple question transitions, plus restart/disconnect/rejoin cases
- Stop immediately on unexpected 429/5xx spikes, >2 second sustained p95, or interference with real users

## Important caveats
- This script samples room state repeatedly and submits exactly once per active question; it does **not** create accounts, rooms or game state, nor control host advancement.
- It does **not** prove student devices, Supabase WebSockets, browser rendering, or end-to-end Realtime sync latency.
- The app code improvements and migration 019 must pass CI and separate **authorized** production deployment review.
- Migration 019 was validated on a Neon temporary branch only, not applied to production. Its application requires approval and a controlled window.
