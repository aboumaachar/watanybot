-- 009_phone_verification_requests.sql
-- Correlate authenticated Watany phone-verification flows with SMS API request IDs.

CREATE TABLE IF NOT EXISTS phone_verification_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number       TEXT NOT NULL,
  sms_api_request_id TEXT NOT NULL UNIQUE,
  verification_backend TEXT NOT NULL DEFAULT 'sms_api',
  status             TEXT NOT NULL DEFAULT 'pending',
  expires_at         TIMESTAMPTZ,
  verified_at        TIMESTAMPTZ,
  request_ip         TEXT,
  user_agent         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_requests_user_created
  ON phone_verification_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_verification_requests_phone_created
  ON phone_verification_requests(phone_number, created_at DESC);