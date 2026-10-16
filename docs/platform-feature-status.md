# ZoKivo platform feature inventory · 2026-10-16

## Implemented and code-deployed
- Mother Supabase email + Google PKCE login, registration, password reset, account session and sign-out
- Join by 6-digit PIN (guest), host rooms for signed-in users, question timer, score and leaderboard
- Quiz Studio: /create create or update 1–40 four-choice questions and save private drafts
- Quiz Library: /library owned private drafts + published quiz listing
- Server-side publication gate requires verified Mother Supabase app_metadata role (zokivo_role=teacher/admin or zokivo_roles)
- Hosts choose a published quiz for Quiz Party or Paper Mode
- Paper Mode supports 60 ZoKivo plus 60 Wayground cards per game, A/B/C/D verification and manual review
- Real ElevenLabs private signed-session API /api/ai/voice/session + /ai text conversation UI
- Anti-cheat: correct/incorrect is not sent on answer submission; student scoreboard masked during an active timed round
- Google Search Console verification tag in Next.js Metadata

## Production database
- Neon production branch br-bold-cherry-b3y92udy initialized additively with 8 application tables and 4 World Explorer starter questions.
- Neon development branch br-spring-rain-b3it0g0o also has quiz authoring and AI usage tables.
- Vercel DATABASE_URL variables earlier displayed 'Needs Attention'; verify that Vercel production connection is actually healthy before asserting live read/write.
- Do not paste Neon or Supabase credentials into issues or client code.

## Deliberately gated / not yet verified
- PAPER_MODE_ENABLED is OFF by default pending real phone classroom scan QA and authorization.
- ZOKIVO_AI_ENABLED is OFF by default; existing ElevenLabs Agent requires private agent activation and real paid-session cost review. Do not publish the agent without explicit approval.
- No teacher role provisioning tool has been connected. Authoring a draft does not grant approved teacher privileges.
- Mother Supabase OAuth Google provider, redirect allowlist, email SMTP and verification must be tested with real accounts.
- More polished real-time rooms / Supabase Realtime remains planned; polling currently refreshes the app.
- No end-to-end live classroom QA of mixed cards, mobile devices, latency, network outages, or simultaneous game clients.
- Authenticated host access is required, but full organization/teacher approval and abuse/rate-limit policy require more work.
- Student PII protection and consent rules require review prior to public school deployment.
- AI backend tools (get_game_context, save_quiz_draft, publish_quiz, curriculum, teacher_feedback) are not connected to ElevenLabs and must remain disabled until authorized and tested.

## Operational testing
Before declaring 'complete': verify real user registration, email confirmation, Google login, host creation, join, round start, answer, scoring, quiz draft create/edit/publish under approved teacher, Paper Mode camera, and private AI Agent session.
