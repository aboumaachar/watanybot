-- Complete PostgreSQL persistence for the civilian opportunities API model.
-- Additive only: existing rows remain valid and receive safe defaults.

ALTER TABLE civilian_job_opportunities
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT '["PUBLIC"]',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS requirements TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS application_method TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS admin_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE civilian_job_opportunity_sources
  ADD COLUMN IF NOT EXISTS crawl_policy TEXT NOT NULL DEFAULT 'MANUAL_ONLY',
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
