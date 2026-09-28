import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { taxiTrustedMobilityRepository } from '../services/taxiTrustedMobilityRepository';
import { requireRole } from '../auth/rbac';
import { loadIndex } from '../procedures/indexer';
import { getProcedureRuntimeInfo } from '../procedures/config';

type JsonRecord = Record<string, unknown>;

const fallbackFaq = [
  {
    id: 'faq-taxi-service',
    question_ar: 'كيف أطلب تاكسي عبر وطني؟',
    answer_ar: 'اختر خدمة التاكسي، حدد المنطقة، ثم اتصل بسائق موثوق أو أرسل طلب حجز. اتفق على السعر بوضوح قبل الانطلاق.',
    category: 'services'
  },
  {
    id: 'faq-procedures',
    question_ar: 'أين أجد الإجراءات والاستمارات؟',
    answer_ar: 'من صفحة الإجراءات أو الاستمارات يمكنك اختيار الفئة ثم فتح المعاينة أو التحميل أو المشاركة من صف الأيقونات.',
    category: 'procedures'
  }
];

function candidateRoots(): string[] {
  const cwd = process.cwd();
  return Array.from(new Set([
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', '..'),
    path.resolve(cwd, 'apps', 'gateway-api'),
    path.resolve(cwd, '..', 'apps', 'gateway-api')
  ]));
}

function firstExisting(relatives: string[]): string | null {
  for (const root of candidateRoots()) {
    for (const rel of relatives) {
      const full = path.resolve(root, rel);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return full;
      }
    }
  }
  return null;
}

function readJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeItems(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  const record = asRecord(raw);
  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function loadFaqPayload(): JsonRecord {
  const file = firstExisting([
    'data/faq.json',
    'data/faqs.json',
    'apps/gateway-api/data/faq.json',
    'apps/gateway-api/data/faqs.json',
    'apps/gateway-api/data/kb/faq.json',
    'apps/gateway-api/data/kb/faqs.json'
  ]);
  if (!file) {
    return { ok: true, items: fallbackFaq, source: 'fallback-faq' };
  }
  const raw = readJsonFile(file);
  const items = normalizeItems(raw, ['items', 'faq', 'faqs', 'questions']);
  return { ok: true, items, source: file };
}

async function loadProceduresPayload(): Promise<JsonRecord> {
  const state = await loadIndex(false);
  const runtime = getProcedureRuntimeInfo();
  return {
    ok: true,
    items: state.procedures,
    total: state.procedures.length,
    source: runtime.source,
    dataDir: runtime.dataDir,
  };
}

function sanitizePathLikeValue(value: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/\\/g, '/');
  return path.posix.basename(normalized);
}

async function loadAdminKbSourcesPayload(): Promise<JsonRecord> {
  const proceduresPayload = await loadProceduresPayload();
  const items = normalizeItems(proceduresPayload.items, ['items']);

  const seen = new Set<string>();
  const sources = items
    .map((item, index) => {
      const record = asRecord(item);
      const sourceId = asString(record.source) || `source-${index + 1}`;
      const sourceLabel = asString(record.source_label) || sourceId;
      const key = sourceId.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: sourceId,
        name: sourceLabel,
        title: sourceLabel,
        source_scope: 'procedure_runtime',
      };
    })
    .filter(Boolean)
    .slice(0, 120);

  return {
    ok: true,
    sources,
    count: sources.length,
    source: proceduresPayload.source,
  };
}

async function loadAdminDocumentsPayload(): Promise<JsonRecord> {
  const state = await loadIndex(false);
  const runtime = getProcedureRuntimeInfo();
  const documents = state.docs.slice(0, 120).map((doc) => ({
    id: doc.id,
    title: doc.title,
    url: doc.url || doc.public_url || null,
    file_name: doc.file_name || null,
    file_path: doc.file_path || null,
    file_format: doc.file_format || null,
    linked_procedures: doc.linked_procedures || [],
    source: 'procedure_runtime_documents',
  }));

  return {
    ok: true,
    documents,
    count: documents.length,
    total: state.docs.length,
    source: runtime.source,
  };
}

async function loadAdminProcedureFilesPayload(): Promise<JsonRecord> {
  const state = await loadIndex(false);
  const runtime = getProcedureRuntimeInfo();
  const files = state.docs
    .filter((doc) => Boolean(doc.file_name || doc.file_path || doc.public_url || doc.url))
    .slice(0, 120)
    .map((doc) => ({
      id: doc.id,
      procedure_ids: doc.linked_procedures || [],
      file_name: sanitizePathLikeValue(doc.file_name || doc.file_path || doc.public_url || doc.url || ''),
      kind: doc.asset_type || 'source_file',
      source_scope: 'procedure_runtime_documents',
    }));

  return {
    ok: true,
    files,
    count: files.length,
    total: state.docs.length,
    source: runtime.source,
  };
}

async function loadAdminKbPreviewPayload(query: string): Promise<JsonRecord> {
  const q = query.trim().toLowerCase();
  const proceduresPayload = await loadProceduresPayload();
  const items = normalizeItems(proceduresPayload.items, ['items']);

  const candidates = items
    .map((item) => {
      const record = asRecord(item);
      const title = asString(record.title_ar) || asString(record.title);
      const description = asString(record.summary_lb) || asString(record.summary_en);
      const keywords = asArray(record.tags).map((entry) => asString(entry)).filter(Boolean);
      const haystack = `${title} ${description} ${keywords.join(' ')}`.toLowerCase();
      if (q && !haystack.includes(q)) return null;

      return {
        procedure_id: asString(record.id) || null,
        title,
        excerpt: description,
        source_label: asString(record.source_label) || asString(record.source) || 'Watany Procedures Runtime',
        source_scope: 'procedure_runtime',
      };
    })
    .filter(Boolean)
    .slice(0, 5);

  return {
    ok: true,
    query,
    has_grounded_preview: candidates.length > 0,
    source_grounded_candidate: candidates,
    source: proceduresPayload.source,
  };
}

const watanyEndpointCompatibilityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/faq', async () => loadFaqPayload());

  app.get('/api/procedures', async () => loadProceduresPayload());

  app.get('/api/admin/kb/sources', { preHandler: [requireRole('admin')] }, async () => {
    return loadAdminKbSourcesPayload();
  });

  app.get('/api/admin/kb/preview', { preHandler: [requireRole('admin')] }, async (request) => {
    const query = request.query as { q?: string };
    return loadAdminKbPreviewPayload(query.q || '');
  });

  app.get('/api/admin/documents', { preHandler: [requireRole('admin')] }, async () => {
    return loadAdminDocumentsPayload();
  });

  app.get('/api/admin/procedures/files', { preHandler: [requireRole('admin')] }, async () => {
    return loadAdminProcedureFilesPayload();
  });

  app.get('/api/taxi/drivers', async (request) => {
    const query = request.query as { area?: string };
    return {
      ok: true,
      drivers: taxiTrustedMobilityRepository.listApprovedAvailable(query.area),
      source: 'taxiTrustedMobilityRepository'
    };
  });

  app.get('/api/taxi/availability', async () => ({
    ok: true,
    drivers: taxiTrustedMobilityRepository.listApprovedAvailable(),
    source: 'taxiTrustedMobilityRepository'
  }));

  app.post('/api/taxi/availability', async (request, reply) => {
    const body = request.body as { driverId?: string; availability?: 'AVAILABLE' | 'BUSY' | 'OFFLINE'; areaLabel?: string };
    if (!body.driverId) {
      reply.code(400);
      return { ok: false, error: 'driverId is required' };
    }
    const driver = taxiTrustedMobilityRepository.setAvailability(
      body.driverId,
      body.availability ?? 'AVAILABLE',
      body.areaLabel ?? 'غير محدد'
    );
    return { ok: true, driver };
  });
};

export default watanyEndpointCompatibilityRoutes;
export { watanyEndpointCompatibilityRoutes };