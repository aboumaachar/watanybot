-- Optional SQL schema for production DB migration.
-- Use if WatanyBot/Koudama production persistence is SQL-backed.

CREATE TABLE IF NOT EXISTS seasonal_job_applications (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NULL,
  age TEXT NOT NULL,
  gender TEXT NULL,
  relation_type TEXT NOT NULL,
  governorate TEXT NOT NULL,
  caza TEXT NOT NULL,
  village TEXT NOT NULL,
  village_id TEXT NULL,
  availability TEXT NOT NULL,
  can_arrive_6am BOOLEAN NOT NULL,
  has_agri_experience BOOLEAN NOT NULL,
  experience_text TEXT NULL,
  can_stand_hours BOOLEAN NOT NULL,
  health_note TEXT NULL,
  future_jobs_interest BOOLEAN NOT NULL,
  weighted_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review',
  follow_up_status TEXT NOT NULL DEFAULT 'not_contacted',
  admin_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seasonal_job_applications_campaign_status
ON seasonal_job_applications (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_seasonal_job_applications_score_created
ON seasonal_job_applications (weighted_score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_seasonal_job_applications_location
ON seasonal_job_applications (governorate, caza, village);