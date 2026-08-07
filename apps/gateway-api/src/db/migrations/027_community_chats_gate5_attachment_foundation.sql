-- 027_community_chats_gate5_attachment_foundation.sql
-- Protected community attachment metadata for Gate 5 message attachments and voice notes.

CREATE TABLE IF NOT EXISTS community_message_attachments (
  id                  TEXT PRIMARY KEY,
  group_id            TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  message_id          TEXT REFERENCES community_messages(id) ON DELETE SET NULL,
  uploaded_by_user_id TEXT NOT NULL,
  original_name       TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  bytes               BIGINT NOT NULL CHECK (bytes >= 0),
  sha256              TEXT NOT NULL,
  storage_key         TEXT NOT NULL UNIQUE,
  scan_status         TEXT NOT NULL CHECK (scan_status IN ('clean')),
  scan_provider       TEXT,
  scanned_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_message_attachments_group_created
  ON community_message_attachments(group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_message_attachments_message
  ON community_message_attachments(message_id)
  WHERE message_id IS NOT NULL;