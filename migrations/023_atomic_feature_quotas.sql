-- 023: Atomic per-scope feature quotas; manual migration, isolated QA first.
-- PostgreSQL plpgsql statements obtain a new READ COMMITTED snapshot after taking
-- a namespaced transaction advisory lock, serializing count and insertion.
CREATE OR REPLACE FUNCTION public.zokivo_guard_study_rate()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('zokivo:study:' || NEW.owner_user_id,0));
 IF (SELECT count(*) FROM public.study_attempts
     WHERE owner_user_id=NEW.owner_user_id
       AND created_at>clock_timestamp()-interval '1 minute')>=45 THEN
  RAISE EXCEPTION 'ZOKIVO_STUDY_RATE_LIMIT' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zokivo_study_rate_guard ON public.study_attempts;
CREATE TRIGGER zokivo_study_rate_guard BEFORE INSERT ON public.study_attempts
FOR EACH ROW EXECUTE FUNCTION public.zokivo_guard_study_rate();

CREATE OR REPLACE FUNCTION public.zokivo_guard_ai_conversation_count()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('zokivo:ai-conversations:' || NEW.owner_user_id,0));
 IF (SELECT count(*) FROM public.ai_chat_conversations
     WHERE owner_user_id=NEW.owner_user_id)>=40 THEN
  RAISE EXCEPTION 'ZOKIVO_AI_CONVERSATION_LIMIT' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zokivo_ai_conversation_count_guard ON public.ai_chat_conversations;
CREATE TRIGGER zokivo_ai_conversation_count_guard BEFORE INSERT ON public.ai_chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.zokivo_guard_ai_conversation_count();

CREATE OR REPLACE FUNCTION public.zokivo_guard_ai_message_count()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('zokivo:ai-messages:' || NEW.conversation_id::text,0));
 -- A duplicate client ID is a retried message, handled by the existing upsert.
 IF EXISTS (SELECT 1 FROM public.ai_chat_messages
            WHERE conversation_id=NEW.conversation_id AND client_message_id=NEW.client_message_id) THEN
  RETURN NEW;
 END IF;
 IF (SELECT count(*) FROM public.ai_chat_messages
     WHERE conversation_id=NEW.conversation_id)>=200 THEN
  RAISE EXCEPTION 'ZOKIVO_AI_MESSAGE_LIMIT' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zokivo_ai_message_count_guard ON public.ai_chat_messages;
CREATE TRIGGER zokivo_ai_message_count_guard BEFORE INSERT ON public.ai_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.zokivo_guard_ai_message_count();

CREATE OR REPLACE FUNCTION public.zokivo_guard_assignment_count()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('zokivo:assignments:' || NEW.owner_user_id,0));
 IF (SELECT count(*) FROM public.teacher_assignments WHERE owner_user_id=NEW.owner_user_id)>=100 THEN
  RAISE EXCEPTION 'ZOKIVO_ASSIGNMENT_LIMIT' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zokivo_assignment_count_guard ON public.teacher_assignments;
CREATE TRIGGER zokivo_assignment_count_guard BEFORE INSERT ON public.teacher_assignments
FOR EACH ROW EXECUTE FUNCTION public.zokivo_guard_assignment_count();
