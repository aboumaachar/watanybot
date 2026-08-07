-- 028_community_chats_gate5_advanced_messaging.sql
-- Gate 5 advanced messaging foundations: mentions, reactions, delete-for-self, and extended message events.

ALTER TABLE community_messages
  ADD COLUMN IF NOT EXISTS mentions JSONB;

CREATE TABLE IF NOT EXISTS community_message_reactions (
  message_id   TEXT NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
  group_id     TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  emoji        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_community_message_reactions_message
  ON community_message_reactions(message_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_community_message_reactions_group
  ON community_message_reactions(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_message_hidden_for_user (
  message_id   TEXT NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
  group_id     TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  deleted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_message_hidden_for_user_group
  ON community_message_hidden_for_user(group_id, user_id, deleted_at DESC);

ALTER TABLE community_message_events
  DROP CONSTRAINT IF EXISTS community_message_events_event_type_check;

ALTER TABLE community_message_events
  ADD CONSTRAINT community_message_events_event_type_check
  CHECK (event_type IN (
    'created',
    'edited',
    'deleted_for_everyone',
    'announcement',
    'reaction_added',
    'reaction_removed',
    'deleted_for_self'
  ));