# ZoKivo hardening release gates — 2026-11-18
This code batch fixes unbounded request body reads and adds atomic database-level quota triggers, while avoiding Vercel preview deployments.

## Apply with controlled database ordering
1. Back up an **isolated QA Neon database**, then manually apply `migrations/023_atomic_feature_quotas.sql` there. It is never automatically applied by Next.js, GitHub, or Vercel.
2. Test concurrent requests with **test accounts only** at 44/45 Study attempts, 39/40 AI conversations, 199/200 chat messages, and 99/100 teacher assignments. Verify no overshoot, stable 409/429 responses, duplicate client-ID retries, and correct persistence.
3. Check oversized bodies with absent/false Content-Length, UTF-8 failures and invalid JSON; verify 400/413/415 and valid payloads.
4. Review QA results and migration rollback. **Only after explicit database approval**, take a production Neon backup and apply SQL to intended production database before API code release.
5. Perform one controlled production release after CI and then low-volume smoke checks; stop on Vercel 402. Do not change Cloudflare rules or authentication settings as part of this batch.

## Separate external gates (NOT certified by this change)
- Real Google OAuth, registration/email confirmation/SMTP and callback path tests.
- Cloudflare WAF rule audit and actual 403/429 traces.
- Authorized 20-then-100-device classroom joins, live scoring, reconnect/failover, physical Paper Mode scanning, and live AI agent access.
See `docs/2026-11-05-release-gates.md`. A green CI build cannot establish these.

## Migration 024 (manual QA first)
Apply `migrations/024_quiz_ai_atomic_quotas.sql` to a separate QA Neon database AFTER 023. It guards 100 quizzes/account and 10 issued/reserved AI sessions/account per 24 hours. Unsuccessful ElevenLabs signed-URL requests release reservations; a crash leaves a lease that stops counting after 90 seconds. Never deploy the new AI handler before 024 exists in production following explicit backup and approval. Verify 99/100 and 9/10 boundaries under real concurrency on disposable QA users. This batch limits public Realtime Broadcast amplification only; #57 remains open until sender authorization is independently verified.

## Abandoned room host recovery (Issue #55)
- Game and authenticated Reports APIs mark a room `needsHostReview`/`needs_host_review` only when it remains `playing` over 24 hours after its last question deadline.
- The owner-only Reports page offers a return link to that room. The existing authenticated host can explicitly use `Finish game` to preserve the score and unlock results. The host token remains browser-session scoped; missing tokens require a separate authorized recovery design.
- Prevent the host's automatic round advancement in stale rooms, and stop expensive stale polling/realtime connections. GET remains read-only and does **not** auto-finish, delete or recycle a production PIN.
- Full server-side stale-room maintenance/archival is not yet implemented; assess retention, backup and manual approval before any production cleanup. Keep Issue #55 open until archived report and consented cleanup tests pass.

## Recover a lost host token for stale classrooms (no schema change)
- New `POST /api/rooms/[pin]/recover-host` requires same-origin request, Mother Auth verified email, exact original `owner_user_id`, status `playing`, and deadline older than 24h.
- An explicit confirmation rotates *only* the stored HMAC of the host token, returning a fresh cryptographically random token. The old token immediately stops working. This is intentionally account-owner recovery for abandoned rooms, not a general ability for the public to take over a room by knowing its PIN.
- Reports UI stores returned secret in `sessionStorage` (never URL, logs or `localStorage`). The original owner can reopen the classroom and explicitly finish to unlock reports. The new endpoint cannot update scores, status, answers, or PINs.
- Protect this feature with negative security tests (wrong owner, unverified owner, unauthenticated, wrong PIN, active room, finished room, cross-site requests) and mocked successful recovery. Current scope excludes finished-room historical report restoration.
- A recovered token can be rotated again by the same verified owner while the room is stale; stronger independent re-authentication or cooldown/audit fields could be added only in a future approved migration. Do not deploy without reviewing this risk.
