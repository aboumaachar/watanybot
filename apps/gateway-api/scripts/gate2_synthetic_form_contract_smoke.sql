-- Gate 2 local-only disposable rehearsal acceptance.
-- No production credentials, user data, or backup transfer.
-- All synthetic inserts MUST rollback before success token is produced.
\set ON_ERROR_STOP on
BEGIN;
DO $gate2$
DECLARE
  v_form UUID := gen_random_uuid();
  v_version UUID := gen_random_uuid();
  v_submission UUID := gen_random_uuid();
  v_article TEXT := 'gate2-synthetic-' || gen_random_uuid()::text;
  v_fslug TEXT := 'gate2-synthetic-form-' || left(v_form::text, 12);
  v_count INTEGER;
BEGIN
  IF current_database() <> 'gate2_rehearsal_20261011' THEN
    RAISE EXCEPTION 'GATE2_DISPOSABLE_DATABASE_GUARD_FAILED';
  END IF;

  INSERT INTO universal_forms(id, slug, name, status, current_version, draft_fields_json)
  VALUES (v_form, v_fslug, 'GATE2 SYNTHETIC (NO REAL PERSON)', 'PUBLISHED', 1, '[]'::jsonb);

  INSERT INTO universal_form_versions(id, form_id, version, fields_json)
  VALUES (v_version, v_form, 1, '[]'::jsonb);

  INSERT INTO universal_form_submissions
    (id, reference, form_id, form_version, answers, workflow_state, priority)
  VALUES
    (v_submission, 'GATE2-SYNTH-' || v_submission::text, v_form, 1,
      '{"synthetic":true}'::jsonb, 'SUBMITTED', 'NORMAL');

  INSERT INTO universal_form_submission_events
    (submission_id, event_type, to_state, payload_json)
  VALUES (v_submission, 'SYNTHETIC_SUBMIT', 'SUBMITTED', '{"synthetic":true}'::jsonb);

  INSERT INTO universal_form_uploads
    (form_id, form_version, field_key, upload_token, bound_submission_id,
     original_name, mime_type, bytes, sha256, storage_key)
  VALUES (v_form, 1, 'example', 'synthetic-token', v_submission,
    'synthetic.txt', 'text/plain', 0, repeat('0', 64), 'synthetic/never-persisted');

  INSERT INTO article_comments(article_id, author_name, body, status)
  VALUES (v_article, 'Synthetic Contract Test', 'Synthetic test comment', 'PUBLISHED');

  SELECT count(*) INTO v_count
  FROM universal_form_submissions s
  JOIN universal_form_versions v ON s.form_id = v.form_id AND s.form_version = v.version
  JOIN universal_forms f ON f.id = s.form_id
  WHERE s.id = v_submission AND f.id = v_form AND f.status = 'PUBLISHED';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE2_FORM_VERSION_LINK_FAILURE';
  END IF;

  SELECT count(*) INTO v_count
  FROM universal_form_submission_events
  WHERE submission_id = v_submission AND event_type = 'SYNTHETIC_SUBMIT';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE2_WORKFLOW_EVENT_FAILURE';
  END IF;

  SELECT count(*) INTO v_count
  FROM universal_form_uploads
  WHERE bound_submission_id = v_submission AND storage_key = 'synthetic/never-persisted';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE2_FORM_ATTACHMENT_LINK_FAILURE';
  END IF;

  SELECT count(*) INTO v_count
  FROM article_comments WHERE article_id = v_article AND status = 'PUBLISHED';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE2_ARTICLE_COMMENT_FAILURE';
  END IF;

  BEGIN
    INSERT INTO article_comments(article_id, author_name, body, status)
    VALUES (v_article, 'Synthetic Negative Test', 'bad status', 'INVALID');
    RAISE EXCEPTION 'GATE2_INVALID_ARTICLE_COMMENT_STATUS_ACCEPTED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$gate2$;
ROLLBACK;
SELECT 'GATE2_SYNTHETIC_FORMS_CONTRACT_PASS';
