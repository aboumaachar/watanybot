-- APEX V1.0.21.4: private per-user Community message Star/Save persistence.
CREATE TABLE IF NOT EXISTS community_message_stars (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_community_message_stars_user_created_at
    ON community_message_stars (user_id, created_at DESC);