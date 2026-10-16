-- ZoKivo AI conversation history: separate from ElevenLabs transcript metadata.
-- Ciphertext-only storage. Account ownership enforced in Next.js APIs.
CREATE TABLE IF NOT EXISTS ai_chat_conversations(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id TEXT NOT NULL,
 title VARCHAR(120) NOT NULL DEFAULT 'New conversation',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_chat_conversations_owner_idx ON ai_chat_conversations(owner_user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS ai_chat_messages(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
 client_message_id UUID NOT NULL,
 role TEXT NOT NULL CHECK(role IN('user','assistant')),
 ciphertext TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(conversation_id,client_message_id)
);
CREATE INDEX IF NOT EXISTS ai_chat_messages_history_idx ON ai_chat_messages(conversation_id,created_at,id);
