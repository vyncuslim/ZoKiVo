-- 019: hot-path indexes for ten parallel 100-player classrooms.
-- These indexes support compact round submission counts, individual session
-- token checks, and round-by-round prior score aggregation.
-- Apply only after production DB migration review / off-peak scheduling.
CREATE INDEX IF NOT EXISTS answers_room_question_player_idx
 ON public.answers(room_pin, question_index, player_id);
CREATE INDEX IF NOT EXISTS players_room_token_hash_idx
 ON public.players(room_pin, token_hash);
