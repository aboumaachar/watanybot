-- =========================
-- FAQ: الأسئلة الشائعة + الأجوبة + الإحالات
-- =========================
CREATE TABLE IF NOT EXISTS kb_faq (
  faq_id BIGSERIAL PRIMARY KEY,
  question_ar TEXT NOT NULL,
  question_norm TEXT NOT NULL,             -- normalized for matching
  answer_ar TEXT NOT NULL,                 -- جواب مبسّط
  answer_official_ar TEXT,                 -- جواب رسمي/قانوني (اختياري)
  topic_code TEXT,                         -- PENSIONS/RIGHTS/HEALTH/PROCEDURES/LAWS...
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- إحالات
  refs_json JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{law_code, article_no, note}]

  -- إحصاءات
  hits_total INT NOT NULL DEFAULT 0,
  hits_7d INT NOT NULL DEFAULT 0,
  hits_30d INT NOT NULL DEFAULT 0,
  last_asked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_faq_norm ON kb_faq(question_norm);
CREATE INDEX IF NOT EXISTS idx_kb_faq_hits ON kb_faq(hits_total DESC);
CREATE INDEX IF NOT EXISTS idx_kb_faq_last ON kb_faq(last_asked_at DESC);

-- =========================
-- Query Log: كل سؤال سُئل + نتيجة المطابقة
-- =========================
CREATE TABLE IF NOT EXISTS kb_query_log (
  id BIGSERIAL PRIMARY KEY,
  asked_at TIMESTAMP NOT NULL DEFAULT now(),
  user_text TEXT NOT NULL,
  user_text_norm TEXT NOT NULL,
  matched_faq_id BIGINT REFERENCES kb_faq(faq_id),
  matched_score NUMERIC(5,2),
  route TEXT NOT NULL DEFAULT 'faq',       -- faq / kb_law / case
  topic_code TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_kb_query_log_recent ON kb_query_log(asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_query_log_norm ON kb_query_log(user_text_norm);

-- =========================
-- Helper: reset rolling counters (optional nightly job)
-- (We'll compute in code too, but leaving this for future.)
-- =========================