ALTER TABLE rooms ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE paper_sessions ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
CREATE INDEX IF NOT EXISTS rooms_owner_user_idx ON rooms(owner_user_id);
CREATE INDEX IF NOT EXISTS paper_owner_user_idx ON paper_sessions(owner_user_id);
