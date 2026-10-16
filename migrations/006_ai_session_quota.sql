-- Additive, development first. Quota protects a private AI beta from unlimited paid sessions.
CREATE TABLE IF NOT EXISTS ai_session_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_session_requests_owner_date ON ai_session_requests(owner_user_id,created_at DESC);
