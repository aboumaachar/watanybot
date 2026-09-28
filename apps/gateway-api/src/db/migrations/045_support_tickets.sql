CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open', priority TEXT NOT NULL DEFAULT 'normal', category TEXT NOT NULL DEFAULT 'other',
  title_lb TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', intent TEXT NOT NULL DEFAULT '', domain TEXT NOT NULL DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT '', escalation_reason TEXT NOT NULL DEFAULT '', history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_requester_created ON tickets (requester_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_status ON tickets (requester_user_id, status);
