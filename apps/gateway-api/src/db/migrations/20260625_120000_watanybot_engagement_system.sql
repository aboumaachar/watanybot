BEGIN;

CREATE TABLE IF NOT EXISTS engagement_point_rules (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title_ar TEXT NOT NULL,
    title_en TEXT,
    category TEXT NOT NULL,
    points INTEGER NOT NULL CHECK (points <> 0),
    daily_cap INTEGER CHECK (daily_cap IS NULL OR daily_cap > 0),
    cooldown_seconds INTEGER CHECK (cooldown_seconds IS NULL OR cooldown_seconds >= 0),
    requires_verification BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagement_levels (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title_ar TEXT NOT NULL,
    title_en TEXT,
    minimum_points INTEGER NOT NULL CHECK (minimum_points >= 0),
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagement_point_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    rule_id TEXT REFERENCES engagement_point_rules(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    points INTEGER NOT NULL CHECK (points <> 0),
    reason_ar TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reversed_at TIMESTAMPTZ,
    reversed_by_user_id TEXT,
    reversal_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_engagement_point_transactions_user_created
    ON engagement_point_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_point_transactions_rule_created
    ON engagement_point_transactions(rule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_point_transactions_source
    ON engagement_point_transactions(source_type, source_id);

CREATE TABLE IF NOT EXISTS engagement_reputation_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    reputation_delta INTEGER NOT NULL CHECK (reputation_delta <> 0),
    reason_ar TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    verified_by_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reversed_at TIMESTAMPTZ,
    reversed_by_user_id TEXT,
    reversal_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_engagement_reputation_user_created
    ON engagement_reputation_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS engagement_badges (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    title_en TEXT,
    description_ar TEXT,
    icon_name TEXT,
    is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagement_user_badges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL REFERENCES engagement_badges(id) ON DELETE RESTRICT,
    evidence_type TEXT,
    evidence_id TEXT,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    awarded_by_user_id TEXT,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by_user_id TEXT,
    revoke_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_engagement_active_user_badge
    ON engagement_user_badges(user_id, badge_id)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_engagement_user_badges_user_awarded
    ON engagement_user_badges(user_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS engagement_audit_log (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_audit_created
    ON engagement_audit_log(created_at DESC);

INSERT INTO engagement_levels (
    id,
    code,
    title_ar,
    title_en,
    minimum_points,
    sort_order
)
VALUES
    ('level-member', 'member', 'عضو', 'Member', 0, 1),
    ('level-active-member', 'active_member', 'عضو فعّال', 'Active Member', 500, 2),
    ('level-community-helper', 'community_helper', 'مساعد المجتمع', 'Community Helper', 1500, 3),
    ('level-guide', 'guide', 'مرشد', 'Guide', 3000, 4),
    ('level-expert', 'expert', 'خبير', 'Expert', 7500, 5),
    ('level-watany-ambassador', 'watany_ambassador', 'سفير موطني', 'Watany Ambassador', 15000, 6)
ON CONFLICT (code) DO UPDATE SET
    title_ar = EXCLUDED.title_ar,
    title_en = EXCLUDED.title_en,
    minimum_points = EXCLUDED.minimum_points,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

INSERT INTO engagement_point_rules (
    id,
    code,
    title_ar,
    title_en,
    category,
    points,
    daily_cap,
    cooldown_seconds,
    requires_verification
)
VALUES
    ('rule-procedure-open', 'procedure_open', 'فتح معاملة إرشادية', 'Open procedure guide', 'learning', 5, 20, 300, FALSE),
    ('rule-procedure-complete', 'procedure_complete', 'إكمال دليل معاملة', 'Complete procedure guide', 'learning', 20, 100, 0, FALSE),
    ('rule-law-read', 'law_read', 'قراءة مرجع قانوني', 'Read legal reference', 'learning', 10, 40, 300, FALSE),
    ('rule-calculator-use', 'calculator_use', 'استخدام حاسبة موثّقة', 'Use verified calculator', 'learning', 5, 20, 600, FALSE),
    ('rule-helpful-answer', 'helpful_answer', 'إجابة مفيدة', 'Helpful answer', 'community', 15, 90, 0, TRUE),
    ('rule-answer-upvote', 'answer_upvote', 'تأييد إجابة مفيدة', 'Helpful answer upvote', 'community', 5, 50, 0, TRUE),
    ('rule-event-participation', 'event_participation', 'مشاركة في فعالية', 'Event participation', 'civic', 25, 100, 0, TRUE),
    ('rule-survey-participation', 'survey_participation', 'مشاركة في استبيان', 'Survey participation', 'civic', 20, 40, 0, TRUE),
    ('rule-volunteer-activity', 'volunteer_activity', 'نشاط تطوعي موثّق', 'Verified volunteer activity', 'volunteer', 100, 300, 0, TRUE),
    ('rule-blood-donation', 'blood_donation', 'مشاركة موثّقة بحملة تبرع بالدم', 'Verified blood donation campaign', 'volunteer', 150, 300, 0, TRUE)
ON CONFLICT (code) DO UPDATE SET
    title_ar = EXCLUDED.title_ar,
    title_en = EXCLUDED.title_en,
    category = EXCLUDED.category,
    points = EXCLUDED.points,
    daily_cap = EXCLUDED.daily_cap,
    cooldown_seconds = EXCLUDED.cooldown_seconds,
    requires_verification = EXCLUDED.requires_verification,
    is_active = TRUE,
    updated_at = NOW();

INSERT INTO engagement_badges (
    id,
    code,
    category,
    title_ar,
    title_en,
    description_ar,
    icon_name,
    is_manual
)
VALUES
    ('badge-first-contribution', 'first_contribution', 'community', 'أول مساهمة', 'First Contribution', 'تُمنح بعد أول مساهمة موثّقة.', 'sparkle', FALSE),
    ('badge-community-helper', 'community_helper', 'community', 'مساعد المجتمع', 'Community Helper', 'تُمنح للمساهمات المفيدة والموثّقة.', 'people-community', FALSE),
    ('badge-volunteer', 'volunteer', 'service', 'متطوع', 'Volunteer', 'تُمنح بعد نشاط تطوعي موثّق.', 'hand-heart', FALSE),
    ('badge-retirement-rights', 'retirement_rights', 'learning', 'خبير الحقوق التقاعدية', 'Retirement Rights', 'تُمنح بعد إكمال مسار الحقوق التقاعدية.', 'book-open', FALSE)
ON CONFLICT (code) DO UPDATE SET
    category = EXCLUDED.category,
    title_ar = EXCLUDED.title_ar,
    title_en = EXCLUDED.title_en,
    description_ar = EXCLUDED.description_ar,
    icon_name = EXCLUDED.icon_name,
    is_active = TRUE;

COMMIT;