-- 003_cases.sql — Cases & documents

CREATE TABLE IF NOT EXISTS cases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'other'
              CHECK (type IN ('dependents','death_inheritance','medical','schooling','pension_payment','other')),
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','in_progress','submitted','done')),
  checklist   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_id);

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'file'
              CHECK (kind IN ('image','pdf','doc','file')),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','verified','rejected')),
  tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_path   TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
