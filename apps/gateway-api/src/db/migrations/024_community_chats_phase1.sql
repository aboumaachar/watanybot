-- 024_community_chats_phase1.sql
-- Durable community chats persistence for Phase 1.

CREATE TABLE IF NOT EXISTS community_groups (
  id                TEXT PRIMARY KEY,
  community_id      TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT NOT NULL
                    CHECK (category IN ('salary','healthcare','grants','laws','recruitment','support','general')),
  member_count      INTEGER NOT NULL DEFAULT 0,
  is_official       BOOLEAN NOT NULL DEFAULT FALSE,
  visibility        TEXT NOT NULL DEFAULT 'public'
                    CHECK (visibility IN ('public','private','invite_only')),
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at   TIMESTAMPTZ,
  pinned_message_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_community_groups_last_message ON community_groups(last_message_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_groups_visibility ON community_groups(visibility);

CREATE TABLE IF NOT EXISTS community_group_members (
  group_id     TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('member','moderator','owner')),
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','invited','removed')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by     TEXT,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_group_members_user ON community_group_members(user_id, status);

CREATE TABLE IF NOT EXISTS community_messages (
  id                         TEXT PRIMARY KEY,
  group_id                   TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  sender_id                  TEXT NOT NULL,
  sender_name                TEXT NOT NULL,
  sender_role                TEXT NOT NULL
                             CHECK (sender_role IN ('user','admin','superadmin','system')),
  type                       TEXT NOT NULL
                             CHECK (type IN ('text','announcement','attachment','voice','session_invite','procedure_card','payment_update')),
  body                       TEXT,
  attachment_url             TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at                  TIMESTAMPTZ,
  reply_to_message_id        TEXT,
  reply_to_preview           JSONB,
  deleted_for_everyone_at    TIMESTAMPTZ,
  deleted_for_everyone_by    TEXT,
  deleted_for_everyone_by_id TEXT,
  is_pinned                  BOOLEAN NOT NULL DEFAULT FALSE,
  client_request_id          TEXT
);
CREATE INDEX IF NOT EXISTS idx_community_messages_group_order ON community_messages(group_id, created_at ASC, id ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_messages_idempotency
  ON community_messages(group_id, sender_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS community_message_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id         TEXT NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
  group_id           TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  actor_user_id      TEXT,
  actor_display_name TEXT,
  event_type         TEXT NOT NULL
                     CHECK (event_type IN ('created','edited','deleted_for_everyone','announcement')),
  payload            JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_message_events_message ON community_message_events(message_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_message_events_group ON community_message_events(group_id, created_at ASC);

CREATE TABLE IF NOT EXISTS community_group_read_state (
  group_id              TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id               TEXT NOT NULL,
  last_read_message_id  TEXT,
  last_read_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_group_read_state_user ON community_group_read_state(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS community_typing_state (
  group_id     TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_typing_state_expiry ON community_typing_state(expires_at);

CREATE TABLE IF NOT EXISTS community_live_sessions (
  id            TEXT PRIMARY KEY,
  group_id      TEXT REFERENCES community_groups(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  host_name     TEXT NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  status        TEXT NOT NULL
                CHECK (status IN ('scheduled','live','ended','cancelled')),
  join_url      TEXT,
  recording_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_community_live_sessions_group ON community_live_sessions(group_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS community_seed_state (
  key        TEXT PRIMARY KEY,
  seeded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  data       JSONB
);