import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import app from '../server';
import { cleanupSessionUsers, createSessionToken } from './helpers/session-auth';

// runtime-save and rollback write files. Point them at a temp copy so the
// tracked src/data/kb/runtime_kb.json and data/kb_versions stay untouched.
// Hoisted so RUNTIME_KB_JSON is set before ../server bootstraps the KB.
const isolated = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const trackedRuntime = path.resolve(here, '..', 'data', 'kb', 'runtime_kb.json');
  // restoreVersion() writes to <versionsDir>/../../<file>, so nest versions two levels under root.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'watany-kb-versions-'));
  const versionsDir = path.join(root, 'data', 'kb_versions');
  const runtimePath = path.join(root, 'runtime_kb.json');
  fs.mkdirSync(versionsDir, { recursive: true });
  fs.copyFileSync(trackedRuntime, runtimePath);
  process.env.RUNTIME_KB_JSON = runtimePath;
  return { root, versionsDir, runtimePath, trackedRuntime };
});

vi.mock('../lib/versioning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/versioning')>();
  return { ...actual, createVersioningService: () => actual.createVersioningService(isolated.versionsDir) };
});

vi.mock('../lib/db.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db.js')>();
  return {
    ...actual,
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("SELECT id, email, role FROM users WHERE id = $1 AND status = 'active'")) {
        return { rows: [{ id: String(params[0]), email: 'admin@test.com', role: 'admin' }], rowCount: 1 };
      }
      if (sql.includes('SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > now()')) {
        return { rows: [{ id: String(params[0]) }], rowCount: 1 };
      }
      return actual.query(sql, params);
    }),
  };
});

process.env.JWT_SECRET ||= 'test-jwt-secret-for-admin-tests-0123456789abcdef';

// Admin paths resolve the principal from the database (active user + live session + sid).
let adminToken = '';
beforeAll(async () => { adminToken = await createSessionToken('admin'); }, 30000);
afterAll(async () => { await cleanupSessionUsers(); });

function adminHeaders() {
  return { authorization: `Bearer ${adminToken}` };
}

describe('KB versions & rollback', () => {
  let trackedBefore: Buffer;
  beforeAll(() => {
    trackedBefore = fs.readFileSync(isolated.trackedRuntime);
  });
  afterAll(() => {
    fs.rmSync(isolated.root, { recursive: true, force: true });
  });

  it('uses the temp runtime KB copy, not the tracked file', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/kb/runtime', headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    expect(path.resolve(JSON.parse(res.payload).path)).toBe(path.resolve(isolated.runtimePath));
  });

  it('GET /api/admin/kb/versions returns array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/kb/versions', headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || '{}');
    expect(Array.isArray(body.versions)).toBe(true);
  });

  it('POST /api/admin/kb/runtime-save creates a version entry', async () => {
    const payload = { builtAt: new Date().toISOString(), kb: { procedures: [{ id: 'TEST_SAVE' }] } };
    const saveRes = await app.inject({ method: 'POST', url: '/api/admin/kb/runtime-save', payload, headers: adminHeaders() });
    expect(saveRes.statusCode).toBe(200);
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/kb/versions?file=runtime_kb.json', headers: adminHeaders() });
    const listBody = JSON.parse(listRes.payload || '{}');
    expect(listBody.versions.length).toBeGreaterThan(0);
  });

  it('POST /api/admin/kb/versions/rollback restores a version', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/kb/versions?file=runtime_kb.json', headers: adminHeaders() });
    const listBody = JSON.parse(listRes.payload || '{}');
    const first = listBody.versions?.[0];
    expect(first).toBeDefined();
    const rb = await app.inject({ method: 'POST', url: '/api/admin/kb/versions/rollback', payload: { id: first.id }, headers: adminHeaders() });
    expect(rb.statusCode).toBe(200);
    const rbBody = JSON.parse(rb.payload || '{}');
    expect(rbBody.ok).toBe(true);
    expect(path.resolve(rbBody.restored)).toBe(path.resolve(isolated.root, 'runtime_kb.json'));
  });

  it('leaves the tracked runtime_kb.json byte-identical', () => {
    expect(fs.readFileSync(isolated.trackedRuntime).equals(trackedBefore)).toBe(true);
  });
});