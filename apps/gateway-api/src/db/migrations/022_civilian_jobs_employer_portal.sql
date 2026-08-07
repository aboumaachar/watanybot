-- Additive proposal only: apply through your project migration process after review.
CREATE TABLE IF NOT EXISTS civilian_employer_profiles (
  id VARCHAR(128) PRIMARY KEY,
  organization_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  sector TEXT,
  location_label TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
  veteran_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS civilian_employer_opportunity_needs (
  id VARCHAR(128) PRIMARY KEY,
  employer_id VARCHAR(128) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  needed_skill_ids TEXT NOT NULL,
  location_label TEXT,
  work_mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);