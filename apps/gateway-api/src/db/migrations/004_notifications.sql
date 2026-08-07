-- 004_notifications.sql — Notifications, marketplace, jobs

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'system'
              CHECK (kind IN ('alert','case','doc','system')),
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL DEFAULT '',
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'USD',
  location    TEXT NOT NULL DEFAULT '',
  seller      TEXT NOT NULL DEFAULT '',
  contact     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','sold')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_vacancies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT '',
  company     TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  mode        TEXT NOT NULL DEFAULT 'onsite'
              CHECK (mode IN ('onsite','hybrid','remote')),
  summary     TEXT NOT NULL DEFAULT '',
  tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES job_vacancies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  email       TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_apps_job ON job_applications(job_id);

CREATE TABLE IF NOT EXISTS saved_chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_chats_user ON saved_chats(user_id);

CREATE TABLE IF NOT EXISTS filter_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT '',
  pattern     TEXT NOT NULL DEFAULT '',
  severity    TEXT NOT NULL DEFAULT 'low'
              CHECK (severity IN ('low','medium','high','critical')),
  action      TEXT NOT NULL DEFAULT 'warn'
              CHECK (action IN ('warn','block','redact','notify_admin')),
  enabled     BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
