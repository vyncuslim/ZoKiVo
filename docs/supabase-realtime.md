# ZoKivo Supabase Realtime Integration

## Architecture

Neon PostgreSQL is the source of truth for games, questions, answers, scores, and Paper Mode card submissions. Supabase Realtime only broadcasts a lightweight refresh signal. It does not replicate Neon data.

After a successful Neon write, the Vercel backend POSTs to the documented Supabase Broadcast REST endpoint /realtime/v1/api/broadcast/{topic}/events/refresh with JSON body {v:1} and the server-only ZOKIVO_SUPABASE_SECRET_KEY in the apikey header.

The topic is derived from a keyed HMAC of the game PIN, mode and ZOKIVO_SESSION_SECRET. It cannot be guessed from the six-digit PIN without the session secret. Clients discover the topic via the GET /api/realtime/config endpoint, which validates Quiz Party host/player tokens, or checks that a Paper Mode room exists for its publicly projected board. Only the publishable key goes to the browser.

Clients subscribe to a public Broadcast channel with supabase-js. Upon receipt of a refresh event, they reload the current game state from the existing authenticated Neon-backed API. Neither teacher tokens nor correct answers nor personal student data are broadcast. These are public signals only, never authoritative state. A listener with the topic and public key could send a forged refresh event but cannot mutate Neon or learn private data through the event. Client refreshes are throttled and periodic polling remains a fallback.

## Vercel Environment

* ZOKIVO_SUPABASE_URL — the dedicated ZoKivo Supabase HTTPS project URL
* ZOKIVO_SUPABASE_PUBLISHABLE_KEY — public sb_publishable_* key, delivered to subscribed clients through the authorized config endpoint
* ZOKIVO_SUPABASE_SECRET_KEY — server-only sb_secret_* key, NEVER put in NEXT_PUBLIC_*
* ZOKIVO_SESSION_SECRET — stable 32+ character secret for room tokens and channel HMAC
* ZOKIVO_REALTIME_ENABLED — optional: set to false to disable the Realtime bridge. If missing, the bridge is enabled whenever all keys are configured.
* DATABASE_URL — Neon Production; unrelated to Supabase

## SQL Editor

REST Broadcast does not require game tables or a publication on the ZoKivo Supabase database. Run supabase/sql/001_realtime_broadcast.sql ONLY in the ZoKivo Supabase project as a harmless optional smoke test of the built-in realtime.send function. Do not run Neon game migrations in Supabase; Supabase triggers do not observe another database.

Realtime public channels must be allowed in the Supabase project settings. Do not create unrestricted SELECT policies on tables containing student or answer data. Private channels would require proper JWTs and per-room RLS which have not been provisioned for PIN-based guest players.

## Verification

1. Verify all three ZoKivo Supabase keys are configured in Vercel Production and redeploy.
2. Open a game on one browser as a host and join the PIN on a second browser as a player.
3. Open DevTools Network WebSocket and confirm the Supabase Realtime connection and SUBSCRIBED channel status.
4. Start the round; the player should refresh immediately without waiting for the fallback poll.
5. Submit an answer; the host's scoreboard and submission status update; correctness remains hidden until after the round.
6. Disconnect Supabase; the room and projected board still update via periodic API polling.
7. Paper Mode notifications apply to teacher scanner and projected board, but session creation remains gated behind PAPER_MODE_ENABLED pending physical-camera validation.

Automated tests do not certify live Supabase project access or physical multi-device performance. Check connection and billing limits before classroom release.
