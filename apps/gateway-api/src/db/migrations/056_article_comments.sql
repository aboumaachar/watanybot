CREATE TABLE IF NOT EXISTS article_comments (
  id BIGSERIAL PRIMARY KEY,
  article_id TEXT NOT NULL,
  author_name VARCHAR(80) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT article_comments_status_check CHECK (status IN ('PUBLISHED','PENDING','HIDDEN')),
  CONSTRAINT article_comments_body_length_check CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_article_comments_article_created
  ON article_comments(article_id, created_at DESC)
  WHERE status = 'PUBLISHED';
