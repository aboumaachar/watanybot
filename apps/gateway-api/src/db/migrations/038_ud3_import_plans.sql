BEGIN;

CREATE TABLE IF NOT EXISTS admin_import_plans (
  plan_id TEXT PRIMARY KEY,
  actor_gateway_user_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  input_canonical_hash TEXT NOT NULL,
  baseline_editorial_hash TEXT NOT NULL,
  semantic_diff_hash TEXT NOT NULL,
  input_payload JSONB NOT NULL,
  target_semantic_hash TEXT,
  resulting_payload_version_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('VALIDATED', 'APPLYING', 'APPLIED', 'RECOVERY_REQUIRED', 'EXPIRED', 'SUPERSEDED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  applied_at TIMESTAMPTZ
);

ALTER TABLE admin_import_plans
  ADD COLUMN IF NOT EXISTS target_semantic_hash TEXT,
  ADD COLUMN IF NOT EXISTS resulting_payload_version_id TEXT,
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS input_payload JSONB;

ALTER TABLE admin_import_plans
  DROP CONSTRAINT IF EXISTS admin_import_plans_status_check;

ALTER TABLE admin_import_plans
  ADD CONSTRAINT admin_import_plans_status_check
  CHECK (status IN ('VALIDATED', 'APPLYING', 'APPLIED', 'RECOVERY_REQUIRED', 'EXPIRED', 'SUPERSEDED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_admin_import_plans_status_created
  ON admin_import_plans (status, created_at DESC);

COMMIT;
