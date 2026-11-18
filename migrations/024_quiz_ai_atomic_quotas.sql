-- 024 manual-only schema migration, apply AFTER 023 on isolated QA Neon.
-- The default state preserves old successful AI records; no production writes now.
ALTER TABLE public.ai_session_requests ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'issued';
ALTER TABLE public.ai_session_requests ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE public.ai_session_requests DROP CONSTRAINT IF EXISTS zokivo_ai_session_state_check;
ALTER TABLE public.ai_session_requests ADD CONSTRAINT zokivo_ai_session_state_check
 CHECK(state IN ('issued','reserved') AND (state='issued' OR lease_expires_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS ai_session_requests_owner_live_idx
 ON public.ai_session_requests(owner_user_id,state,created_at,lease_expires_at);

CREATE OR REPLACE FUNCTION public.zokivo_guard_quiz_count()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.owner_user_id IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('zokivo:quizzes:' || NEW.owner_user_id,0));
 IF (SELECT count(*) FROM public.quiz_sets WHERE owner_user_id=NEW.owner_user_id)>=100 THEN
  RAISE EXCEPTION 'ZOKIVO_QUIZ_LIMIT' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zokivo_quiz_count_guard ON public.quiz_sets;
CREATE TRIGGER zokivo_quiz_count_guard BEFORE INSERT ON public.quiz_sets
 FOR EACH ROW EXECUTE FUNCTION public.zokivo_guard_quiz_count();
REVOKE EXECUTE ON FUNCTION public.zokivo_guard_quiz_count() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.zokivo_guard_ai_session_count()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('zokivo:ai-sessions:' || NEW.owner_user_id,0));
 IF (SELECT count(*) FROM public.ai_session_requests
    WHERE owner_user_id=NEW.owner_user_id
     AND ((state='issued' AND created_at>clock_timestamp()-interval '24 hours')
       OR (state='reserved' AND lease_expires_at>clock_timestamp())))>=10 THEN
  RAISE EXCEPTION 'ZOKIVO_AI_SESSION_LIMIT' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zokivo_ai_session_count_guard ON public.ai_session_requests;
CREATE TRIGGER zokivo_ai_session_count_guard BEFORE INSERT ON public.ai_session_requests
 FOR EACH ROW EXECUTE FUNCTION public.zokivo_guard_ai_session_count();
REVOKE EXECUTE ON FUNCTION public.zokivo_guard_ai_session_count() FROM PUBLIC;
