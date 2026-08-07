-- 030_community_chats_gate5_voice_duration.sql
-- Persist authoritative voice-attachment duration metadata for Gate 5 validation.

ALTER TABLE community_message_attachments
  ADD COLUMN IF NOT EXISTS duration_ms BIGINT
  CHECK (duration_ms IS NULL OR duration_ms >= 0);