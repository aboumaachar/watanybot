-- SLICE-5C minimal forward provenance. Source group and sender metadata stay server-private.
ALTER TABLE community_messages
  ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS forward_source_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_community_messages_forward_source
  ON community_messages(forward_source_message_id)
  WHERE forward_source_message_id IS NOT NULL;