# ZoKivo Paper Mode: Dual-card recognition

Supports both **ZoKivo's own QR Q-Cards** and **original Wayground / Quizizz 6×6 Q-Cards**, with an automatic mode that attempts to identify both in the same video frame.

## Student/card identity
- Use 1–60 for ZoKivo cards and 1–60 for Wayground cards.
- Every card is identified as (card_source,card_number); ZoKivo #001 is distinct from Wayground #001.
- The score, submission record, duplicate detection, review list, and manual correction are all source-aware.
- Each student should retain the same card throughout the session.
- Database: an additive paper_card_submissions table, with legacy paper_submissions retained and copied without deleting rows. See migrations/003_paper_dual_cards.sql.

## Answer orientation
- ZoKivo: QR finder-pattern rotation maps to A/B/C/D.
- Wayground: the 60 pattern dictionary was extracted from the source PDF.
- Wayground **printed top letters vary per card**: P1=A, P2=B, P3=C, P4=D, repeating.
- A marker rotated one quarter-turn counterclockwise moves its printed right-hand letter to the top. Correct label index: (card_number - 1 + marker_rotation) % 4.
- Review results before submitting. Same-frame detection, off-axis camera, shadows, reflections and print scale still require real hardware testing.

## Security and status
- Public Paper Mode creation remains disabled unless PAPER_MODE_ENABLED=true.
- Mother Supabase teacher verification, rate limits, classroom tests and a production DB migration are outstanding.
- Experimental third-party card compatibility; independently implemented, not endorsed by Wayground.
