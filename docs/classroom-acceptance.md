# ZoKivo classroom validation checklist
A successful Vercel build cannot prove physical camera accuracy or multi-device synchronization.

## Dual-client read-only test
Host a dedicated throwaway game on the deployed site and join with an independent player client. Set:
```
ZOKIVO_TEST_PIN=123456 ZOKIVO_TEST_HOST_TOKEN=<host> ZOKIVO_TEST_PLAYER_TOKEN=<player> npm run qa:realtime
```
Store tokens locally only. Never paste them into GitHub, issues, or logs. This test runs a bounded number of real HTTP reads from one machine; it is not equivalent to two independent browser/device tests.

## Real classroom acceptance criteria
1. Use two browsers/devices, one teacher and one student, with normal account and guest authorization.
2. Host an original four-choice quiz, test correct, incorrect, late joins and expiry across 10 questions.
3. Assert the leaderboard is identical at the same settled-round revision; allow 3 seconds for polling fallback.
4. For each game mode, answer one question correctly, claim a single reward, confirm the second claim is refused.
5. Use 60 generated paper cards with physical printouts, validate ZoKivo and Wayground card #1 stay separate.
6. Test phone browser camera permission, blocked permission, camera occupied and background/foreground recovery.
7. Check question media across mobile browsers, expired URLs, audio user gesture, formulas and override duration.
8. Verify a student cannot read another teacher's reports or another user's locker inventory.
