BEGIN;

CREATE TABLE IF NOT EXISTS legacy_wp_user_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  canonical_wp_id BIGINT NOT NULL UNIQUE,
  source_wp_ids BIGINT[] NOT NULL DEFAULT '{}',
  source_username TEXT,
  source_primary_email TEXT,
  secondary_emails TEXT[] NOT NULL DEFAULT '{}',
  shared_phone TEXT,
  identity_verification_required BOOLEAN NOT NULL DEFAULT FALSE,
  credential_mode TEXT NOT NULL DEFAULT 'phone_fallback'
    CHECK (credential_mode IN ('phone_fallback','legacy_wp','reset_required')),
  credential_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
  source_registered_at TIMESTAMPTZ,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legacy_wp_user_identities_user
  ON legacy_wp_user_identities(user_id);

CREATE INDEX IF NOT EXISTS idx_legacy_wp_shared_phone
  ON legacy_wp_user_identities ((regexp_replace(COALESCE(shared_phone,''), '[^0-9]', '', 'g')));

CREATE TABLE IF NOT EXISTS user_secondary_emails (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wordpress_legacy',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, email)
);
CREATE INDEX IF NOT EXISTS idx_user_secondary_emails_lower
  ON user_secondary_emails ((lower(email)));

COMMIT;
