import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyPluginAsync } from "fastify";
import { buildAssetFromStoredFile, sanitizeOriginalName } from "../kb-import/file-security";
import { ensureKbImportStorage } from "../kb-import/storage";
import {
  approveKbImportJob,
  createRawKbImportJob,
  createUploadedKbImportJob,
  getKbImportJob,
  listKbImportJobs,
  processKbImportJob,
  publishKbImportJob,
  rejectKbImportJob,
} from "../kb-import/job-store";
import type { CreateRawImportInput } from "../kb-import/types";

type RawImportBody = Partial<CreateRawImportInput> & { processNow?: boolean };

export const registerKbImportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/admin/kb-import/health", async () => {
    const storage = await ensureKbImportStorage();
    return { ok: true, feature: "kb-import-build", storageRoot: storage.root };
  });

  app.get("/api/admin/kb-import/jobs", async () => {
    const jobs = await listKbImportJobs();
    return { ok: true, jobs };
  });

  app.get<{ Params: { jobId: string } }>("/api/admin/kb-import/jobs/:jobId", async (request, reply) => {
    const job = await getKbImportJob(request.params.jobId);
    if (!job) return reply.code(404).send({ ok: false, error: "KB_IMPORT_JOB_NOT_FOUND" });
    return { ok: true, job };
  });

  app.post("/api/admin/kb-import/raw", async (request, reply) => {
    const body = (request.body || {}) as RawImportBody;
    if (!body.rawText || !String(body.rawText).trim()) {
      return reply.code(400).send({ ok: false, error: "RAW_TEXT_REQUIRED" });
    }
    const job = await createRawKbImportJob({
      sourceName: body.sourceName || "Manual KB import",
      rawText: String(body.rawText),
      sourceType: body.sourceType || "manual",
      sourceUrl: body.sourceUrl,
      categoryHint: body.categoryHint,
      languageHint: body.languageHint,
      createdBy: body.createdBy,
    });
    const processed = body.processNow === false ? job : await processKbImportJob(job.id);
    return { ok: true, job: processed };
  });

  app.post("/api/admin/kb-import/upload", async (request, reply) => {
    const anyRequest = request as any;
    if (typeof anyRequest.parts !== "function") {
      return reply.code(501).send({
        ok: false,
        error: "MULTIPART_NOT_REGISTERED",
        detail: "Register @fastify/multipart in the gateway before enabling /api/admin/kb-import/upload.",
      });
    }
    const storage = await ensureKbImportStorage();
    await mkdir(storage.quarantineDir, { recursive: true });
    const fields: Record<string, string> = {};
    let assetPath = "";
    let originalName = "";
    let mimeType = "";
    for await (const part of anyRequest.parts()) {
      if (part.type === "file") {
        originalName = sanitizeOriginalName(part.filename || "source.bin");
        mimeType = part.mimetype || "application/octet-stream";
        const storedName = `${Date.now()}-${originalName}`;
        assetPath = path.join(storage.quarantineDir, storedName);
        await pipeline(part.file, createWriteStream(assetPath));
      } else if (part.fieldname) {
        fields[part.fieldname] = String(part.value || "");
      }
    }
    if (!assetPath) return reply.code(400).send({ ok: false, error: "UPLOAD_FILE_REQUIRED" });
    const asset = await buildAssetFromStoredFile({ originalName, storedPath: assetPath, mimeType });
    const job = await createUploadedKbImportJob({
      sourceName: fields.sourceName || originalName,
      categoryHint: fields.categoryHint,
      languageHint: fields.languageHint,
      sourceUrl: fields.sourceUrl,
      createdBy: fields.createdBy,
      asset,
    });
    const processed = fields.processNow === "false" ? job : await processKbImportJob(job.id);
    return { ok: true, job: processed };
  });

  app.post<{ Params: { jobId: string } }>("/api/admin/kb-import/jobs/:jobId/process", async (request) => {
    const job = await processKbImportJob(request.params.jobId);
    return { ok: true, job };
  });

  app.post<{ Params: { jobId: string } }>("/api/admin/kb-import/jobs/:jobId/approve", async (request) => {
    const job = await approveKbImportJob(request.params.jobId);
    return { ok: true, job };
  });

  app.post<{ Params: { jobId: string }; Body: { reason?: string } }>("/api/admin/kb-import/jobs/:jobId/reject", async (request) => {
    const job = await rejectKbImportJob(request.params.jobId, request.body?.reason);
    return { ok: true, job };
  });

  app.post<{ Params: { jobId: string } }>("/api/admin/kb-import/jobs/:jobId/publish", async (request) => {
    const job = await publishKbImportJob(request.params.jobId);
    return { ok: true, job };
  });
};

export default registerKbImportRoutes;