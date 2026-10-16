-- Original ZoKivo player avatar selection (no Blooket assets).
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_id TEXT NOT NULL DEFAULT 'spark'
CHECK(avatar_id IN ('spark','fox','turtle','owl','robot','whale','rocket','sun'));
