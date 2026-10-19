-- Article analytics lookup index on watany_analytics_events.
--
-- articles.ts and articleSeoAgent.ts filter and group by event_data->>'articleId'
-- and event_type over recent rows. This index came from the local
-- 054_article_analytics_events.sql, which redefined the table already created by
-- production's 054_watany_analytics_events.sql (already in the ledger); only the
-- index is new, so it is added here. The local SERIAL -> BIGSERIAL id change is
-- deliberately not carried over: it would rewrite the table and is not needed.
CREATE INDEX IF NOT EXISTS idx_article_analytics_lookup
  ON watany_analytics_events ((event_data->>'articleId'), event_type, created_at DESC);
