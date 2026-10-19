BEGIN;

ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS location_data JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE job_posting_form_fields
  DROP CONSTRAINT IF EXISTS job_posting_form_fields_field_type_check;

ALTER TABLE job_posting_form_fields
  ADD CONSTRAINT job_posting_form_fields_field_type_check
  CHECK (field_type IN (
    'text','textarea','number','integer','email','tel','phone','date',
    'select','radio','checkbox','yes_no','multi_select','universal_locator'
  ));

COMMIT;
