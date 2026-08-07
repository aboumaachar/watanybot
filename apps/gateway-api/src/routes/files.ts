import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { loadIndex, mapStoredDocAssetToDocRef, resolveProcedureId } from '../procedures/indexer.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type UploadBody = {
  filename?: string;
  mimeType?: string;
  dataUrl?: string;
  base64?: string;
};

function resolveMimeTypeFromBody(body: UploadBody): string {
  const explicitMimeType = String(body?.mimeType || '').trim().toLowerCase();
  if (explicitMimeType) {
    return explicitMimeType;
  }

  if (body?.dataUrl) {
    const match = String(body.dataUrl).match(/^data:([^;]+);base64,/i);
    if (match?.[1]) {
      return String(match[1]).trim().toLowerCase();
    }
  }

  return '';
}

function normalizeExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '';
}

function parseUploadPayload(body: UploadBody) {
  const mimeType = resolveMimeTypeFromBody(body);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false as const, statusCode: 415, error: 'UNSUPPORTED_IMAGE_TYPE' };
  }

  if (mimeType === 'image/svg+xml') {
    return { ok: false as const, statusCode: 415, error: 'SVG_NOT_ALLOWED' };
  }

  let base64 = String(body?.base64 || '').trim();

  if (!base64 && body?.dataUrl) {
    const dataUrl = String(body.dataUrl);
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return { ok: false as const, statusCode: 400, error: 'INVALID_DATA_URL' };
    }

    const dataUrlMime = String(match[1] || '').trim().toLowerCase();
    if (dataUrlMime !== mimeType) {
      return { ok: false as const, statusCode: 400, error: 'MIME_TYPE_MISMATCH' };
    }

    base64 = String(match[2] || '').trim();
  }

  if (!base64) {
    return { ok: false as const, statusCode: 400, error: 'MISSING_IMAGE_DATA' };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false as const, statusCode: 400, error: 'INVALID_BASE64' };
  }

  if (!buffer.length) {
    return { ok: false as const, statusCode: 400, error: 'EMPTY_UPLOAD' };
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false as const, statusCode: 413, error: 'UPLOAD_TOO_LARGE' };
  }

  return { ok: true as const, mimeType, buffer };
}

export async function filesRoutes(fastify: FastifyInstance) {
  const uploadRoot = path.resolve(process.cwd(), 'runtime', 'uploads');
  await fs.mkdir(uploadRoot, { recursive: true });

  fastify.get('/api/v2/files', async (request) => {
    const query = (request.query || {}) as {
      procedureId?: string;
      limit?: number | string;
    };

    const requestedProcedureId = String(query.procedureId || '').trim();
    const limitValue = Number(query.limit || 100);
    const limit = Number.isFinite(limitValue) ? Math.max(0, Math.min(limitValue, 500)) : 100;
    const state = await loadIndex(false);
    const relatedProcedureIdsByDocId = new Map<string, string[]>();

    for (const relation of state.map) {
      const normalizedProcedureId = String(relation.procedure_id || '').trim().toLowerCase();
      if (!normalizedProcedureId) {
        continue;
      }

      for (const docId of relation.doc_ids || []) {
        const existing = relatedProcedureIdsByDocId.get(docId) || [];
        if (!existing.includes(normalizedProcedureId)) {
          existing.push(normalizedProcedureId);
          relatedProcedureIdsByDocId.set(docId, existing);
        }
      }
    }

    const resolvedProcedureId = requestedProcedureId
      ? await resolveProcedureId(requestedProcedureId)
      : null;

    const items = state.docs
      .filter((doc) => {
        if (!requestedProcedureId) {
          return true;
        }

        if (!resolvedProcedureId) {
          return false;
        }

        return (relatedProcedureIdsByDocId.get(doc.id) || []).includes(resolvedProcedureId.toLowerCase());
      })
      .map((doc) => ({
        ...mapStoredDocAssetToDocRef(doc),
        relatedProcedureIds: relatedProcedureIdsByDocId.get(doc.id) || [],
      }));

    return {
      items: items.slice(0, limit),
      total: items.length,
    };
  });

  fastify.post('/api/files/upload', async (request, reply) => {
    const parsed = parseUploadPayload((request.body || {}) as UploadBody);
    if (!parsed.ok) {
      return reply.code(parsed.statusCode).send({ ok: false, error: parsed.error });
    }

    const ext = normalizeExtension(parsed.mimeType);
    const filename = `${Date.now()}-${randomBytes(12).toString('hex')}${ext}`;
    const absolutePath = path.join(uploadRoot, filename);

    await fs.writeFile(absolutePath, parsed.buffer, { flag: 'wx' });

    return reply
      .headers({
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      })
      .send({
        ok: true,
        url: `/runtime/uploads/${filename}`,
        filename,
        mimeType: parsed.mimeType,
        size: parsed.buffer.length,
        file: {
          url: `/runtime/uploads/${filename}`,
          filename,
          mimeType: parsed.mimeType,
          size: parsed.buffer.length,
        },
      });
  });

  fastify.get('/runtime/uploads/:filename', async (request, reply) => {
    const params = request.params as { filename?: string };
    const filename = String(params.filename || '');

    if (!/^[0-9]+-[a-f0-9]{24}\.(jpg|png|webp)$/.test(filename)) {
      return reply.code(404).send({ ok: false, error: 'NOT_FOUND' });
    }

    const absolutePath = path.join(uploadRoot, filename);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    try {
      const buffer = await fs.readFile(absolutePath);
      return reply
        .type(mimeType)
        .headers({
          'Cache-Control': 'private, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
        })
        .send(buffer);
    } catch {
      return reply.code(404).send({ ok: false, error: 'NOT_FOUND' });
    }
  });
}

export const fileRoutes = filesRoutes;
export default filesRoutes;