-- Host settings: backward-compatible defaults preserve existing rooms.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_late_joining BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS random_player_names BOOLEAN NOT NULL DEFAULT false;
