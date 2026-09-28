-- Align private Community stars with the subsystem's canonical TEXT user identity contract.
ALTER TABLE community_message_stars
  DROP CONSTRAINT IF EXISTS community_message_stars_user_id_fkey;

ALTER TABLE community_message_stars
  ALTER COLUMN user_id TYPE TEXT
  USING user_id::text;
