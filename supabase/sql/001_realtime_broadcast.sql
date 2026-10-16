-- ZoKivo Realtime Broadcast / dedicated ZoKivo Supabase SQL Editor.
-- Neon remains the authoritative game database.
-- Broadcast via REST needs no CREATE TABLE or ALTER PUBLICATION.
-- No data is made publicly selectable by running this test.

SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'realtime')
 AS realtime_schema_installed;

-- Optional harmless Broadcast smoke test.
SELECT realtime.send(
 '{"v":1,"test":true}'::jsonb,
 'refresh',
 'zokivo-realtime-healthcheck',
 FALSE
);
