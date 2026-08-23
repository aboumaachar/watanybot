CREATE TABLE IF NOT EXISTS cms_content_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  public_id TEXT NOT NULL,
  public_code TEXT,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED')),
  locale TEXT,
  title TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  UNIQUE (domain, public_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_content_entities_domain_status
  ON cms_content_entities (domain, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS cms_content_relationships (
  entity_id UUID NOT NULL REFERENCES cms_content_entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  target_public_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, relation_type, target_domain, target_public_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_content_relationships_target
  ON cms_content_relationships (target_domain, target_public_id);