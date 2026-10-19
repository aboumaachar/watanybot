BEGIN;

ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS collect_applications BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE job_postings
  DROP CONSTRAINT IF EXISTS job_postings_status_check;

ALTER TABLE job_postings
  ADD CONSTRAINT job_postings_status_check
  CHECK (status IN ('DRAFT','PUBLISHED','SUSPENDED','CLOSED','ARCHIVED'));

COMMIT;
