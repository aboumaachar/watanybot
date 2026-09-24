BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS account_origin TEXT;

CREATE INDEX IF NOT EXISTS idx_users_phone_digits
ON users ((regexp_replace(COALESCE(phone_number, phone, ''), '[^0-9]', '', 'g')));

CREATE TABLE IF NOT EXISTS job_application_user_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'job_application',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, application_id)
);
ALTER TABLE job_application_user_links
  ALTER COLUMN application_id TYPE TEXT USING application_id::text;

CREATE INDEX IF NOT EXISTS idx_job_application_user_links_user ON job_application_user_links(user_id);

CREATE TABLE IF NOT EXISTS job_readiness_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  work_modes TEXT[] NOT NULL DEFAULT '{}',
  governorate TEXT,
  caza TEXT,
  locality TEXT,
  available_from DATE,
  expected_salary TEXT,
  contact_visibility TEXT NOT NULL DEFAULT 'REGISTERED_EMPLOYERS' CHECK (contact_visibility IN ('REGISTERED_EMPLOYERS','HIDDEN')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_readiness_user ON job_readiness_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_job_readiness_status ON job_readiness_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_readiness_skills_gin ON job_readiness_requests USING GIN(skills);

CREATE TABLE IF NOT EXISTS job_employer_accounts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_employer_accounts_status ON job_employer_accounts(status);

COMMIT;
