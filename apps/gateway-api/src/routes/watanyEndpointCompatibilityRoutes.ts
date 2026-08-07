import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { taxiTrustedMobilityRepository } from '../services/taxiTrustedMobilityRepository';
import { requireRole } from '../auth/rbac';

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

function loadProceduresPayload(): JsonRecord {
  const file = firstExisting([
    'data/kb_rebuild_v4/full_procedures.canonical.json',
    'data/kb_rebuild_v4/full_procedures.from_kb_studio.canonical.json',
    'apps/gateway-api/data/procedures.json',
    'apps/gateway-api/data/kb/procedures.json',
    'apps/gateway-api/data/kb/full_procedures.canonical.json'
  ]);
  if (!file) {
    return { ok: true, items: [], source: 'missing-procedures-catalog' };
  }
  const raw = readJsonFile(file);
  const items = normalizeItems(raw, ['items', 'procedures', 'documents', 'forms']);
  return { ok: true, items, source: file };
}

function sanitizePathLikeValue(value: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/\\/g, '/');
  return path.posix.basename(normalized);
}

function loadAdminKbSourcesPayload(): JsonRecord {
  const proceduresPayload = loadProceduresPayload();
  const items = normalizeItems(proceduresPayload.items, ['items']);

  const seen = new Set<string>();
  const sources = items
    .map((item, index) => {
      const record = asRecord(item);
      const authority = asRecord(record.primary_authority);
      const title = asString(record.title_ar) || asString(record.title) || `source-${index + 1}`;
      const authorityName = asString(authority.name_ar) || asString(authority.id) || 'watany-procedures';
      const key = `${authorityName}::${title}`;
      if (seen.has(key)) {
        return null;
      }
      seen.add(key);

      return {
        id: asString(authority.id) || `source-${index + 1}`,
        name: authorityName,
        title,
        source_scope: 'procedure_catalog',
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

function loadAdminDocumentsPayload(): JsonRecord {
  const proceduresPayload = loadProceduresPayload();
  const items = normalizeItems(proceduresPayload.items, ['items']);

  const seen = new Set<string>();
  const documents = items
    .flatMap((item) => {
      const record = asRecord(item);
      const title = asString(record.title_ar) || asString(record.title);
      const canonicalId = asString(record.canonical_id) || asString(record.id);
      const requiredDocuments = asArray(record.required_documents);

      return requiredDocuments.map((doc, index) => {
        const docRecord = asRecord(doc);
        const name =
          asString(docRecord.name_ar)
          || asString(docRecord.title_ar)
          || asString(docRecord.name)
          || asString(docRecord.value)
          || `${title || canonicalId || 'procedure'} document ${index + 1}`;

        const uniqueKey = `${canonicalId}::${name}`;
        if (seen.has(uniqueKey)) {
          return null;
        }
        seen.add(uniqueKey);

        return {
          id: `${canonicalId || 'proc'}-doc-${index + 1}`,
          title: name,
          procedure_id: canonicalId || null,
          procedure_title: title || null,
          source: 'kb_procedure_required_documents',
        };
      });
    })
    .filter(Boolean)
    .slice(0, 120);

  return {
    ok: true,
    documents,
    count: documents.length,
    source: proceduresPayload.source,
  };
}

function loadAdminProcedureFilesPayload(): JsonRecord {
  const proceduresPayload = loadProceduresPayload();
  const items = normalizeItems(proceduresPayload.items, ['items']);

  const files = items
    .flatMap((item) => {
      const record = asRecord(item);
      const title = asString(record.title_ar) || asString(record.title) || 'Procedure';
      const canonicalId = asString(record.canonical_id) || asString(record.id) || '';
      const links = asArray(record.links_contacts);

      return links
        .map((link, index) => {
          const linkRecord = asRecord(link);
          const kind = asString(linkRecord.kind);
          if (kind !== 'source_file') {
            return null;
          }

          const rawValue = asString(linkRecord.value);
          const safeValue = sanitizePathLikeValue(rawValue);
          if (!safeValue) {
            return null;
          }

          return {
            id: `${canonicalId || 'proc'}-file-${index + 1}`,
            procedure_id: canonicalId || null,
            procedure_title: title,
            file_name: safeValue,
            kind,
            source_scope: asString(linkRecord.source_scope) || 'source_material',
          };
        })
        .filter(Boolean);
    })
    .slice(0, 9);

  return {
    ok: true,
    files,
    count: files.length,
    source: proceduresPayload.source,
  };
}

function loadAdminKbPreviewPayload(query: string): JsonRecord {
  const q = query.trim().toLowerCase();
  const proceduresPayload = loadProceduresPayload();
  const items = normalizeItems(proceduresPayload.items, ['items']);

  const candidates = items
    .map((item) => {
      const record = asRecord(item);
      const title = asString(record.title_ar) || asString(record.title);
      const description = asString(record.short_description_ar) || asString(record.description);
      const keywords = asArray(record.keywords_ar).map((entry) => asString(entry)).filter(Boolean);
      const haystack = `${title} ${description} ${keywords.join(' ')}`.toLowerCase();
      const matches = !q || haystack.includes(q);
      if (!matches) {
        return null;
      }

      const authority = asRecord(record.primary_authority);
      return {
        procedure_id: asString(record.canonical_id) || asString(record.id) || null,
        title,
        excerpt: description,
        source_label: asString(authority.name_ar) || 'Watany Procedures Catalog',
        source_scope: 'procedure_catalog',
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