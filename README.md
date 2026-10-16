# ZoKivo! 🎮

Play. Learn. Win. Original multiplayer classroom quiz app by Vynalth AI.

## Technology
Next.js / TypeScript (Vercel); Neon PostgreSQL; Mother Supabase Auth (planned); ZoKivo Supabase Realtime (planned); ElevenLabs AI (planned).

## Standard quiz MVP
Create a 6-digit game PIN at /host, join as a student at /play and answer the four-question World Explorer sample set.

## Paper Mode early-access prototype
- /games links to /paper
- /paper — create a teacher-led session **on the phone that will scan cards**
- /paper/cards — printable 60-card QR set (A4), reusable across sessions
- /paper/scan/[pin] — teacher camera scanner, manual correction, review, submit and next question
- /paper/board/[pin] — projection display on another device
- Student cards rotate; QR finder orientation determines A/B/C/D. Q-cards encode only a numbered ID.
- jsQR detects **one card per frame** and accumulates multiple students as the camera pans; this is not a simultaneous multi-QR scanner.
- Server computes correctness and scores and enforces one answer per student-card per question.

## Environment
- DATABASE_URL (use the Neon **development** branch for tests)
- ZOKIVO_SESSION_SECRET (random 32+ characters, secret server-only)
- PAPER_MODE_ENABLED=true (server-side feature flag; default is disabled)

The Paper Mode tables are installed only on Neon development branch `br-spring-rain-b3it0g0o`. Apply `migrations/002_paper_mode.sql` to your approved test database if needed.

## Production blockers
Do not enable public classroom sessions before Mother Supabase teacher authentication, rate limiting, live multi-card scanning validation, security reviews, a separated production database migration and classroom field testing. The project currently has an intentionally disabled Paper Mode creation endpoint unless the feature flag is configured. This is not Wayground code or an official Wayground integration.
