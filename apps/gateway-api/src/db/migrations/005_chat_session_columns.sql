-- 005_chat_session_columns.sql — Add missing columns for real-time admin monitoring

-- Add missing columns to chat_sessions
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'web';
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS message_count INT DEFAULT 0;

-- Create index for recent session queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_msg ON chat_sessions(last_message_at DESC);
