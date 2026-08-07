-- 013_review_workflow.sql
-- Review workflow: reviewer assignment + review status

ALTER TABLE kb_faq
ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'unassigned'; -- unassigned / assigned / in_review / approved

CREATE INDEX IF NOT EXISTS idx_kb_faq_review_status ON kb_faq(review_status);
CREATE INDEX IF NOT EXISTS idx_kb_faq_reviewer ON kb_faq(reviewer_name);
