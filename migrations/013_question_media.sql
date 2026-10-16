-- Rich media and optional custom timing/points for every question.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS audio_url TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS formula_text TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS point_value INTEGER NOT NULL DEFAULT 100 CHECK(point_value BETWEEN 50 AND 500);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS time_limit INTEGER CHECK(time_limit IN (10,15,20,30,45,60));
