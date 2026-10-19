-- 049_community_message_attachment_position.sql
-- Restore the attachment ordering column already required by the canonical Community service and upload route.

ALTER TABLE community_message_attachments
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0
  CHECK (position >= 0);

CREATE INDEX IF NOT EXISTS idx_community_message_attachments_message_position
  ON community_message_attachments(message_id, position ASC, created_at ASC, id ASC)
  WHERE message_id IS NOT NULL;
