import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadRagChunks, listChunks, getChunkById, updateChunkById, persistChunksToFile } from '../ai/rag';
import { adminKbRoutes } from '../routes/admin-kb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');
const sourceRagPath = path.join(repoRoot, 'watany_kb_tables_v4', 'watany_rag_chunks_v4.jsonl');
const tempRagPath = path.join(repoRoot, 'tmp', `rag-chunks-admin-test-${process.pid}.jsonl`);
const app = Fastify();

beforeAll(async () => {
  fs.mkdirSync(path.dirname(tempRagPath), { recursive: true });
  fs.copyFileSync(sourceRagPath, tempRagPath);
  expect(loadRagChunks(tempRagPath)).toBe(1480);
  app.addHook('onRequest', async (request) => {
    request.user = { id: 'rag-admin-test', role: 'admin', email: 'admin@test.local' };
  });
  await app.register(adminKbRoutes, {
    kbSalariesDir: path.join(repoRoot, 'kb', 'salaries'),
    runtimeKbPath: path.join(repoRoot, 'apps', 'gateway-api', 'data', 'kb', 'runtime_kb.json'),
    resolvedRagPath: tempRagPath,
    repoRootPath: repoRoot,
    versionRootPath: repoRoot,
    isKbNodesReady: () => false,
    listKbNodes: () => ({ nodes: [], total: 0 }),
    writeJsonFile: async () => undefined,
    addVersionEntry: async () => ({ ok: true }),
    listVersions: async () => [],
    restoreVersion: async () => ({ ok: true }),
    loadLocalSalariesKB: () => ({ salariesIndex: {}, rankMeta: {} }),
    loadRuntimeKbJson: () => ({}),
    loadRagChunks,
    listChunks,
    getChunkById,
    updateChunkById,
    persistChunksToFile,
  });
  await app.ready();
}, 30000);

afterAll(async () => {
  await app.close();
  fs.rmSync(tempRagPath, { force: true });
  loadRagChunks(sourceRagPath);
}, 30000);

describe('RAG chunks admin endpoints', () => {
  it('GET /api/admin/kb/chunks returns the isolated authority structure', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/kb/chunks' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1480);
    expect(Array.isArray(body.chunks)).toBe(true);
  });

  it('PATCH persists only the isolated RAG and leaves canonical bytes untouched', async () => {
    const canonicalBefore = fs.readFileSync(sourceRagPath);
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/kb/chunks?pageSize=1' });
    expect(listRes.statusCode).toBe(200);
    const id = listRes.json().chunks?.[0]?.id;
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const newText = `UPDATED_BY_TEST_${Date.now()}`;
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/kb/chunk/${encodeURIComponent(id)}`,
      payload: { text: newText },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().chunk.text).toBe(newText);
    expect(fs.readFileSync(tempRagPath, 'utf8')).toContain(newText);

    const reloadRes = await app.inject({ method: 'POST', url: '/api/admin/kb/chunks/reload' });
    expect(reloadRes.statusCode).toBe(200);
    expect(reloadRes.json().loaded).toBe(1480);
    expect(fs.readFileSync(sourceRagPath)).toEqual(canonicalBefore);
    expect(fs.readFileSync(sourceRagPath, 'utf8')).not.toContain('UPDATED_BY_TEST_');
  });
});
