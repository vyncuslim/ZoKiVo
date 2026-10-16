-- Additive migration: same classroom may use ZoKivo and Wayground card numbers 1-60 together.
-- Keep legacy paper_submissions; existing rows are copied without deleting the original.
CREATE TABLE IF NOT EXISTS paper_card_submissions (
 session_pin CHAR(6) NOT NULL REFERENCES paper_sessions(pin) ON DELETE CASCADE,
 question_index INT NOT NULL CHECK(question_index>=0),
 card_source TEXT NOT NULL CHECK(card_source IN ('zokivo','wayground')),
 card_number INT NOT NULL CHECK(card_number BETWEEN 1 AND 60),
 choice SMALLINT NOT NULL CHECK(choice BETWEEN 0 AND 3),
 correct BOOLEAN NOT NULL,
 points INT NOT NULL CHECK(points IN (0,100)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(session_pin,question_index,card_source,card_number)
);
CREATE INDEX IF NOT EXISTS paper_card_submissions_scores ON paper_card_submissions(session_pin,card_source,card_number);
INSERT INTO paper_card_submissions (session_pin,question_index,card_source,card_number,choice,correct,points,created_at)
SELECT session_pin,question_index,'zokivo',card_number,choice,correct,points,created_at
FROM paper_submissions
ON CONFLICT(session_pin,question_index,card_source,card_number) DO NOTHING;
