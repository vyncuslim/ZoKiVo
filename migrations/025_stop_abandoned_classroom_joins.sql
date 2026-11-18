-- 025 / QA ONLY: prevent new students joining abandoned active rooms.
-- APPLY AFTER 023 AND 024; do not run against production without approval.
-- Preserve the current row-lock model and existing PINs, student scores,
-- teacher sessions and historical reports. No data is deleted or finished.
CREATE OR REPLACE FUNCTION public.zokivo_join_room(
 p_pin character, p_nickname character varying, p_token_hash character,
 p_avatar_id text, p_defense_code smallint, p_max_players integer DEFAULT 100)
RETURNS uuid
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE
 room_info public.rooms%ROWTYPE;
 total integer;
 new_player uuid;
BEGIN
 IF p_max_players<1 OR p_max_players>100 THEN RAISE EXCEPTION 'Invalid room capacity'; END IF;
 SELECT * INTO room_info FROM public.rooms WHERE pin=p_pin FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
 IF room_info.status='playing' AND room_info.deadline IS NOT NULL
    AND room_info.deadline<clock_timestamp()-interval '24 hours' THEN
  RAISE EXCEPTION 'Room needs host review' USING ERRCODE='P0001';
 END IF;
 IF room_info.status<>'lobby'
    AND NOT(room_info.status='playing' AND room_info.allow_late_joining) THEN
  RAISE EXCEPTION 'Room is not accepting new players';
 END IF;
 SELECT COUNT(*) INTO total FROM public.players WHERE room_pin=p_pin;
 IF total>=p_max_players THEN RAISE EXCEPTION 'Room is full'; END IF;
 INSERT INTO public.players(room_pin,nickname,token_hash,avatar_id,defense_code)
 VALUES(p_pin,p_nickname,p_token_hash,p_avatar_id,p_defense_code)
 RETURNING id INTO new_player;
 RETURN new_player;
END $$;
