-- APEX_SMART_ADAPTIVE_DASHBOARD_STAGE_A_IMPLEMENTATION_v1
-- Down migration. Review before executing in production.

DROP POLICY IF EXISTS smart_sessions_isolation ON smart_user_sessions;
DROP POLICY IF EXISTS smart_preferences_isolation ON smart_user_preferences;
DROP POLICY IF EXISTS smart_pinned_items_isolation ON smart_user_pinned_items;
DROP POLICY IF EXISTS smart_feature_scores_isolation ON smart_user_feature_scores;
DROP POLICY IF EXISTS smart_activity_events_isolation ON smart_user_activity_events;

DROP TABLE IF EXISTS smart_admin_audit_log;
DROP TABLE IF EXISTS smart_dashboard_config;
DROP TABLE IF EXISTS smart_user_feature_scores;
DROP TABLE IF EXISTS smart_user_pinned_items;
DROP TABLE IF EXISTS smart_user_activity_events;
DROP TABLE IF EXISTS smart_user_sessions;
DROP TABLE IF EXISTS smart_user_preferences;
DROP TABLE IF EXISTS smart_feature_registry;

DROP FUNCTION IF EXISTS smart_update_updated_at_column();
DROP FUNCTION IF EXISTS smart_dashboard_metadata_keys_valid(jsonb);
DROP TYPE IF EXISTS smart_dashboard_intent_category_enum;
DROP TYPE IF EXISTS smart_dashboard_event_type_enum;
DROP TYPE IF EXISTS smart_dashboard_user_role_enum;