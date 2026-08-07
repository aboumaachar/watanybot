-- Wave12 Freelancer Marketplace Hardening additive migration proposal.
-- Review against active DB adapter before applying in production.

CREATE TABLE IF NOT EXISTS civilian_jobs_freelancer_profiles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  display_name TEXT NOT NULL,
  phone TEXT,
  profile_status TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  profile_type TEXT NOT NULL,
  skills_json TEXT NOT NULL,
  availability_json TEXT NOT NULL,
  coverage_areas_json TEXT NOT NULL,
  equipment_ids_json TEXT NOT NULL,
  certification_ids_json TEXT NOT NULL,
  veteran_tags_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS civilian_jobs_freelancer_skill_suggestions (
  id TEXT PRIMARY KEY,
  submitted_by_user_id TEXT,
  raw_label TEXT NOT NULL,
  normalized_label TEXT NOT NULL,
  suggested_category TEXT,
  status TEXT NOT NULL,
  merge_into_skill_id TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cj_freelancer_profile_status ON civilian_jobs_freelancer_profiles(profile_status);
CREATE INDEX IF NOT EXISTS idx_cj_freelancer_profile_type ON civilian_jobs_freelancer_profiles(profile_type);
CREATE INDEX IF NOT EXISTS idx_cj_skill_suggestion_status ON civilian_jobs_freelancer_skill_suggestions(status);