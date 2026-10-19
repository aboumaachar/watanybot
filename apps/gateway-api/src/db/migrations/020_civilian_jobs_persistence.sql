-- Wave04 Civilian Jobs persistence and admin hardening
-- Additive-only migration. Does not alter recruitment-announcement tables.

CREATE TABLE IF NOT EXISTS civilian_job_opportunity_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  website_url TEXT,
  adapter_kind TEXT NOT NULL DEFAULT 'MANUAL',
  enabled INTEGER NOT NULL DEFAULT 0,
  compliance_status TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS civilian_job_opportunities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  location TEXT,
  description TEXT,
  source_id TEXT,
  source_url TEXT,
  deadline TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  archived_at TEXT,
  rejected_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  FOREIGN KEY (source_id) REFERENCES civilian_job_opportunity_sources(id)
);

CREATE TABLE IF NOT EXISTS civilian_job_applications (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_phone TEXT,
  applicant_type TEXT NOT NULL DEFAULT 'VETERAN',
  status TEXT NOT NULL DEFAULT 'NEW',
  note TEXT,
  cv_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT,
  FOREIGN KEY (opportunity_id) REFERENCES civilian_job_opportunities(id)
);

CREATE TABLE IF NOT EXISTS civilian_job_imported_opportunities (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  organization TEXT,
  location TEXT,
  raw_payload TEXT,
  normalized_payload TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  dedupe_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by TEXT,
  decision_note TEXT,
  FOREIGN KEY (source_id) REFERENCES civilian_job_opportunity_sources(id)
);

CREATE TABLE IF NOT EXISTS civilian_job_import_review_decisions (
  id TEXT PRIMARY KEY,
  imported_opportunity_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY (imported_opportunity_id) REFERENCES civilian_job_imported_opportunities(id)
);

CREATE TABLE IF NOT EXISTS civilian_job_admin_audit_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT,
  note TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_civilian_job_opportunities_status ON civilian_job_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_civilian_job_applications_opportunity ON civilian_job_applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_civilian_job_imported_status ON civilian_job_imported_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_civilian_job_audit_entity ON civilian_job_admin_audit_events(entity_type, entity_id);