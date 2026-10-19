BEGIN;

ALTER TABLE cms_content_entities
  DROP CONSTRAINT IF EXISTS cms_content_entities_status_check;

ALTER TABLE cms_content_entities
  ADD CONSTRAINT cms_content_entities_status_check
  CHECK (status IN ('DRAFT', 'REVIEW_READY', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'));

CREATE INDEX IF NOT EXISTS idx_cms_content_entities_domain_updated
  ON cms_content_entities (domain, updated_at DESC, public_id ASC);

CREATE INDEX IF NOT EXISTS idx_cms_content_relationships_entity_relation
  ON cms_content_relationships (entity_id, relation_type, created_at DESC);

COMMIT;