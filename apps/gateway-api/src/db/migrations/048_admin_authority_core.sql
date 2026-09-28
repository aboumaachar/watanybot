CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  approval_id TEXT,
  request_id TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  immutable_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created_at
  ON admin_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_event_type
  ON admin_audit_events (event_type);

CREATE TABLE IF NOT EXISTS admin_approval_requests (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  reason TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  decision_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_status_created
  ON admin_approval_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_entity_versions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  UNIQUE(entity_type, entity_id, version)
);

CREATE INDEX IF NOT EXISTS idx_admin_entity_versions_lookup
  ON admin_entity_versions (entity_type, entity_id, version DESC);
