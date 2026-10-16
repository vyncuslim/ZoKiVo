# ZoKivo score synchronization and data model (16 October 2026)

## Ground truth
Neon PostgreSQL is authoritative. The production database showed one published World Explorer quiz with four questions, two completed rooms, three total players and seven submitted answers. The aggregate player scores matched the sum of their recorded answer points. This does **not** establish any live game end-to-end performance.

### Identified divergence
The former /api/rooms/[pin] API returned actual scores to hosts but forced all players' scores to zero while a timer was open. This is a visibility inconsistency rather than corrupted database totals. Supabase Broadcast is only a non-authoritative refresh signal; live connected browsers could wait 12 seconds for their backup poll.

### Corrected contract
- Both teacher and student receive the exact same public scoreboard in the same room, calculated by one SQL CASE policy.
- For active questions, show only scores from *previously closed* rounds, for all viewers. This prevents guessing correct answers by watching scores mid-round.
- Immediately after the timer expires (or a host finishes the game), show all committed points from Neon.
- The host may view how many have answered, but no participant gets the current correct option before the round ends.
- Clients discard stale out-of-order HTTP responses, correct for server/browser clock skew and poll within 1.6–3 seconds even if Realtime signals fail.
- A verified signed-in host may end the game early. Student/guest cannot.
- Correctness and points are inserted/updated server-side; client-side local score is never authoritative.

## Dataset comparisons with Blooket screenshots and hosting guide
Blooket publicly shows teacher steps: choose a question set, select a game mode, configure timings/goal/order/late joining/names/sound, show join PIN/QR/link, start and display leaderboard, then results. ZoKivo currently has one four-choice starter question set, Quiz Party and Paper Mode prototype. It does not currently implement the pictured animal-avatar collection, persistent reward inventory, chest/Crypto Hack/Fishing/Cafe games, curriculum mastery, or full study/teacher analytics. Do not claim the screenshots are ZoKivo data.

A future original ZoKivo mode schema could add `game_mode` on `rooms`, `game_mode_player_state` keyed by room and player, `mode_actions` ledger keyed by idempotency token with server-generated rewards, `room_settings` and persistent `student_avatars`. Mode currency is virtual classroom points only, not real cryptocurrencies. These changes are a proposal, not live migrations.

## Regression
`npm run test:scoreboard` provides mocked API role-invariance and security tests. Production build and synthetic/multi-device QA must still pass.
