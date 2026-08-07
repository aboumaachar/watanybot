-- status: draft/published/archived
ALTER TABLE kb_faq
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published',
ADD COLUMN IF NOT EXISTS created_from_norm TEXT,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_kb_faq_status ON kb_faq(status);
CREATE INDEX IF NOT EXISTS idx_kb_faq_created_from ON kb_faq(created_from_norm);
