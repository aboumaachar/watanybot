-- Wave: Lebanese Job Source Daily Crawler Expansion
-- Purpose: additive persistence proposal for source coverage, crawl runs, imported listings, and admin review.
-- This migration is intentionally additive and must be adapted to the active DB engine before production execution.

CREATE TABLE IF NOT EXISTS civilian_job_sources (
  id VARCHAR(120) PRIMARY KEY,
  category VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL,
  crawl_frequency VARCHAR(40) NOT NULL,
  auto_publish BOOLEAN NOT NULL DEFAULT FALSE,
  admin_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  policy_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS civilian_job_crawl_runs (
  id VARCHAR(120) PRIMARY KEY,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NULL,
  status VARCHAR(40) NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

CREATE TABLE IF NOT EXISTS civilian_imported_job_listings (
  id VARCHAR(160) PRIMARY KEY,
  run_id VARCHAR(120),
  source_id VARCHAR(120) NOT NULL,
  source_url TEXT NOT NULL,
  title VARCHAR(500) NOT NULL,
  company VARCHAR(255),
  location VARCHAR(255),
  deadline VARCHAR(80),
  employment_type VARCHAR(80),
  raw_summary TEXT,
  dedupe_key TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING_REVIEW',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);