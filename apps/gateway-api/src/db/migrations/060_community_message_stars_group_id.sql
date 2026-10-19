-- Community message stars: add the group_id column the runtime writes.
--
-- community/service.ts inserts (message_id, group_id, user_id) into
-- community_message_stars, but no migration in this chain adds group_id
-- (20260626 and 049_zz create the table without it), so starring a message
-- fails on a database built from the migrations. This was the local
-- 049_community_message_stars_runtime_contract.sql; 049 is already taken in
-- production's ledger by other files, so it is added here as a new number.
--
-- Additive and idempotent: on a database that already has group_id (or the
-- FK/index) every step is a no-op. Existing stars are backfilled from their
-- message; the migration aborts, changing nothing, if any star cannot be
-- reconciled. Sorts after 050 (user_id -> TEXT) and before 20260626 (no-op).
ALTER TABLE community_message_stars
  ADD COLUMN IF NOT EXISTS group_id TEXT;

UPDATE community_message_stars stars
SET group_id = messages.group_id
FROM community_messages messages
WHERE stars.message_id = messages.id
  AND stars.group_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM community_message_stars WHERE group_id IS NULL) THEN
    RAISE EXCEPTION 'community_message_stars contains rows whose group_id cannot be reconciled from community_messages';
  END IF;
END $$;

ALTER TABLE community_message_stars
  ALTER COLUMN group_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_message_stars_group_id_fkey'
      AND conrelid = 'community_message_stars'::regclass
  ) THEN
    ALTER TABLE community_message_stars
      ADD CONSTRAINT community_message_stars_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES community_groups(id) ON DELETE CASCADE;
  END IF;
END $$;
