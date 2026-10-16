# ZoKivo 🎮

Free-first multiplayer classroom learning games. Inspired by quiz-party experiences; built as an original product by Vynalth AI.

## Architecture
- **UI/API**: Next.js + TypeScript on Vercel
- **Identity**: Mother Supabase Auth for hosts, guest PIN for players
- **Game data**: dedicated Neon PostgreSQL project (`crimson-frost-82700209`)
- **Realtime/media**: separate ZoKivo Supabase (integration to be configured)
- **AI/voice**: ElevenLabs (opt-in server integration)

### Status
Initial repository bootstrap. Core application and migrations follow on a feature branch.

Keep API keys in Vercel environment variables, never in this public repo.
