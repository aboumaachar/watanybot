CREATE TABLE IF NOT EXISTS kb_sources (
  source_id BIGSERIAL PRIMARY KEY,
  source_code TEXT UNIQUE NOT NULL,         -- مثال: LAF_HTML, MOF_HTML, DEFENSE_LAW
  title_ar TEXT NOT NULL,                   -- اسم المرجع
  file_name TEXT,                           -- laf.html / mof.html...
  source_type TEXT NOT NULL DEFAULT 'html', -- html/pdf/web
  official BOOLEAN NOT NULL DEFAULT TRUE,
  version_label TEXT,                       -- v1 / تاريخ النشر إن وجد
  imported_at TIMESTAMP NOT NULL DEFAULT now(),
  sha256 TEXT                               -- بصمة الملف للتحقق
);

ALTER TABLE kb_laws
ADD COLUMN IF NOT EXISTS source_id BIGINT REFERENCES kb_sources(source_id),
ADD COLUMN IF NOT EXISTS source_locator TEXT,  -- page=42 / section=...
ADD COLUMN IF NOT EXISTS text_sha256 TEXT;     -- بصمة نص المادة نفسها