-- ZoKivo Paper Mode, development-first migration.
CREATE TABLE IF NOT EXISTS paper_sessions (
  pin CHAR(6) PRIMARY KEY CHECK (pin ~ '^[0-9]{6}$'),
  quiz_set_id UUID NOT NULL REFERENCES quiz_sets(id),
  host_token_hash CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','playing','finished')),
  current_index INT NOT NULL DEFAULT -1 CHECK (current_index >= -1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS paper_submissions (
  session_pin CHAR(6) NOT NULL REFERENCES paper_sessions(pin) ON DELETE CASCADE,
  question_index INT NOT NULL CHECK (question_index >= 0),
  card_number INT NOT NULL CHECK (card_number BETWEEN 1 AND 60),
  choice SMALLINT NOT NULL CHECK (choice BETWEEN 0 AND 3),
  correct BOOLEAN NOT NULL,
  points INT NOT NULL CHECK (points IN (0,100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(session_pin,question_index,card_number)
);
CREATE INDEX IF NOT EXISTS paper_submissions_card_rank
 ON paper_submissions(session_pin,card_number);
