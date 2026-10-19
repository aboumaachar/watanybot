ALTER TABLE middle_east_security_applications
  ADD COLUMN IF NOT EXISTS follow_up_status TEXT NOT NULL DEFAULT 'not_contacted',
  ADD COLUMN IF NOT EXISTS anonymous_tracking_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_scope TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key_hash TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_payload_hash TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mes_application_follow_up_status_check'
      AND conrelid = 'middle_east_security_applications'::regclass
  ) THEN
    ALTER TABLE middle_east_security_applications
      ADD CONSTRAINT mes_application_follow_up_status_check
      CHECK (follow_up_status IN ('not_contacted','to_contact','contacted','confirmed','no_response','withdrawn'));
  END IF;
END $$;

DROP INDEX IF EXISTS mes_application_phone_unique;

CREATE UNIQUE INDEX IF NOT EXISTS mes_application_idempotency_unique
  ON middle_east_security_applications (idempotency_scope, idempotency_key_hash)
  WHERE idempotency_scope IS NOT NULL AND idempotency_key_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS mes_application_user_idx
  ON middle_east_security_applications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mes_application_tracking_idx
  ON middle_east_security_applications (anonymous_tracking_token_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS mes_application_follow_up_idx
  ON middle_east_security_applications (follow_up_status, created_at DESC);
