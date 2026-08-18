CREATE TABLE IF NOT EXISTS marketplace_job_applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  veteran_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  cover_letter TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_job_applications_phone
  ON marketplace_job_applications(phone);

CREATE INDEX IF NOT EXISTS idx_marketplace_job_applications_job
  ON marketplace_job_applications(job_id);