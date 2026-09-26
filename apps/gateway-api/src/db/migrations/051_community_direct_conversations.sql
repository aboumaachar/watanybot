-- Canonical 1:1 direct conversations reuse Community persistence/realtime.
ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS conversation_kind TEXT NOT NULL DEFAULT 'group',
  ADD COLUMN IF NOT EXISTS direct_pair_key TEXT,
  ADD COLUMN IF NOT EXISTS direct_user_a TEXT,
  ADD COLUMN IF NOT EXISTS direct_user_b TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_groups_conversation_kind_check') THEN
    ALTER TABLE community_groups ADD CONSTRAINT community_groups_conversation_kind_check
      CHECK (conversation_kind IN ('group','direct'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_groups_direct_shape_check') THEN
    ALTER TABLE community_groups ADD CONSTRAINT community_groups_direct_shape_check CHECK (
      (conversation_kind = 'group' AND direct_pair_key IS NULL AND direct_user_a IS NULL AND direct_user_b IS NULL)
      OR
      (conversation_kind = 'direct' AND direct_pair_key IS NOT NULL AND direct_user_a IS NOT NULL AND direct_user_b IS NOT NULL AND direct_user_a <> direct_user_b)
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_groups_direct_pair
  ON community_groups(direct_pair_key)
  WHERE conversation_kind = 'direct';

CREATE OR REPLACE FUNCTION enforce_community_direct_membership_pair()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  kind TEXT;
  user_a TEXT;
  user_b TEXT;
BEGIN
  SELECT conversation_kind, direct_user_a, direct_user_b
    INTO kind, user_a, user_b
    FROM community_groups WHERE id = NEW.group_id;
  IF kind = 'direct' AND NEW.user_id <> user_a AND NEW.user_id <> user_b THEN
    RAISE EXCEPTION 'direct conversation membership outside canonical pair' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_community_direct_membership_pair ON community_group_members;
CREATE TRIGGER trg_community_direct_membership_pair
  BEFORE INSERT OR UPDATE OF group_id, user_id ON community_group_members
  FOR EACH ROW EXECUTE FUNCTION enforce_community_direct_membership_pair();
