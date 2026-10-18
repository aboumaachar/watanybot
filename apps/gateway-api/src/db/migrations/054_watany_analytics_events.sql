-- WatanyBot Article SEO analytics event persistence.
-- Additive migration owned by src/db/migrate.ts SQL authority.

CREATE TABLE IF NOT EXISTS watany_analytics_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id VARCHAR(100),
  session_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type
  ON watany_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user
  ON watany_analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created
  ON watany_analytics_events(created_at);
