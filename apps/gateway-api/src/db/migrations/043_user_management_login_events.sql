-- 043_user_management_login_events.sql
-- Durable login-origin history for administrator user management.

CREATE TABLE IF NOT EXISTS user_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_ip TEXT,
  peer_ip TEXT,
  user_agent TEXT,
  auth_method TEXT NOT NULL DEFAULT 'password',
  success BOOLEAN NOT NULL DEFAULT true,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_login_events_user_time
  ON user_login_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_login_events_client_ip
  ON user_login_events(client_ip);
