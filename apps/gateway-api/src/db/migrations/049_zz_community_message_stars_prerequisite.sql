-- Prerequisite for 050_community_message_stars_text_identity.sql.
--
-- 050 alters community_message_stars, but the table is created by
-- 20260626_community_message_stars.sql, which sorts after every 0xx file.
-- The runner applies files in filename order, so a fresh database failed at
-- 050 ("relation community_message_stars does not exist"). Production works
-- only because it applied 20260626 (2026-08-24) before 050 existed.
--
-- This file sorts immediately before 050 and repeats the 20260626 definition
-- exactly, so a fresh install follows production's historical path:
-- create (here) -> 050 converts user_id to TEXT and drops the users FK ->
-- 20260626 becomes a no-op. Every statement is IF NOT EXISTS, so on a database
-- that already has the table (production) this file changes nothing.
-- Do not rename or edit 050 or 20260626: both are recorded in _migrations.
CREATE TABLE IF NOT EXISTS community_message_stars (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_community_message_stars_user_created_at
    ON community_message_stars (user_id, created_at DESC);
