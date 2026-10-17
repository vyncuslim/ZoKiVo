-- 016: Serialized and capacity-limited guest joins. The room row is locked for each join.
CREATE OR REPLACE FUNCTION zokivo_join_room(
 p_pin CHAR(6), p_nickname VARCHAR(24), p_token_hash CHAR(64),
 p_avatar_id TEXT, p_defense_code SMALLINT, p_max_players INTEGER DEFAULT 100
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE room_info rooms%ROWTYPE; total INTEGER; new_player UUID;
BEGIN
 IF p_max_players<1 OR p_max_players>100 THEN RAISE EXCEPTION 'Invalid room capacity'; END IF;
 SELECT * INTO room_info FROM rooms WHERE pin=p_pin FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
 IF room_info.status<>'lobby' AND NOT(room_info.status='playing' AND room_info.allow_late_joining) THEN
  RAISE EXCEPTION 'Room is not accepting new players';
 END IF;
 SELECT COUNT(*) INTO total FROM players WHERE room_pin=p_pin;
 IF total>=p_max_players THEN RAISE EXCEPTION 'Room is full'; END IF;
 INSERT INTO players(room_pin,nickname,token_hash,avatar_id,defense_code)
 VALUES(p_pin,p_nickname,p_token_hash,p_avatar_id,p_defense_code)
 RETURNING id INTO new_player;
 RETURN new_player;
END $$;
