-- Solo Study progress. The server checks account ownership on every request.
CREATE TABLE IF NOT EXISTS study_attempts(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id TEXT NOT NULL,
 quiz_set_id UUID NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
 question_position INTEGER NOT NULL,
 chosen_index SMALLINT NOT NULL CHECK(chosen_index BETWEEN 0 AND 3),
 correct BOOLEAN NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_attempts_owner_quiz ON study_attempts(owner_user_id,quiz_set_id,created_at DESC);
CREATE INDEX IF NOT EXISTS study_attempts_owner_latest ON study_attempts(owner_user_id,created_at DESC);
