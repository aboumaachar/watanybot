-- watany_001_cases.sql
-- Minimal "عرض حالة" (Option A) case tracking
CREATE TABLE IF NOT EXISTS cases (
  id            BIGSERIAL PRIMARY KEY,
  public_id     TEXT UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  user_id       TEXT,
  contact_phone TEXT,
  category      TEXT NOT NULL DEFAULT 'general',
  status        TEXT NOT NULL DEFAULT 'open', -- open|in_progress|resolved|closed
  subject       TEXT,
  details       TEXT,

  last_note     TEXT,
  ip_address    TEXT
);

CREATE INDEX IF NOT EXISTS idx_cases_public_id ON cases(public_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
