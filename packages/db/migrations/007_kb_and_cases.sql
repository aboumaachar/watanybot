-- =========================
-- KB: Topics / Procedures / Rights / Laws
-- =========================

CREATE TABLE IF NOT EXISTS kb_topics (
  topic_code TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS kb_procedures (
  procedure_code TEXT PRIMARY KEY,
  topic_code TEXT NOT NULL REFERENCES kb_topics(topic_code) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,

  who_eligible_ar TEXT,
  estimated_time_ar TEXT,

  requirements_checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_mistakes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  legal_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS kb_rights (
  right_code TEXT PRIMARY KEY,
  topic_code TEXT NOT NULL REFERENCES kb_topics(topic_code) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,

  summary_simple_ar TEXT NOT NULL,
  conditions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  documents_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  how_to_apply_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  legal_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS kb_laws (
  id BIGSERIAL PRIMARY KEY,
  law_code TEXT NOT NULL,
  article_no TEXT NOT NULL,
  title_ar TEXT,
  text_ar TEXT NOT NULL,
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(law_code, article_no)
);

CREATE INDEX IF NOT EXISTS idx_kb_laws_tags ON kb_laws USING GIN(tags_json);
CREATE INDEX IF NOT EXISTS idx_kb_laws_text ON kb_laws USING GIN (to_tsvector('simple', text_ar));

-- =========================
-- Personal Follow-up Cases (طلبات متابعة)
-- =========================
CREATE TABLE IF NOT EXISTS user_cases (
  id BIGSERIAL PRIMARY KEY,
  case_code TEXT UNIQUE NOT NULL,          -- e.g. "WAT-8F3K2Q"
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),

  requester_name TEXT,
  requester_phone TEXT,

  topic_code TEXT,
  category TEXT,                           -- "salary" / "rights" / "law" / "other"
  user_message TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'open',     -- open / in_progress / answered / closed
  staff_reply TEXT                         -- later for admins/backoffice
);

CREATE INDEX IF NOT EXISTS idx_user_cases_status ON user_cases(status);
CREATE INDEX IF NOT EXISTS idx_user_cases_topic ON user_cases(topic_code);

-- auto update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_cases_updated ON user_cases;
CREATE TRIGGER trg_user_cases_updated
BEFORE UPDATE ON user_cases
FOR EACH ROW EXECUTE FUNCTION set_updated_at();