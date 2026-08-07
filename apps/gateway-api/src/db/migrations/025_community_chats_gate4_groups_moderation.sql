-- 025_community_chats_gate4_groups_moderation.sql
-- Additive Gate 4 community group lifecycle, moderation, reporting, and appeals state.

ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS member_limit INTEGER NOT NULL DEFAULT 500;

ALTER TABLE community_groups
  DROP CONSTRAINT IF EXISTS community_groups_member_limit_check;

ALTER TABLE community_groups
  ADD CONSTRAINT community_groups_member_limit_check
  CHECK (member_limit > 0 AND member_limit <= 5000);

ALTER TABLE community_group_members
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_by TEXT,
  ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE community_group_members
  DROP CONSTRAINT IF EXISTS community_group_members_status_check;

ALTER TABLE community_group_members
  ADD CONSTRAINT community_group_members_status_check
  CHECK (status IN ('pending','active','invited','muted','suspended','removed','left','banned','rejected'));

CREATE INDEX IF NOT EXISTS idx_community_group_members_group_status
  ON community_group_members(group_id, status, role);

CREATE INDEX IF NOT EXISTS idx_community_group_members_status_window
  ON community_group_members(user_id, muted_until, suspended_until, banned_at);

CREATE TABLE IF NOT EXISTS community_group_invitations (
  id                TEXT PRIMARY KEY,
  group_id          TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  invited_user_id   TEXT NOT NULL,
  invited_by_user_id TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','revoked','expired')),
  note              TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  accepted_at       TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  revoked_by_user_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_group_invitations_lookup
  ON community_group_invitations(group_id, invited_user_id, status, expires_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_group_invitations_pending_unique
  ON community_group_invitations(group_id, invited_user_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS community_reports (
  id                  TEXT PRIMARY KEY,
  group_id            TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  reporter_user_id    TEXT NOT NULL,
  target_type         TEXT NOT NULL
                      CHECK (target_type IN ('message','member','group','moderation_action')),
  target_id           TEXT NOT NULL,
  reason_category     TEXT NOT NULL
                      CHECK (reason_category IN (
                        'harassment',
                        'threats',
                        'spam',
                        'impersonation',
                        'fraud',
                        'hate_or_discriminatory_abuse',
                        'privacy_violation',
                        'inappropriate_content',
                        'misinformation_requiring_review',
                        'other'
                      )),
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','under_review','actioned','dismissed','appealed','resolved')),
  assigned_reviewer_id TEXT,
  resolution          TEXT,
  appeal_status       TEXT
                      CHECK (appeal_status IN ('open','under_review','resolved')),
  audit_event_id      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ,
  resolved_by_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_community_reports_group_status
  ON community_reports(group_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_reports_reporter_status
  ON community_reports(reporter_user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_reports_open_dedup
  ON community_reports(group_id, reporter_user_id, target_type, target_id, reason_category)
  WHERE status IN ('open','under_review','appealed');

CREATE TABLE IF NOT EXISTS community_moderation_actions (
  id                 TEXT PRIMARY KEY,
  group_id           TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  actor_user_id      TEXT NOT NULL,
  actor_role         TEXT NOT NULL,
  target_type        TEXT NOT NULL
                     CHECK (target_type IN ('group','member','message','report')),
  target_id          TEXT NOT NULL,
  action_type        TEXT NOT NULL
                     CHECK (action_type IN (
                       'membership_requested',
                       'membership_approved',
                       'membership_rejected',
                       'invitation_created',
                       'invitation_accepted',
                       'invitation_revoked',
                       'member_warned',
                       'member_muted',
                       'member_unmuted',
                       'member_removed',
                       'member_suspended',
                       'member_reinstated',
                       'member_banned',
                       'content_hidden',
                       'content_removed',
                       'moderator_assigned',
                       'moderator_revoked',
                       'appeal_resolved'
                     )),
  reason             TEXT NOT NULL,
  duration           TEXT
                     CHECK (duration IN ('24h','7d','30d','permanent')),
  report_id          TEXT REFERENCES community_reports(id) ON DELETE SET NULL,
  previous_state     JSONB,
  resulting_state    JSONB,
  audit_event_id     TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_moderation_actions_group_created
  ON community_moderation_actions(group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_moderation_actions_target
  ON community_moderation_actions(target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_appeals (
  id                    TEXT PRIMARY KEY,
  group_id              TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  moderation_action_id  TEXT NOT NULL REFERENCES community_moderation_actions(id) ON DELETE CASCADE,
  audit_event_id        TEXT NOT NULL,
  appellant_user_id     TEXT NOT NULL,
  reason                TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','under_review','resolved')),
  resolution_outcome    TEXT
                        CHECK (resolution_outcome IN ('upheld','modified','reversed')),
  resolution_reason     TEXT,
  resolved_by_user_id   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_community_appeals_group_status
  ON community_appeals(group_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_appeals_open_unique
  ON community_appeals(moderation_action_id, appellant_user_id)
  WHERE status IN ('open','under_review');