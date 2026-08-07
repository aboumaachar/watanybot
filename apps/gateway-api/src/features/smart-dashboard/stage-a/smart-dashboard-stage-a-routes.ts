import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type SmartDashboardRole = 'VETERAN' | 'RETIRED_OFFICER' | 'FAMILY_MEMBER' | 'ADMIN' | 'SUPERADMIN';
type QueryResultLike = { rows?: any[]; rowCount?: number };
type QueryableDb = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResultLike> | QueryResultLike;
};

type SmartDashboardUser = {
  id?: string;
  userId?: string;
  sub?: string;
  role?: string;
  roles?: string[];
};

const DEFAULT_ROLE: SmartDashboardRole = 'VETERAN';
const MISSING_DB_CODE = 'SMART_DASHBOARD_DB_NOT_CONFIGURED';
const SCHEMA_NOT_READY_CODE = 'SMART_DASHBOARD_SCHEMA_NOT_READY';

function getDb(app: FastifyInstance): QueryableDb | null {
  const anyApp = app as any;
  const candidate = anyApp.pg ?? anyApp.db ?? anyApp.postgres ?? null;
  if (candidate && typeof candidate.query === 'function') {
    return candidate as QueryableDb;
  }
  return null;
}

function getUser(request: FastifyRequest): SmartDashboardUser | null {
  const anyRequest = request as any;
  return (anyRequest.user ?? anyRequest.authUser ?? anyRequest.session?.user ?? null) as SmartDashboardUser | null;
}

function getUserId(request: FastifyRequest): string | null {
  const user = getUser(request);
  return user?.id ?? user?.userId ?? user?.sub ?? null;
}

function getRole(request: FastifyRequest): SmartDashboardRole {
  const user = getUser(request);
  const directRole = user?.role;
  if (directRole === 'SUPERADMIN' || directRole === 'ADMIN' || directRole === 'RETIRED_OFFICER' || directRole === 'FAMILY_MEMBER' || directRole === 'VETERAN') {
    return directRole;
  }
  const roles = Array.isArray(user?.roles) ? user?.roles ?? [] : [];
  if (roles.includes('SUPERADMIN')) return 'SUPERADMIN';
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('RETIRED_OFFICER')) return 'RETIRED_OFFICER';
  if (roles.includes('FAMILY_MEMBER')) return 'FAMILY_MEMBER';
  return DEFAULT_ROLE;
}

function isAdminRole(role: SmartDashboardRole): boolean {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

function sendDbNotConfigured(reply: FastifyReply) {
  return reply.code(503).send({
    ok: false,
    code: MISSING_DB_CODE,
    message: 'Smart Dashboard Stage A database is not configured yet.',
  });
}

function createDashboardFallback() {
  return {
    ok: true,
    personalization_active: false,
    session_count: 0,
    critical_zone: [],
    personalized_zone: [],
    default_zone: [],
    all_services_link: '/services',
    font_size: '18pt',
    direction: 'rtl' as const,
  };
}

function sendUnauthorized(reply: FastifyReply) {
  return reply.code(401).send({ ok: false, code: 'UNAUTHORIZED', message: 'Authentication required.' });
}

function sendForbidden(reply: FastifyReply) {
  return reply.code(403).send({ ok: false, code: 'FORBIDDEN', message: 'Admin role required.' });
}

function isSchemaNotReady(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? '');
  return /relation .* does not exist|no such table|undefined_table|SQLITE_ERROR/i.test(message);
}

function safeErrorCode(error: unknown): string {
  if (isSchemaNotReady(error)) return SCHEMA_NOT_READY_CODE;
  return 'SMART_DASHBOARD_QUERY_FAILED';
}

function hasForbiddenRawTextKey(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const forbidden = new Set(['raw_text', 'rawText', 'question', 'question_text', 'questionText', 'query', 'prompt', 'message', 'body']);
  const obj = value as Record<string, unknown>;
  return Object.keys(obj).some((key) => forbidden.has(key));
}

function validateMetadata(value: unknown): { ok: boolean; metadata: Record<string, unknown> } {
  if (value === undefined || value === null) return { ok: true, metadata: {} };
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, metadata: {} };
  const obj = value as Record<string, unknown>;
  const allowed = new Set(['feature_key', 'sub_section', 'intent_category']);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) return { ok: false, metadata: {} };
  }
  return { ok: true, metadata: obj };
}

async function runQuery(db: QueryableDb, sql: string, params: unknown[] = []): Promise<QueryResultLike> {
  const result = await db.query(sql, params);
  return result ?? { rows: [], rowCount: 0 };
}

export async function smartDashboardStageARoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/features/registry', async (request, reply) => {
    const db = getDb(app);
    if (!db) return sendDbNotConfigured(reply);
    const role = getRole(request);
    try {
      const result = await runQuery(db, `
        SELECT key, title_ar, title_en, route, icon_key, group_ar, required_roles,
               default_priority, is_critical, personalization_allowed, notification_category,
               synonyms_ar, smoke_test_route, visibility_condition, registry_version
        FROM smart_feature_registry
        WHERE $1 = ANY(required_roles)
        ORDER BY is_critical DESC, default_priority DESC, title_ar ASC
      `, [role]);
      return reply.send({ ok: true, role, items: result.rows ?? [] });
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });

  app.get('/api/dashboard', async (request, reply) => {
    const db = getDb(app);
    if (!db) return reply.send(createDashboardFallback());
    const userId = getUserId(request);
    if (!userId) return sendUnauthorized(reply);
    const role = getRole(request);
    try {
      const pref = await runQuery(db, `
        SELECT smart_personalization_enabled, session_count, font_size
        FROM smart_user_preferences
        WHERE user_id = $1
      `, [userId]);
        const preferences = pref.rows?.[0] ?? { smart_personalization_enabled: false, session_count: 0, font_size: 18 };
        const personalizationActive = Boolean(preferences.smart_personalization_enabled) && Number(preferences.session_count ?? 0) >= 3;
      const registry = await runQuery(db, `
        SELECT key AS feature_key, title_ar, route, icon_key, group_ar, is_critical, default_priority
        FROM smart_feature_registry
        WHERE $1 = ANY(required_roles)
        ORDER BY is_critical DESC, default_priority DESC, title_ar ASC
        LIMIT 12
      `, [role]);
      const items = registry.rows ?? [];
      return reply.send({
        ok: true,
        personalization_active: personalizationActive,
        session_count: Number(preferences.session_count ?? 0),
        critical_zone: items.filter((item: any) => item.is_critical).slice(0, 2),
        personalized_zone: personalizationActive ? items.filter((item: any) => !item.is_critical).slice(0, 7) : [],
        default_zone: personalizationActive ? [] : items,
        all_services_link: '/services',
        font_size: `${Number(preferences.font_size ?? 18)}pt`,
        direction: 'rtl',
      });
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });

  app.get('/api/user/preferences', async (request, reply) => {
    const db = getDb(app);
    if (!db) return sendDbNotConfigured(reply);
    const userId = getUserId(request);
    if (!userId) return sendUnauthorized(reply);
    try {
      const result = await runQuery(db, `
        SELECT language, font_size, smart_personalization_enabled, preferred_dashboard_layout, session_count
        FROM smart_user_preferences
        WHERE user_id = $1
      `, [userId]);
      return reply.send({ ok: true, preferences: result.rows?.[0] ?? null });
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });

  app.put('/api/user/preferences', async (request, reply) => {
    const db = getDb(app);
    if (!db) return sendDbNotConfigured(reply);
    const userId = getUserId(request);
    if (!userId) return sendUnauthorized(reply);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const fontSize = Number(body.font_size ?? 18);
    if (![18, 22, 26].includes(fontSize)) return reply.code(400).send({ ok: false, code: 'INVALID_FONT_SIZE' });
    const enabled = body.smart_personalization_enabled !== false;
    const layout = typeof body.preferred_dashboard_layout === 'string' ? body.preferred_dashboard_layout : 'standard_grid';
    try {
      await runQuery(db, `
        INSERT INTO smart_user_preferences (user_id, language, font_size, smart_personalization_enabled, preferred_dashboard_layout)
        VALUES ($1, 'ar', $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          font_size = EXCLUDED.font_size,
          smart_personalization_enabled = EXCLUDED.smart_personalization_enabled,
          preferred_dashboard_layout = EXCLUDED.preferred_dashboard_layout,
          updated_at = NOW()
      `, [userId, fontSize, enabled, layout]);
      return reply.send({ ok: true });
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });

  app.post('/api/activity/event', async (request, reply) => {
    const db = getDb(app);
    if (!db) return sendDbNotConfigured(reply);
    const userId = getUserId(request);
    if (!userId) return sendUnauthorized(reply);
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (hasForbiddenRawTextKey(body)) return reply.code(400).send({ ok: false, code: 'RAW_TEXT_NOT_ALLOWED' });
    const metadataValidation = validateMetadata(body.metadata_json);
    if (!metadataValidation.ok || hasForbiddenRawTextKey(metadataValidation.metadata)) {
      return reply.code(400).send({ ok: false, code: 'INVALID_METADATA_SCHEMA' });
    }
    const eventType = typeof body.event_type === 'string' ? body.event_type : '';
    const featureKey = typeof body.feature_key === 'string' ? body.feature_key : '';
    const pagePath = typeof body.page_path === 'string' ? body.page_path : '';
    const intentCategory = typeof body.intent_category === 'string' ? body.intent_category : null;
    if (!eventType || !featureKey || !pagePath) return reply.code(400).send({ ok: false, code: 'MISSING_REQUIRED_FIELDS' });
    try {
      await runQuery(db, `
        INSERT INTO smart_user_activity_events (user_id, event_type, feature_key, page_path, intent_category, metadata_json)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `, [userId, eventType, featureKey, pagePath, intentCategory, JSON.stringify(metadataValidation.metadata)]);
      return reply.code(201).send({ ok: true });
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });

  app.post('/api/user/pinned', async (request, reply) => {
    const db = getDb(app);
    if (!db) return sendDbNotConfigured(reply);
    const userId = getUserId(request);
    if (!userId) return sendUnauthorized(reply);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const featureKey = typeof body.feature_key === 'string' ? body.feature_key : '';
    const sortOrder = Number(body.sort_order ?? 0);
    if (!featureKey) return reply.code(400).send({ ok: false, code: 'MISSING_FEATURE_KEY' });
    try {
      await runQuery(db, `
        INSERT INTO smart_user_pinned_items (user_id, feature_key, sort_order)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, feature_key) DO UPDATE SET sort_order = EXCLUDED.sort_order
      `, [userId, featureKey, sortOrder]);
      return reply.code(201).send({ ok: true });
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });

  app.delete('/api/user/pinned/:key', async (request, reply) => {
    const db = getDb(app);
    if (!db) return sendDbNotConfigured(reply);
    const userId = getUserId(request);
    if (!userId) return sendUnauthorized(reply);
    const key = typeof (request.params as any)?.key === 'string' ? (request.params as any).key : '';
    try {
      await runQuery(db, 'DELETE FROM smart_user_pinned_items WHERE user_id = $1 AND feature_key = $2', [userId, key]);
      return reply.code(204).send();
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });

  app.delete('/api/user/activity', async (request, reply) => {
    const db = getDb(app);
    if (!db) return sendDbNotConfigured(reply);
    const userId = getUserId(request);
    if (!userId) return sendUnauthorized(reply);
    try {
      await runQuery(db, 'DELETE FROM smart_user_activity_events WHERE user_id = $1', [userId]);
      await runQuery(db, 'DELETE FROM smart_user_feature_scores WHERE user_id = $1', [userId]);
      return reply.code(204).send();
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });

  app.get('/api/admin/dashboard-config', async (request, reply) => {
    const db = getDb(app);
    if (!db) return sendDbNotConfigured(reply);
    const role = getRole(request);
    if (!isAdminRole(role)) return sendForbidden(reply);
    try {
      const result = await runQuery(db, 'SELECT * FROM smart_dashboard_config ORDER BY role, feature_key');
      return reply.send({ ok: true, items: result.rows ?? [] });
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });

  app.put('/api/admin/dashboard-config', async (request, reply) => {
    const db = getDb(app);
    if (!db) return sendDbNotConfigured(reply);
    const role = getRole(request);
    const adminId = getUserId(request);
    if (!isAdminRole(role) || !adminId) return sendForbidden(reply);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const targetRole = typeof body.role === 'string' ? body.role : 'VETERAN';
    const featureKey = typeof body.feature_key === 'string' ? body.feature_key : '';
    const priorityOverride = Number(body.priority_override ?? 0);
    const isHidden = Boolean(body.is_hidden ?? false);
    const forcedVisible = Boolean(body.forced_visible ?? false);
    if (!featureKey) return reply.code(400).send({ ok: false, code: 'MISSING_FEATURE_KEY' });
    try {
      await runQuery(db, `
        INSERT INTO smart_dashboard_config (role, feature_key, priority_override, is_hidden, forced_visible, updated_by_admin_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (role, feature_key) DO UPDATE SET
          priority_override = EXCLUDED.priority_override,
          is_hidden = EXCLUDED.is_hidden,
          forced_visible = EXCLUDED.forced_visible,
          updated_by_admin_id = EXCLUDED.updated_by_admin_id,
          updated_at = NOW()
      `, [targetRole, featureKey, priorityOverride, isHidden, forcedVisible, adminId]);
      await runQuery(db, `
        INSERT INTO smart_admin_audit_log (admin_id, feature_key, change_type, old_value, new_value, justification_text)
        VALUES ($1, $2, 'DASHBOARD_CONFIG_UPSERT', '{}'::jsonb, $3::jsonb, 'Stage A admin config update')
      `, [adminId, featureKey, JSON.stringify({ role: targetRole, priority_override: priorityOverride, is_hidden: isHidden, forced_visible: forcedVisible })]);
      return reply.send({ ok: true });
    } catch (error) {
      const code = safeErrorCode(error);
      return reply.code(code === SCHEMA_NOT_READY_CODE ? 503 : 500).send({ ok: false, code });
    }
  });
}

export default smartDashboardStageARoutes;