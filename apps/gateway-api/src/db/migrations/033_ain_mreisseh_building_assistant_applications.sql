CREATE TABLE IF NOT EXISTS ain_mreisseh_building_assistant_applications (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age TEXT NOT NULL,
  governorate TEXT NOT NULL,
  governorate_ar TEXT,
  caza TEXT NOT NULL,
  caza_ar TEXT,
  village TEXT NOT NULL,
  village_ar TEXT,
  village_id TEXT NOT NULL,
  can_work_full_time BOOLEAN NOT NULL DEFAULT FALSE,
  accepts_salary_600 BOOLEAN NOT NULL DEFAULT FALSE,
  wants_housing BOOLEAN NOT NULL DEFAULT FALSE,
  available_start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  follow_up_status TEXT NOT NULL DEFAULT 'not_contacted',
  admin_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ain_mreisseh_building_assistant_campaign_status
  ON ain_mreisseh_building_assistant_applications(campaign_id, status, created_at DESC);
