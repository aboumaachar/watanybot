-- 007_users_auth_columns.sql -- align legacy users schema with auth routes

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;

UPDATE users
SET full_name = COALESCE(NULLIF(full_name, ''), NULLIF(name, ''), split_part(email, '@', 1))
WHERE full_name IS NULL OR btrim(full_name) = '';

UPDATE users
SET phone_number = COALESCE(phone_number, phone)
WHERE phone_number IS NULL;

WITH normalized AS (
  SELECT
    id,
    created_at,
    COALESCE(
      NULLIF(regexp_replace(lower(username), '[^a-z0-9_]+', '_', 'g'), ''),
      NULLIF(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_]+', '_', 'g'), ''),
      'user_' || replace(id::text, '-', '')
    ) AS base_username
  FROM users
),
deduped AS (
  SELECT
    id,
    CASE
      WHEN row_number() OVER (PARTITION BY base_username ORDER BY created_at, id) = 1 THEN base_username
      ELSE base_username || '_' || row_number() OVER (PARTITION BY base_username ORDER BY created_at, id)::text
    END AS final_username
  FROM normalized
)
UPDATE users AS target
SET username = deduped.final_username
FROM deduped
WHERE target.id = deduped.id
  AND (target.username IS NULL OR btrim(target.username) = '');

ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN full_name SET DEFAULT '';
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username);

CREATE OR REPLACE FUNCTION sync_user_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.full_name IS NULL OR btrim(NEW.full_name) = '' THEN
    NEW.full_name := COALESCE(NULLIF(NEW.name, ''), split_part(NEW.email, '@', 1));
  END IF;

  IF NEW.name IS NULL OR btrim(NEW.name) = '' THEN
    NEW.name := NEW.full_name;
  END IF;

  IF NEW.username IS NULL OR btrim(NEW.username) = '' THEN
    NEW.username := COALESCE(
      NULLIF(regexp_replace(lower(split_part(NEW.email, '@', 1)), '[^a-z0-9_]+', '_', 'g'), ''),
      'user_' || replace(gen_random_uuid()::text, '-', '')
    );
  END IF;

  IF NEW.phone_number IS NULL AND NEW.phone IS NOT NULL THEN
    NEW.phone_number := NEW.phone;
  END IF;

  IF NEW.phone IS NULL AND NEW.phone_number IS NOT NULL THEN
    NEW.phone := NEW.phone_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_profile_columns ON users;

CREATE TRIGGER trg_sync_user_profile_columns
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_profile_columns();