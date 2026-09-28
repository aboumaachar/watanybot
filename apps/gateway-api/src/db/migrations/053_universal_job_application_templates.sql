-- Universal job application templates and submissions.
-- Additive-only foundation for Jobs CMS reusable application forms.

CREATE TABLE IF NOT EXISTS job_application_templates (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  employer_id TEXT,
  employer_name TEXT NOT NULL,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES civilian_job_opportunities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  intro_ar TEXT NOT NULL DEFAULT '',
  employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','paused','archived')),
  allow_profile_autofill BOOLEAN NOT NULL DEFAULT TRUE,
  allow_previous_autofill BOOLEAN NOT NULL DEFAULT TRUE,
  allow_blank_start BOOLEAN NOT NULL DEFAULT TRUE,
  current_version INTEGER NOT NULL DEFAULT 0,
  draft_fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_application_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES job_application_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  fields_json JSONB NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, version)
);

CREATE TABLE IF NOT EXISTS job_application_submissions (
  id TEXT PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  template_id TEXT NOT NULL REFERENCES job_application_templates(id) ON DELETE RESTRICT,
  template_version INTEGER NOT NULL,
  job_id TEXT,
  employer_id TEXT,
  applicant_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  anonymous_tracking_token_hash TEXT,
  prefill_source TEXT NOT NULL DEFAULT 'blank',
  prefill_source_application_id TEXT,
  applicant_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age_years INTEGER,
  address TEXT,
  mohafaza TEXT,
  mohafaza_id TEXT,
  caza TEXT,
  caza_id TEXT,
  village TEXT,
  village_id TEXT,
  village_pcode TEXT,
  location_dataset_version TEXT,
  location_approval_status TEXT,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reviewing','shortlisted','approved','rejected','hired','withdrawn')),
  follow_up_status TEXT NOT NULL DEFAULT 'not_contacted'
    CHECK (follow_up_status IN ('not_contacted','to_contact','contacted','interview_scheduled','interview_completed','waiting_documents','follow_up_required','closed','no_response','withdrawn')),
  admin_notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  idempotency_scope TEXT,
  idempotency_key_hash TEXT,
  idempotency_payload_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_job_application_submissions_idempotency
  ON job_application_submissions(idempotency_scope, idempotency_key_hash)
  WHERE idempotency_scope IS NOT NULL AND idempotency_key_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_application_templates_status ON job_application_templates(status);
CREATE INDEX IF NOT EXISTS idx_job_application_templates_owner ON job_application_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_job_application_submissions_template ON job_application_submissions(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_application_submissions_owner ON job_application_submissions(applicant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_application_submissions_status ON job_application_submissions(status, follow_up_status);
CREATE INDEX IF NOT EXISTS idx_job_application_submissions_location ON job_application_submissions(mohafaza_id, caza_id, village_id);

INSERT INTO civilian_job_opportunities
  (id,type,status,title,organization,location,description,created_at,updated_at,audience,category,summary,requirements,application_method,source_name,source_url,admin_verified)
VALUES
  ('opp-accredited-bulldozer-driver','PAID_JOB','PUBLISHED','فرصة عمل – سائق جرافة معتمد','جهة توظيف خاصة','لبنان',
   'طلب توظيف لسائق جرافة معتمد مع خبرة في تشغيل الآليات الثقيلة.',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
   '["PUBLIC"]','trades','طلب توظيف لسائق جرافة معتمد مع خبرة في تشغيل الآليات الثقيلة.',
   '["اعتماد أو شهادة قيادة جرافة","خبرة في تشغيل الآليات الثقيلة"]','Apply via WatanyBot.','WatanyBot Jobs CMS','internal://jobs-cms',TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO job_application_templates
  (id,slug,employer_id,employer_name,job_id,name,title_ar,intro_ar,employment_type,status,
   allow_profile_autofill,allow_previous_autofill,allow_blank_start,current_version,draft_fields_json,draft_settings_json,created_by,updated_by)
VALUES
  ('uat-accredited-bulldozer-driver','accredited-bulldozer-driver','private-employer','جهة توظيف خاصة','opp-accredited-bulldozer-driver',
   'نموذج طلب توظيف – سائق جرافة معتمد','فرصة عمل – سائق جرافة معتمد',
   'طلب توظيف لسائق جرافة معتمد. يرجى تعبئة المعلومات بدقة، ويمكنك استخدام بيانات حسابك أو طلب سابق لتسريع التعبئة.',
   'FULL_TIME','published',TRUE,TRUE,TRUE,1,
   '[
     {"key":"full_name","labelAr":"الاسم الثلاثي","type":"text","required":true,"reusableFromProfile":true,"reusableFromPrevious":true,"adminList":true,"searchable":true},
     {"key":"birth_date","labelAr":"تاريخ الميلاد","type":"date","required":true,"reusableFromPrevious":true},
     {"key":"age_years","labelAr":"العمر بالسنوات","type":"integer","required":true,"placeholder":"62","helpText":"يرجى كتابة العمر بالأرقام فقط","min":1,"max":130,"reusableFromPrevious":true,"adminList":true},
     {"key":"birth_place","labelAr":"مكان الولادة","type":"text","required":true,"reusableFromPrevious":true},
     {"key":"phone","labelAr":"رقم الهاتف","type":"phone","required":true,"reusableFromProfile":true,"reusableFromPrevious":true,"adminList":true,"searchable":true},
     {"key":"location","labelAr":"مكان السكن","type":"universal_locator","required":true,"reusableFromPrevious":true,"adminList":true,"filterable":true},
     {"key":"accredited_driver","labelAr":"هل أنت سائق جرافة معتمد؟","type":"yes_no","required":true,"adminList":true,"filterable":true},
     {"key":"accreditation_type","labelAr":"نوع الاعتماد / الشهادة","type":"text","required":true,"condition":{"field":"accredited_driver","equals":true}},
     {"key":"accreditation_number","labelAr":"رقم الشهادة أو الاعتماد","type":"text","condition":{"field":"accredited_driver","equals":true}},
     {"key":"accreditation_issuer","labelAr":"الجهة المانحة","type":"text","required":true,"condition":{"field":"accredited_driver","equals":true}},
     {"key":"accreditation_issue_date","labelAr":"تاريخ إصدار الاعتماد","type":"date","condition":{"field":"accredited_driver","equals":true}},
     {"key":"accreditation_expiry_date","labelAr":"تاريخ انتهاء الاعتماد","type":"date","condition":{"field":"accredited_driver","equals":true}},
     {"key":"years_experience","labelAr":"عدد سنوات الخبرة","type":"integer","required":true,"min":0,"max":70,"reusableFromPrevious":true,"adminList":true,"filterable":true},
     {"key":"heavy_equipment_experience","labelAr":"الآليات التي لديك خبرة في قيادتها","type":"multi_select","options":["جرافة","حفارة","لودر","باكهول","رافعة","شاحنة ثقيلة","أخرى"],"reusableFromPrevious":true},
     {"key":"heavy_equipment_other","labelAr":"أخرى — يرجى التحديد","type":"text","condition":{"field":"heavy_equipment_experience","includes":"أخرى"}},
     {"key":"previous_employers","labelAr":"أماكن العمل السابقة","type":"textarea","reusableFromPrevious":true},
     {"key":"arabic_read","labelAr":"العربية قراءة","type":"select","required":true,"options":["لا أجيد","وسط","جيد"],"reusableFromPrevious":true},
     {"key":"arabic_write","labelAr":"العربية كتابة","type":"select","required":true,"options":["لا أجيد","وسط","جيد"],"reusableFromPrevious":true},
     {"key":"english_read","labelAr":"الإنكليزية قراءة","type":"select","required":true,"options":["لا أجيد","وسط","جيد"],"reusableFromPrevious":true},
     {"key":"english_write","labelAr":"الإنكليزية كتابة","type":"select","required":true,"options":["لا أجيد","وسط","جيد"],"reusableFromPrevious":true},
     {"key":"safety_training","labelAr":"هل سبق أن تلقيت تدريباً على السلامة المهنية؟","type":"yes_no","required":true,"reusableFromPrevious":true},
     {"key":"safety_training_details","labelAr":"نوع التدريب والجهة التي قدمته","type":"textarea","required":true,"condition":{"field":"safety_training","equals":true}},
     {"key":"available_now","labelAr":"هل أنت متاح للعمل حالياً؟","type":"yes_no","required":true},
     {"key":"willing_to_work_outside_area","labelAr":"هل يمكنك العمل خارج منطقة سكنك؟","type":"yes_no","required":true},
     {"key":"notes","labelAr":"ملاحظات إضافية","type":"textarea"}
   ]'::jsonb,
   '{"accreditationPolicy":"review","locationMode":"universal_locator"}'::jsonb,
   'system-seed','system-seed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO job_application_template_versions
  (id,template_id,version,fields_json,settings_json,published_by)
SELECT
  'uatv-accredited-bulldozer-driver-v1',id,1,draft_fields_json,draft_settings_json,'system-seed'
FROM job_application_templates
WHERE id='uat-accredited-bulldozer-driver'
ON CONFLICT (template_id,version) DO NOTHING;
