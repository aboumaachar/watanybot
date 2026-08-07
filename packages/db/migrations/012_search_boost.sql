-- تحسين البحث النصي داخل kb_laws
CREATE INDEX IF NOT EXISTS idx_kb_laws_tsv
ON kb_laws USING GIN (to_tsvector('simple', COALESCE(title_ar,'') || ' ' || COALESCE(text_ar,'')));

-- (اختياري) pg_trgm للمطابقة الأقرب - إذا بدك
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_kb_faq_trgm ON kb_faq USING GIN (question_norm gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_kb_querylog_trgm ON kb_query_log USING GIN (user_text_norm gin_trgm_ops);
