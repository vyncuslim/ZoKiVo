# ZoKivo Classroom Results — Access & Handling Policy (Engineering)

This document describes the *technical behavior implemented by the results-insights API*. It does **not** replace the platform's published privacy notice, school policies, guardian consent rules, or applicable law.

## When results become available
- The API returns HTTP 409 until the room's server-authoritative status is `finished`.
- The existing live game UI and scoreboard visibility rules remain unchanged.
- A room PIN alone grants no access to result details.

## Student access
- A valid session-bound player token permits only that player's submitted answers and the corresponding correct answers after the game finishes.
- The response includes question number, prompt, their submitted answer, correct answer, result, earned points, and any existing explanation.
- It does not include other students' identities, submissions, or class-level analysis.
- No login requirement is added to existing PIN-based participation.

## Host access
- A verified host token **and** the original signed-in host account must both match the room.
- After a game finishes, the host can read class accuracy, question correctness distribution, rankings and individual students' answer records.
- The optional `player` lookup is restricted to hosts; a student cannot elevate their access with a query parameter.
- This endpoint is read-only and does not alter points or completion status.

## Export, retention and disclosure
- Treat exported student reports as classroom records. Share only with authorized educators, pupils or guardians according to school policies.
- Do not publicly index these reports or expose result tokens in links, logs or analytics.
- This new API does not add automatic retention, deletion, marketing use, profiling, or third-party sharing.
- Validate the actual published privacy policy and applicable parent/teacher consent obligations before making new public claims.

## UI preservation
- No changes to live Host screens, Student screens, menus, game colors, layouts, or CSS are part of this change.
- The added endpoint is `GET /api/rooms/{pin}/insights` and returns JSON only. An additional, explicitly approved UI change would be needed to display its new fields.
