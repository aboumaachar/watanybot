BEGIN;

CREATE TABLE IF NOT EXISTS universal_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  draft_fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS universal_form_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES universal_forms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  fields_json JSONB NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_by TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(form_id, version)
);
CREATE TABLE IF NOT EXISTS universal_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  form_id UUID NOT NULL REFERENCES universal_forms(id) ON DELETE CASCADE,
  form_version INTEGER NOT NULL,
  submitter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','IN_REVIEW','APPROVED','REJECTED','ARCHIVED')),
  admin_notes TEXT,
  source_type TEXT,
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universal_forms_status_updated
  ON universal_forms(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_universal_form_submissions_form_created
  ON universal_form_submissions(form_id, created_at DESC);

ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS application_form_id UUID REFERENCES universal_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS application_form_version INTEGER;

COMMIT;