import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

type QueryParams = readonly unknown[] | unknown[];

type QueryableDb = {
  query: (sql: string, params?: QueryParams) => Promise<unknown>;
};

function envEnabled(value: string | undefined): boolean {
  return String(value || '').trim().toLowerCase() === 'true';
}

function readConnectionString(): string {
  return String(
    process.env.SMART_DASHBOARD_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.PG_CONNECTION_STRING ||
      '',
  ).trim();
}

function readPoolMax(): number {
  const raw = Number(process.env.SMART_DASHBOARD_PG_POOL_MAX || process.env.PGPOOL_MAX || 5);
  if (!Number.isFinite(raw) || raw < 1) return 5;
  return Math.min(Math.floor(raw), 20);
}

function shouldUseSsl(): boolean | undefined {
  const raw = String(process.env.SMART_DASHBOARD_PG_SSL || process.env.PGSSLMODE || '').toLowerCase();
  if (raw === 'require' || raw === 'true') return true;
  if (raw === 'disable' || raw === 'false') return false;
  return undefined;
}

/**
 * Root-level attachment for Smart Dashboard Stage A.
 *
 * This is intentionally NOT registered as a normal Fastify plugin because
 * Fastify plugin encapsulation would hide decorations from sibling route plugins.
 *
 * It only decorates app.pg/app.db when a PostgreSQL connection string exists.
 * Without DB env, the existing lazy guard continues returning controlled 503.
 */
export function attachSmartDashboardStageADb(app: FastifyInstance): void {
  const anyApp = app as FastifyInstance & {
    pg?: QueryableDb;
    db?: QueryableDb;
    hasDecorator?: (name: string) => boolean;
    decorate?: (name: string, value: unknown) => void;
    log?: { info?: (obj: unknown, message?: string) => void; warn?: (obj: unknown, message?: string) => void };
  };

  if (envEnabled(process.env.SMART_DASHBOARD_DB_DISABLE)) {
    anyApp.log?.warn?.({ feature: 'smart-dashboard-stage-a' }, 'Smart Dashboard DB attach disabled by env.');
    return;
  }

  if (anyApp.pg && typeof anyApp.pg.query === 'function') {
    anyApp.log?.info?.({ feature: 'smart-dashboard-stage-a' }, 'Smart Dashboard using existing app.pg query adapter.');
    return;
  }

  if (anyApp.db && typeof anyApp.db.query === 'function') {
    anyApp.log?.info?.({ feature: 'smart-dashboard-stage-a' }, 'Smart Dashboard using existing app.db query adapter.');
    return;
  }

  const connectionString = readConnectionString();
  if (!connectionString) {
    anyApp.log?.warn?.(
      { feature: 'smart-dashboard-stage-a' },
      'Smart Dashboard DB not attached: no DATABASE_URL/SMART_DASHBOARD_DATABASE_URL provided.',
    );
    return;
  }

  const ssl = shouldUseSsl();
  const pool = new Pool({
    connectionString,
    max: readPoolMax(),
    ssl: ssl === undefined ? undefined : ssl ? { rejectUnauthorized: false } : false,
  });

  const adapter: QueryableDb = {
    query: (sql, params) => pool.query(sql, params as unknown[] | undefined),
  };

  const canDecoratePg = !anyApp.hasDecorator || !anyApp.hasDecorator('pg');
  const canDecorateDb = !anyApp.hasDecorator || !anyApp.hasDecorator('db');

  if (canDecoratePg && typeof anyApp.decorate === 'function') {
    anyApp.decorate('pg', adapter);
  } else {
    anyApp.pg = adapter;
  }

  if (canDecorateDb && typeof anyApp.decorate === 'function') {
    anyApp.decorate('db', adapter);
  } else {
    anyApp.db = adapter;
  }

  app.addHook('onClose', async () => {
    await pool.end();
  });

  anyApp.log?.info?.(
    { feature: 'smart-dashboard-stage-a', poolMax: readPoolMax(), ssl: ssl === true },
    'Smart Dashboard PostgreSQL adapter attached.',
  );
}
