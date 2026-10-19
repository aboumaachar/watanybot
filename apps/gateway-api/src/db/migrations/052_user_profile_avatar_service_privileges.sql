-- User management v3: profile avatar + additive service privileges.
-- Account RBAC role remains independent from these service-domain privileges.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS user_service_privileges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  privilege TEXT NOT NULL CHECK (privilege IN ('taxi_driver','seller','employer')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, privilege)
);

CREATE INDEX IF NOT EXISTS idx_user_service_privileges_privilege_enabled
  ON user_service_privileges(privilege, enabled);

-- Preserve the existing taxi-driver account semantics as an initial service entitlement.
INSERT INTO user_service_privileges (user_id, privilege, enabled)
SELECT id, 'taxi_driver', TRUE FROM users WHERE role = 'driver'
ON CONFLICT (user_id, privilege) DO NOTHING;
