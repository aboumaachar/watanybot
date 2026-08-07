-- 008_phone_otp_auth.sql
-- Enable phone-number-first account creation via OTP.
-- Safe to run on top of existing schema (uses IF NOT EXISTS / IF EXISTS guards).

-- 1. Allow phone-first accounts: email becomes optional
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- 2. Allow phone-only accounts: password_hash optional (empty string for phone users)
ALTER TABLE users ALTER COLUMN password_hash SET DEFAULT '';
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 3. phone_number unique constraint (NULLs are not considered equal in PostgreSQL UNIQUE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_phone_number_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_phone_number_unique UNIQUE (phone_number);
  END IF;
END $$;

-- 4. phone_verified_at — when the phone was last verified via OTP
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- 5. profile_completed — whether the user has filled in optional profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false;

-- 6. service_number — military service number (alias for military_id, used by newer forms)
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_number TEXT;

-- 7. user_type — veteran category
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT
  CHECK (user_type IS NULL OR user_type IN ('retired', 'family_member', 'widow', 'beneficiary'));

-- 8. OTP table
CREATE TABLE IF NOT EXISTS phone_otps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  code_hash    TEXT NOT NULL,      -- bcrypt hash — never store plain code
  purpose      TEXT NOT NULL DEFAULT 'login',
  expires_at   TIMESTAMPTZ NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  consumed_at  TIMESTAMPTZ,        -- NULL = still active
  request_ip   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone_created
  ON phone_otps(phone_number, created_at);
