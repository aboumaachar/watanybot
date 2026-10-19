BEGIN;

CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_name TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  description TEXT,
  employment_type TEXT,
  work_mode TEXT,
  governorate TEXT,
  caza TEXT,
  locality TEXT,
  salary_text TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PUBLISHED','CLOSED','ARCHIVED')),
  published_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_postings_owner_status ON job_postings(owner_user_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_postings_public ON job_postings(status,published_at DESC);

CREATE TABLE IF NOT EXISTS job_posting_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL
    CHECK (field_type IN ('text','textarea','number','email','tel','date','select','radio','checkbox')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  placeholder TEXT,
  help_text TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(job_posting_id,field_key)
);
CREATE INDEX IF NOT EXISTS idx_job_posting_fields_job ON job_posting_form_fields(job_posting_id,sort_order);

CREATE TABLE IF NOT EXISTS job_posting_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  applicant_phone TEXT NOT NULL,
  applicant_email TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  prefill_source TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (prefill_source IN ('MANUAL','PROFILE','PREVIOUS_APPLICATION','SAVED_TEMPLATE')),
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','SCREENING','CONTACTED','SHORTLISTED','INTERVIEW','ACCEPTED','REJECTED','WITHDRAWN')),
  employer_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_posting_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_job_posting_apps_job_status ON job_posting_applications(job_posting_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_posting_apps_user ON job_posting_applications(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS job_applicant_saved_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,name)
);
CREATE INDEX IF NOT EXISTS idx_job_applicant_templates_user ON job_applicant_saved_templates(user_id,updated_at DESC);

COMMIT;
