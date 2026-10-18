-- Bulldozer application content refinement requested 2026-09-28.
-- Preserve template version 1; publish version 2 without languages, previous employers, or additional-info fields.

DO $$
DECLARE
  v_template_id TEXT;
  v_current_version INTEGER;
  v_filtered_fields JSONB;
  v_settings JSONB;
  v_intro TEXT := 'طلب توظيف لسائق جرافة معتمد لصالح شركة لافاجيت في طرابلس والبداوي. يرجى تعبئة المعلومات بدقة، ويمكنك استخدام بيانات حسابك أو طلب سابق لتسريع التعبئة.';
BEGIN
  SELECT id, current_version, draft_settings_json
    INTO v_template_id, v_current_version, v_settings
  FROM job_application_templates
  WHERE slug = 'accredited-bulldozer-driver'
  FOR UPDATE;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'BULLDOZER_TEMPLATE_NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(field ORDER BY ord), '[]'::jsonb)
    INTO v_filtered_fields
  FROM jsonb_array_elements((SELECT draft_fields_json FROM job_application_templates WHERE id=v_template_id))
       WITH ORDINALITY AS f(field, ord)
  WHERE field->>'key' NOT IN (
    'previous_employers',
    'arabic_read','arabic_write','english_read','english_write',
    'safety_training','safety_training_details',
    'available_now','willing_to_work_outside_area','notes'
  );

  INSERT INTO job_application_template_versions
    (id, template_id, version, fields_json, settings_json, published_by)
  VALUES
    ('uatv-accredited-bulldozer-driver-v2', v_template_id, v_current_version + 1, v_filtered_fields, COALESCE(v_settings,'{}'::jsonb), 'system')
  ON CONFLICT (template_id, version) DO NOTHING;

  UPDATE job_application_templates
  SET intro_ar = v_intro,
      draft_fields_json = v_filtered_fields,
      current_version = v_current_version + 1,
      status = 'published',
      updated_by = 'system',
      updated_at = NOW()
  WHERE id = v_template_id;

  UPDATE civilian_job_opportunities
  SET description = 'طلب توظيف لسائق جرافة معتمد لصالح شركة لافاجيت في طرابلس والبداوي، مع خبرة في تشغيل الآليات الثقيلة.',
      summary = 'طلب توظيف لسائق جرافة معتمد لصالح شركة لافاجيت في طرابلس والبداوي، مع خبرة في تشغيل الآليات الثقيلة.',
      updated_at = NOW()
  WHERE id = 'opp-accredited-bulldozer-driver';
END $$;
