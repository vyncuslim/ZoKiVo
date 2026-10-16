# ZoKivo 🎮

Playable MVP: live classroom quiz, six-digit PIN, host controls, guest players, a four-question quiz, leaderboard, server-side scoring. Neon development branch already has the schema and sample questions. This is a **development prototype**, not public-production ready.

## Setup
1. `npm install`
2. Add `DATABASE_URL` (Neon development branch) and `ZOKIVO_SESSION_SECRET` (random 32+ characters) as private Vercel env vars.
3. `npm run dev`; host at `/host`, players at `/play`.

Next: Mother Supabase Auth, ZoKivo Supabase private Realtime, ElevenLabs AI, rate limits, storage fallback, tests and production review. Production Neon is untouched.