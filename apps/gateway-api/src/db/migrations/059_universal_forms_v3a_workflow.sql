BEGIN;

ALTER TABLE universal_form_submissions
  ADD COLUMN IF NOT EXISTS identity_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS workflow_state TEXT NOT NULL DEFAULT 'SUBMITTED',
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_department TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_note TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='universal_form_submissions_workflow_state_check') THEN
    ALTER TABLE universal_form_submissions ADD CONSTRAINT universal_form_submissions_workflow_state_check
      CHECK (workflow_state IN ('SUBMITTED','ASSIGNED','IN_REVIEW','NEEDS_INFO','APPROVED','REJECTED','CLOSED','ARCHIVED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='universal_form_submissions_priority_check') THEN
    ALTER TABLE universal_form_submissions ADD CONSTRAINT universal_form_submissions_priority_check
      CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS universal_form_submission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES universal_form_submissions(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  note TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_universal_form_submission_events_submission
  ON universal_form_submission_events(submission_id, created_at DESC);

CREATE TABLE IF NOT EXISTS universal_form_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES universal_forms(id) ON DELETE CASCADE,
  form_version INTEGER NOT NULL,
  field_key TEXT NOT NULL,
  upload_token TEXT NOT NULL,
  submitter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  bound_submission_id UUID REFERENCES universal_form_submissions(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'clean',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_universal_form_uploads_binding
  ON universal_form_uploads(form_id, form_version, field_key, upload_token, bound_submission_id);

CREATE TABLE IF NOT EXISTS universal_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_universal_form_templates_category
  ON universal_form_templates(category, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_universal_form_submissions_workflow
  ON universal_form_submissions(workflow_state, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_universal_form_submissions_assignee
  ON universal_form_submissions(assigned_user_id, workflow_state, updated_at DESC);

INSERT INTO universal_form_templates(template_key,name,description,category,fields_json,settings_json,is_system)
VALUES
('job-application','طلب توظيف','قالب طلب توظيف متعدد الخطوات مع عنوان وسيرة ذاتية.','JOBS',
 '[{"key":"personal_section","label":"المعلومات الشخصية","type":"section","pageBreakBefore":false},{"key":"full_name","label":"الاسم الكامل","type":"text","required":true},{"key":"phone","label":"رقم الهاتف","type":"phone","required":true},{"key":"address","label":"مكان السكن","type":"universal_locator","required":true},{"key":"experience_section","label":"الخبرة والمرفقات","type":"section","pageBreakBefore":true},{"key":"experience","label":"سنوات الخبرة","type":"integer","required":false},{"key":"cv","label":"السيرة الذاتية","type":"file","required":false,"allowedMimeTypes":["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword"],"maxFiles":1,"maxFileSizeMb":5}]'::jsonb,
 '{"accessMode":"ACCOUNT_REQUIRED","notifyApplicantOnSubmit":true,"notifyApplicantOnStatusChange":true,"notifyAdminsOnSubmit":true}'::jsonb, TRUE),
('aid-request','طلب مساعدة','قالب طلب مساعدة مع معلومات الأسرة ومستندات الإثبات.','AID',
 '[{"key":"identity_section","label":"معلومات مقدم الطلب","type":"section","pageBreakBefore":false},{"key":"full_name","label":"الاسم الكامل","type":"text","required":true},{"key":"address","label":"العنوان","type":"universal_locator","required":true},{"key":"family_size","label":"عدد أفراد الأسرة","type":"integer","required":true},{"key":"documents_section","label":"المستندات","type":"section","pageBreakBefore":true},{"key":"supporting_document","label":"مستند إثبات","type":"file","required":false,"allowedMimeTypes":["application/pdf","image/jpeg","image/png"],"maxFiles":3,"maxFileSizeMb":5}]'::jsonb,
 '{"accessMode":"ACCOUNT_REQUIRED","notifyApplicantOnSubmit":true,"notifyApplicantOnStatusChange":true,"notifyAdminsOnSubmit":true}'::jsonb, TRUE),
('event-registration','تسجيل فعالية','قالب تسجيل بسيط للفعاليات.','EVENTS',
 '[{"key":"full_name","label":"الاسم الكامل","type":"text","required":true},{"key":"phone","label":"رقم الهاتف","type":"phone","required":true},{"key":"attendance","label":"طريقة الحضور","type":"radio","required":true,"options":["حضوري","عن بعد"]}]'::jsonb,
 '{"accessMode":"PUBLIC_IDENTIFIED","notifyApplicantOnSubmit":true,"notifyApplicantOnStatusChange":false,"notifyAdminsOnSubmit":true}'::jsonb, TRUE),
('complaint','شكوى أو ملاحظة','قالب شكوى مع تصنيف ووصف ومرفقات.','REQUESTS',
 '[{"key":"category","label":"التصنيف","type":"select","required":true,"options":["شكوى","اقتراح","ملاحظة"]},{"key":"details","label":"التفاصيل","type":"textarea","required":true},{"key":"evidence","label":"مرفقات داعمة","type":"file","required":false,"allowedMimeTypes":["application/pdf","image/jpeg","image/png","image/webp"],"maxFiles":4,"maxFileSizeMb":5}]'::jsonb,
 '{"accessMode":"PUBLIC_IDENTIFIED","notifyApplicantOnSubmit":true,"notifyApplicantOnStatusChange":true,"notifyAdminsOnSubmit":true}'::jsonb, TRUE),
('membership-request','طلب عضوية','قالب طلب عضوية قابل للتخصيص.','MEMBERSHIP',
 '[{"key":"personal","label":"المعلومات الشخصية","type":"section","pageBreakBefore":false},{"key":"full_name","label":"الاسم الكامل","type":"text","required":true},{"key":"phone","label":"الهاتف","type":"phone","required":true},{"key":"address","label":"العنوان","type":"universal_locator","required":true},{"key":"motivation","label":"سبب طلب العضوية","type":"textarea","required":true}]'::jsonb,
 '{"accessMode":"VERIFIED_ACCOUNT_REQUIRED","notifyApplicantOnSubmit":true,"notifyApplicantOnStatusChange":true,"notifyAdminsOnSubmit":true}'::jsonb, TRUE)
ON CONFLICT (template_key) DO NOTHING;

COMMIT;
