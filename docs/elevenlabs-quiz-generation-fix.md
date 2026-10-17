# ZoKivo AI → Creator quiz generation

## Diagnosis (2026-10-17)

The previous ZoKivo AI chat used a voice-oriented ElevenLabs agent. The `✦ Ask AI for quiz JSON` control only copied a fixed *easy English Year 7* instruction into the unsent chat draft; it did not generate a quiz. In the captured conversation the agent asked follow-up questions, then spoke **one** question with option C and claimed a server save tool was unavailable. Creator import only accepts complete validated quiz JSON, so the review button never appeared.

## Implemented application fix

- `/ai` now has a one-click Generate quiz action (subject, grade, level 1–5, count 4/6/8/10, output language en/zh/ms).
- When not connected, the prompt is queued and delivered *once* the existing authenticated ElevenLabs signed WebSocket opens; chat messages continue to be encrypted and saved with the existing account validation.
- The prompt asks for all questions in a single valid object, rather than a voice-style single-question tutoring turn. `parseSuggestedQuiz` validates schema, answer indices, distinct options and text bounds; **nothing is automatically published or inserted into a user's library**.
- `Retry as structured JSON` appears when the Agent provides prose instead of importable JSON.
- The **optional** ElevenLabs client tool `submit_quiz_draft` accepts only a valid quiz object, in response to an explicit user-generated request. The app validates tool arguments, saves validated data in the current authorized encrypted conversation, and enables `Review in Creator`; all unknown tools remain refused.
- Teacher review in `/create?source=ai` and the existing teacher-only `/publish` authorization remain intact.

## REQUIRED ElevenLabs Agent configuration

**Code changes alone cannot change the Agent's remote prompt, response token limits, or register its client tools.** In your ElevenLabs dashboard, open the configured `ELEVENLABS_AGENT_ID`, edit its **System prompt / Instructions**, and publish the change. Preserve its general learning-assistant functionality while adding this block:

```text
You are ZoKivo AI, a classroom learning and quiz-drafting assistant.
When a user requests a quiz and provides a subject, grade/year, language,
difficulty and question count, GENERATE THE ENTIRE REQUESTED QUIZ IMMEDIATELY.
Do not ask for details already provided.
Treat a request containing "COMPLETE classroom-ready quiz DATA EXPORT" as
structured DATA OUTPUT, not an interactive spoken quiz or tutorial.
Return ONE complete RFC8259 JSON object and NO prose or Markdown, with:
{
 "title": "Meaningful title",
 "subject": "English",
 "grade_level": "Year 7",
 "language": "en",
 "description": "Short description",
 "questions": [
  {
   "question": "A well-formed question",
   "options": ["Distinct A", "Distinct B", "Distinct C", "Distinct D"],
   "correct_option_index": 0,
   "explanation": "Why this answer is correct"
  }
 ]
}
Use the user's specified subject, grade, language and question count exactly.
For all multiple choice questions include 4 distinct options, a numeric correct
index from 0 to 3, and an explanation. Do not return only the first question.
English=en, Simplified Chinese=zh, Bahasa Melayu=ms. Avoid unsupported claims,
incorrect answers, tool limitations and fabricated saves.
If submit_quiz_draft is configured, call that client tool with the complete
quiz object instead of narrating the JSON.
Do not pretend to save/publish. Creator enables human review; publishing
requires a verified teacher and is never an agent privilege.
```

### Recommended reliable structured-output tool (optional but preferred)

Create an **ElevenLabs Client Tool** named exactly `submit_quiz_draft` with object parameters:
`title` string, `subject` string, `grade_level` string,
`language` string enum `en|zh|ms`, `description` string, `questions` array (1–40 entries).
Each question object needs `question` string, `options` array of exactly 4 strings,
`correct_option_index` integer 0–3 and `explanation` string.

Client tools run **only in the authenticated browser**; they have no database-write authority.
The frontend stores validated responses through the existing `/api/ai/conversations/:id/messages` endpoint. **Do not** give the agent the teacher publish endpoint, authentication credentials, or write-capable API tokens.

### Production validation

1. After deploying, open `/ai` and sign in. Choose **Year 7 / English / Level 5 / four questions / English**.
2. Select **Generate full quiz with AI** once. Confirm it connects automatically, sends the prompt, receives **4 distinct questions** rather than a single spoken example, and surfaces `Review 4 AI questions in Creator`.
3. Open Creator; verify all answers, explanations and language. Save a private draft. An unapproved student must still be unable to publish.
4. Repeat with Simplified Chinese and Bahasa Melayu if those languages are enabled in ElevenLabs Agent language settings. Code cannot force an English-only provider to speak three languages.
5. Attempt malformed JSON, unknown tool names, duplicate options, an invalid answer index, and missing/expired login: all should fail closed.
6. Do **not** claim a full live fix until an authenticated user has completed a real ElevenLabs quiz-generation and Creator import end-to-end run.

Source documentation:
- https://elevenlabs.io/docs/eleven-agents/libraries/web-sockets
- https://elevenlabs.io/docs/eleven-agents/customization/events/client-events
- https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides
