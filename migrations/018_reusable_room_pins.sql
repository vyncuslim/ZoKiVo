-- 018: Reusable game PINs with durable owner-scoped historical reports.
-- Active/lobby rooms are NEVER recycled. Archive and delete are atomic in the
-- same Postgres transaction; existing player and host tokens are invalidated.
CREATE TABLE IF NOT EXISTS room_archives(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 original_pin CHAR(6) NOT NULL,
 owner_user_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 game_mode TEXT NOT NULL,
 title TEXT NOT NULL,
 players INTEGER NOT NULL,
 submissions INTEGER NOT NULL,
 correct INTEGER NOT NULL,
 report JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS room_archives_owner_created
 ON room_archives(owner_user_id,created_at DESC);

CREATE OR REPLACE FUNCTION zokivo_allocate_room_reusing_finished(
 p_pin CHAR(6), p_quiz UUID, p_host_hash CHAR(64), p_owner TEXT,
 p_seconds INTEGER, p_late BOOLEAN, p_random_names BOOLEAN,
 p_mode TEXT, p_question_order JSONB, p_shuffle BOOLEAN,
 p_mute BOOLEAN, p_score_goal INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
 old_room rooms%ROWTYPE;
 snapshot JSONB;
 snapshot_title TEXT;
 player_count INTEGER;
 submission_count INTEGER;
 correct_count INTEGER;
 allocated CHAR(6);
BEGIN
 -- Serialize only this PIN; do not touch any other currently hosted session.
 SELECT * INTO old_room FROM rooms WHERE pin=p_pin FOR UPDATE;
 IF FOUND THEN
  IF old_room.status<>'finished' THEN RETURN FALSE; END IF;
  -- A former host's full report survives in an immutable UUID-addressed
  -- archive. Its former PIN is historical metadata, NOT an access credential.
  IF old_room.owner_user_id IS NOT NULL THEN
   SELECT title INTO snapshot_title FROM quiz_sets WHERE id=old_room.quiz_set_id;
   SELECT count(*)::INTEGER INTO player_count FROM players WHERE room_pin=p_pin;
   SELECT count(*)::INTEGER,count(*) FILTER (WHERE is_correct)::INTEGER
    INTO submission_count,correct_count FROM answers WHERE room_pin=p_pin;
   SELECT jsonb_build_object(
    'room',jsonb_build_object('pin',p_pin,'kind','quiz','status','finished',
      'title',snapshot_title,'game_mode',old_room.game_mode,'created_at',old_room.created_at),
    'players',COALESCE((
     SELECT jsonb_agg(jsonb_build_object(
      'nickname',p.nickname,'score',p.score,
      'answered',(SELECT count(*) FROM answers a WHERE a.player_id=p.id AND a.room_pin=p_pin),
      'correct',(SELECT count(*) FROM answers a WHERE a.player_id=p.id AND a.room_pin=p_pin AND a.is_correct)
     ) ORDER BY p.score DESC,p.created_at)
     FROM players p WHERE p.room_pin=p_pin),'[]'::jsonb),
    'questions',COALESCE((
     SELECT jsonb_agg(jsonb_build_object(
      'position',q.position,'question',q.question,'choices',q.choices,
      'correct_index',q.correct_index,'explanation',q.explanation,
      'submissions',(SELECT count(*) FROM answers a WHERE a.room_pin=p_pin
       AND q.position=COALESCE((old_room.question_order->>a.question_index)::INTEGER,a.question_index)),
      'correct',(SELECT count(*) FROM answers a WHERE a.room_pin=p_pin AND a.is_correct
       AND q.position=COALESCE((old_room.question_order->>a.question_index)::INTEGER,a.question_index)),
      'a',(SELECT count(*) FROM answers a WHERE a.room_pin=p_pin AND a.chosen_index=0
       AND q.position=COALESCE((old_room.question_order->>a.question_index)::INTEGER,a.question_index)),
      'b',(SELECT count(*) FROM answers a WHERE a.room_pin=p_pin AND a.chosen_index=1
       AND q.position=COALESCE((old_room.question_order->>a.question_index)::INTEGER,a.question_index)),
      'c',(SELECT count(*) FROM answers a WHERE a.room_pin=p_pin AND a.chosen_index=2
       AND q.position=COALESCE((old_room.question_order->>a.question_index)::INTEGER,a.question_index)),
      'd',(SELECT count(*) FROM answers a WHERE a.room_pin=p_pin AND a.chosen_index=3
       AND q.position=COALESCE((old_room.question_order->>a.question_index)::INTEGER,a.question_index))
     ) ORDER BY q.position)
     FROM questions q WHERE q.quiz_set_id=old_room.quiz_set_id),'[]'::jsonb),
    'rewards',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('action',x.action,'events',x.events,'earned',x.earned) ORDER BY x.action)
      FROM (SELECT action,count(*) AS events,COALESCE(sum(delta),0) AS earned
       FROM mode_events WHERE room_pin=p_pin GROUP BY action) x
    ),'[]'::jsonb)
   ) INTO snapshot;
   INSERT INTO room_archives(original_pin,owner_user_id,created_at,game_mode,title,players,submissions,correct,report)
    VALUES(p_pin,old_room.owner_user_id,old_room.created_at,old_room.game_mode,snapshot_title,
     player_count,submission_count,correct_count,snapshot);
  END IF;
  -- All live room-dependent data uses ON DELETE CASCADE. The archived report
  -- has no old player tokens, session keys or live room foreign keys.
  DELETE FROM rooms WHERE pin=p_pin AND status='finished';
 END IF;
 -- Concurrent allocations for the same unoccupied PIN safely race here.
 -- Only one wins; the loser simply tries another random PIN in the API.
 INSERT INTO rooms(pin,quiz_set_id,host_token_hash,owner_user_id,
   question_seconds,allow_late_joining,random_player_names,
   game_mode,question_order,random_question_order,mute_sounds,score_goal)
 VALUES(p_pin,p_quiz,p_host_hash,p_owner,p_seconds,p_late,p_random_names,
   p_mode,p_question_order,p_shuffle,p_mute,p_score_goal)
 ON CONFLICT DO NOTHING RETURNING pin INTO allocated;
 RETURN allocated IS NOT NULL;
END $$;
