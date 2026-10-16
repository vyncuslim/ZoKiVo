-- Question ordering, sound preference and points-based finish conditions.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS question_order JSONB;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS random_question_order BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mute_sounds BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS score_goal INTEGER CHECK(score_goal IN (500,1000,2000,5000));
