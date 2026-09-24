ALTER TABLE middle_east_security_applications
  ALTER COLUMN address DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS mohafaza TEXT,
  ADD COLUMN IF NOT EXISTS mohafaza_id TEXT,
  ADD COLUMN IF NOT EXISTS caza TEXT,
  ADD COLUMN IF NOT EXISTS caza_id TEXT,
  ADD COLUMN IF NOT EXISTS village TEXT,
  ADD COLUMN IF NOT EXISTS village_id TEXT,
  ADD COLUMN IF NOT EXISTS village_pcode TEXT,
  ADD COLUMN IF NOT EXISTS location_dataset_version TEXT,
  ADD COLUMN IF NOT EXISTS location_approval_status TEXT;

CREATE INDEX IF NOT EXISTS mes_application_village_idx
  ON middle_east_security_applications(village_id, created_at DESC);
