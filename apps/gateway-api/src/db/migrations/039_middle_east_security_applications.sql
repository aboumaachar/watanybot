CREATE TABLE IF NOT EXISTS middle_east_security_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  birth_place TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  preferred_location TEXT NOT NULL CHECK (preferred_location IN ('بيروت','طرابلس','عكار','الجنوب','البقاع')),
  arabic_read TEXT NOT NULL CHECK (arabic_read IN ('لا أجيد','وسط','جيد')),
  arabic_write TEXT NOT NULL CHECK (arabic_write IN ('لا أجيد','وسط','جيد')),
  english_read TEXT NOT NULL CHECK (english_read IN ('لا أجيد','وسط','جيد')),
  english_write TEXT NOT NULL CHECK (english_write IN ('لا أجيد','وسط','جيد')),
  security_training BOOLEAN NOT NULL,
  security_training_details TEXT,
  ngo_experience BOOLEAN NOT NULL,
  ngo_details TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mes_application_phone_unique ON middle_east_security_applications(phone);
CREATE INDEX IF NOT EXISTS mes_application_status_idx ON middle_east_security_applications(status, created_at DESC);
