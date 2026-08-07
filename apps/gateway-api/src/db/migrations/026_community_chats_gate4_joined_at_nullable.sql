-- 026_community_chats_gate4_joined_at_nullable.sql
-- Pending and invited memberships are not yet joined, so joined_at must be nullable.

ALTER TABLE community_group_members
  ALTER COLUMN joined_at DROP NOT NULL;