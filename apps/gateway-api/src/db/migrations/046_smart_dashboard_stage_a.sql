-- APEX_SMART_ADAPTIVE_DASHBOARD_STAGE_A_IMPLEMENTATION_v1
-- Stage A migration: additive foundation for feature registry, preferences, sessions,
-- activity events, pinned items, dashboard config, and admin audit log.
-- This migration is intended to be reviewed and run through the project migration tool.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smart_dashboard_user_role_enum') THEN
        CREATE TYPE smart_dashboard_user_role_enum AS ENUM ('VETERAN', 'RETIRED_OFFICER', 'FAMILY_MEMBER', 'ADMIN', 'SUPERADMIN');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smart_dashboard_event_type_enum') THEN
        CREATE TYPE smart_dashboard_event_type_enum AS ENUM ('CLICK', 'SEARCH_INTENT', 'PAGE_VIEW', 'NOTIFICATION_OPEN', 'IMPRESSION', 'PIN', 'UNPIN');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smart_dashboard_intent_category_enum') THEN
        CREATE TYPE smart_dashboard_intent_category_enum AS ENUM (
            'pension_query', 'healthcare_query', 'procedure_query', 'document_query',
            'law_query', 'salary_query', 'compensation_query', 'school_query', 'general_query'
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION smart_dashboard_metadata_keys_valid(p_metadata jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_key text;
BEGIN
    IF p_metadata IS NULL THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(p_metadata) <> 'object' THEN
        RETURN false;
    END IF;
    IF p_metadata = '{}'::jsonb THEN
        RETURN true;
    END IF;
    IF NOT (p_metadata ? 'feature_key') THEN RETURN false; END IF;
    IF NOT (p_metadata ? 'sub_section') THEN RETURN false; END IF;
    IF NOT (p_metadata ? 'intent_category') THEN RETURN false; END IF;
    FOR v_key IN SELECT jsonb_object_keys(p_metadata) LOOP
        IF v_key NOT IN ('feature_key', 'sub_section', 'intent_category') THEN
            RETURN false;
        END IF;
    END LOOP;
    RETURN true;
END $$;

CREATE TABLE IF NOT EXISTS smart_feature_registry (
    key                     varchar(100) PRIMARY KEY,
    title_ar                varchar(255) NOT NULL,
    title_en                varchar(255) NOT NULL,
    route                   varchar(255) NOT NULL,
    icon_key                varchar(100) NOT NULL,
    group_ar                varchar(100) NOT NULL,
    required_roles          smart_dashboard_user_role_enum[] NOT NULL DEFAULT ARRAY['VETERAN']::smart_dashboard_user_role_enum[],
    default_priority        integer NOT NULL DEFAULT 50 CHECK (default_priority BETWEEN 0 AND 100),
    is_critical             boolean NOT NULL DEFAULT false,
    personalization_allowed boolean NOT NULL DEFAULT true,
    notification_category   varchar(100),
    synonyms_ar             varchar(255)[] NOT NULL DEFAULT ARRAY[]::varchar(255)[],
    smoke_test_route        varchar(255) NOT NULL,
    visibility_condition    varchar(255),
    registry_version        integer NOT NULL DEFAULT 1,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smart_feature_registry_roles ON smart_feature_registry USING gin (required_roles);
CREATE INDEX IF NOT EXISTS idx_smart_feature_registry_critical ON smart_feature_registry (is_critical) WHERE is_critical = true;

CREATE TABLE IF NOT EXISTS smart_user_preferences (
    user_id                         uuid PRIMARY KEY,
    language                        varchar(5) NOT NULL DEFAULT 'ar',
    font_size                       integer NOT NULL DEFAULT 18 CHECK (font_size IN (18, 22, 26)),
    smart_personalization_enabled   boolean NOT NULL DEFAULT true,
    preferred_dashboard_layout      varchar(50) NOT NULL DEFAULT 'standard_grid',
    session_count                   integer NOT NULL DEFAULT 0 CHECK (session_count >= 0),
    created_at                      timestamptz NOT NULL DEFAULT now(),
    updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smart_user_sessions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         uuid NOT NULL,
    session_number  integer NOT NULL,
    started_at      timestamptz NOT NULL DEFAULT now(),
    ended_at        timestamptz,
    device_type     varchar(32),
    app_version     varchar(16),
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_smart_user_sessions_user ON smart_user_sessions (user_id, session_number);
CREATE INDEX IF NOT EXISTS idx_smart_user_sessions_recent ON smart_user_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS smart_user_activity_events (
    id              bigserial PRIMARY KEY,
    user_id         uuid NOT NULL,
    event_type      smart_dashboard_event_type_enum NOT NULL,
    feature_key     varchar(100) NOT NULL REFERENCES smart_feature_registry(key) ON DELETE CASCADE,
    page_path       varchar(255) NOT NULL,
    intent_category smart_dashboard_intent_category_enum,
    metadata_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    ttl_expires_at  timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
    CONSTRAINT chk_smart_metadata_json_schema CHECK (smart_dashboard_metadata_keys_valid(metadata_json)),
    CONSTRAINT chk_smart_metadata_no_raw_text CHECK (metadata_json::text !~* '(raw|question|message|chat|prompt|answer|salary_value|medical|diagnosis|ip_address|device_id|location)')
);

CREATE INDEX IF NOT EXISTS idx_smart_activity_events_user_feature ON smart_user_activity_events (user_id, feature_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_activity_events_ttl ON smart_user_activity_events (ttl_expires_at);

CREATE TABLE IF NOT EXISTS smart_user_pinned_items (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL,
    feature_key varchar(100) NOT NULL REFERENCES smart_feature_registry(key) ON DELETE CASCADE,
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_smart_pinned_items_user ON smart_user_pinned_items (user_id, sort_order);

CREATE TABLE IF NOT EXISTS smart_user_feature_scores (
    user_id             uuid NOT NULL,
    feature_key         varchar(100) NOT NULL REFERENCES smart_feature_registry(key) ON DELETE CASCADE,
    score               numeric(8,2) NOT NULL DEFAULT 0.00,
    reason_json         jsonb NOT NULL DEFAULT '[]'::jsonb,
    score_version       integer NOT NULL DEFAULT 1,
    last_calculated_at  timestamptz NOT NULL DEFAULT now(),
    decay_applied_at    timestamptz,
    PRIMARY KEY (user_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_smart_feature_scores_user ON smart_user_feature_scores (user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_smart_feature_scores_version ON smart_user_feature_scores (score_version);

CREATE TABLE IF NOT EXISTS smart_dashboard_config (
    id                  bigserial PRIMARY KEY,
    role                smart_dashboard_user_role_enum NOT NULL,
    feature_key         varchar(100) NOT NULL REFERENCES smart_feature_registry(key) ON DELETE CASCADE,
    priority_override   integer NOT NULL DEFAULT 0,
    is_hidden           boolean NOT NULL DEFAULT false,
    forced_visible      boolean NOT NULL DEFAULT false,
    updated_by_admin_id uuid NOT NULL,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (role, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_smart_dashboard_config_role ON smart_dashboard_config (role, feature_key);

CREATE TABLE IF NOT EXISTS smart_admin_audit_log (
    id                  bigserial PRIMARY KEY,
    admin_id            uuid NOT NULL,
    timestamp           timestamptz NOT NULL DEFAULT now(),
    feature_key         varchar(100) NOT NULL,
    change_type         varchar(50) NOT NULL,
    old_value           jsonb NOT NULL DEFAULT '{}'::jsonb,
    new_value           jsonb NOT NULL DEFAULT '{}'::jsonb,
    justification_text  text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_smart_audit_log_admin ON smart_admin_audit_log (admin_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_smart_audit_log_feature ON smart_admin_audit_log (feature_key, timestamp DESC);

CREATE OR REPLACE FUNCTION smart_update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_smart_feature_registry_updated ON smart_feature_registry;
CREATE TRIGGER trg_smart_feature_registry_updated
    BEFORE UPDATE ON smart_feature_registry
    FOR EACH ROW EXECUTE FUNCTION smart_update_updated_at_column();

DROP TRIGGER IF EXISTS trg_smart_user_preferences_updated ON smart_user_preferences;
CREATE TRIGGER trg_smart_user_preferences_updated
    BEFORE UPDATE ON smart_user_preferences
    FOR EACH ROW EXECUTE FUNCTION smart_update_updated_at_column();

ALTER TABLE smart_user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_user_feature_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_user_pinned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS smart_activity_events_isolation ON smart_user_activity_events;
CREATE POLICY smart_activity_events_isolation ON smart_user_activity_events
    FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS smart_feature_scores_isolation ON smart_user_feature_scores;
CREATE POLICY smart_feature_scores_isolation ON smart_user_feature_scores
    FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS smart_pinned_items_isolation ON smart_user_pinned_items;
CREATE POLICY smart_pinned_items_isolation ON smart_user_pinned_items
    FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS smart_preferences_isolation ON smart_user_preferences;
CREATE POLICY smart_preferences_isolation ON smart_user_preferences
    FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS smart_sessions_isolation ON smart_user_sessions;
CREATE POLICY smart_sessions_isolation ON smart_user_sessions
    FOR ALL USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

INSERT INTO smart_feature_registry
(key, title_ar, title_en, route, icon_key, group_ar, required_roles, default_priority, is_critical, personalization_allowed, notification_category, synonyms_ar, smoke_test_route, visibility_condition, registry_version)
VALUES
('ask_watany', 'اسأل موطني', 'Ask Watany', '/mcp', 'ask-watany', 'الرئيسية', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 100, true, false, 'general', ARRAY['اسأل','سؤال','موطني'], '/api/health', NULL, 1),
('profile', 'الملف', 'Profile', '/mcp/profile', 'profile', 'الرئيسية', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 90, true, false, 'profile', ARRAY['ملفي','حسابي'], '/api/health', NULL, 1),
('procedures', 'الإجراءات', 'Procedures', '/mcp/procedures', 'procedures', 'الخدمات', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 85, true, true, 'procedure', ARRAY['معاملات','اجراءات','طلبات'], '/api/health', NULL, 1),
('laws', 'القوانين', 'Laws', '/mcp/laws', 'laws', 'المراجع', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 75, true, true, 'law', ARRAY['قوانين','تعاميم','مراسيم'], '/api/health', NULL, 1),
('services', 'الخدمات', 'Services', '/mcp/services', 'services', 'الخدمات', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 80, true, false, 'general', ARRAY['خدمات','مساعدة'], '/api/health', NULL, 1),
('other', 'او شي تاني', 'Something Else', '/mcp/other', 'other', 'الرئيسية', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 70, true, false, 'general', ARRAY['شي تاني','غير ذلك'], '/api/health', NULL, 1),
('salary', 'المعاش', 'Pension and Salary', '/mcp/salary', 'salary', 'الحقوق', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 65, false, true, 'pension', ARRAY['راتب','معاش','تقاعد','salary'], '/api/health', NULL, 1),
('schools', 'المدارس والمنح', 'Schools and Grants', '/mcp/schools', 'schools', 'العائلة', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 55, false, true, 'school', ARRAY['مدارس','منح','اولاد','ابنة','ابن'], '/api/health', NULL, 1),
('market', 'السوق', 'Market', '/mcp/market', 'market', 'الأعمال', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 50, false, true, 'market', ARRAY['سوق','بيع','شراء'], '/api/health', NULL, 1),
('jobs', 'الوظائف', 'Jobs', '/mcp/jobs', 'jobs', 'الأعمال', ARRAY['VETERAN','RETIRED_OFFICER','FAMILY_MEMBER','ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 50, false, true, 'jobs', ARRAY['وظائف','عمل','شغل'], '/api/health', NULL, 1),
('admin_dashboard', 'الإدارة', 'Admin Dashboard', '/mcp/super-admin', 'admin', 'الإدارة', ARRAY['ADMIN','SUPERADMIN']::smart_dashboard_user_role_enum[], 95, false, false, 'admin', ARRAY['ادارة','مشرف'], '/api/health', NULL, 1)
ON CONFLICT (key) DO UPDATE SET
    title_ar = EXCLUDED.title_ar,
    title_en = EXCLUDED.title_en,
    route = EXCLUDED.route,
    icon_key = EXCLUDED.icon_key,
    group_ar = EXCLUDED.group_ar,
    required_roles = EXCLUDED.required_roles,
    default_priority = EXCLUDED.default_priority,
    is_critical = EXCLUDED.is_critical,
    personalization_allowed = EXCLUDED.personalization_allowed,
    notification_category = EXCLUDED.notification_category,
    synonyms_ar = EXCLUDED.synonyms_ar,
    smoke_test_route = EXCLUDED.smoke_test_route,
    visibility_condition = EXCLUDED.visibility_condition,
    registry_version = EXCLUDED.registry_version,
    updated_at = now();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'watany_app') THEN
        GRANT SELECT ON smart_feature_registry TO watany_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON smart_user_preferences TO watany_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON smart_user_sessions TO watany_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON smart_user_activity_events TO watany_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON smart_user_pinned_items TO watany_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON smart_user_feature_scores TO watany_app;
        GRANT SELECT, INSERT, UPDATE ON smart_dashboard_config TO watany_app;
        GRANT SELECT, INSERT ON smart_admin_audit_log TO watany_app;
        REVOKE UPDATE, DELETE ON smart_admin_audit_log FROM watany_app;
    END IF;
END $$;