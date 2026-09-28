CREATE TABLE IF NOT EXISTS user_feature_overrides (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_user_feature_overrides_user_updated
  ON user_feature_overrides (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_feature_overrides_feature
  ON user_feature_overrides (feature_id);
