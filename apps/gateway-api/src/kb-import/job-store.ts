import { randomUUID } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { ensureKbImportStorage } from "./storage";
import { extractTextFromAsset } from "./extractors";
import { buildKbDraft } from "./kb-builder";
import type { CreateRawImportInput, KbImportAsset, KbImportJob } from "./types";

async function readJobs(path: string): Promise<KbImportJob[]> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJobs(path: string, jobs: KbImportJob[]): Promise<void> {
  await writeFile(path, JSON.stringify(jobs, null, 2), "utf8");
}

function audit(job: KbImportJob, event: string, detail?: string): KbImportJob {
  return { ...job, updatedAt: new Date().toISOString(), audit: [...(job.audit || []), { at: new Date().toISOString(), event, detail }] };
}

export async function listKbImportJobs(): Promise<KbImportJob[]> {
  const paths = await ensureKbImportStorage();
  return readJobs(paths.jobsPath);
}

export async function getKbImportJob(jobId: string): Promise<KbImportJob | undefined> {
  const jobs = await listKbImportJobs();
  return jobs.find((job) => job.id === jobId);
}

async function saveJob(job: KbImportJob): Promise<KbImportJob> {
  const paths = await ensureKbImportStorage();
  const jobs = await readJobs(paths.jobsPath);
  const index = jobs.findIndex((item) => item.id === job.id);
  if (index >= 0) jobs[index] = job;
  else jobs.unshift(job);
  await writeJobs(paths.jobsPath, jobs.slice(0, 1000));
  await appendFile(paths.auditJsonl, JSON.stringify({ at: new Date().toISOString(), jobId: job.id, status: job.status }) + "\n", "utf8");
  return job;
}

export async function createRawKbImportJob(input: CreateRawImportInput): Promise<KbImportJob> {
  const now = new Date().toISOString();
  const job: KbImportJob = {
    id: randomUUID(),
    sourceName: input.sourceName || "Manual KB import",
    sourceType: input.sourceType || "manual",
    sourceUrl: input.sourceUrl,
    categoryHint: input.categoryHint,
    detectedCategory: "unknown_needs_review",
    languageHint: input.languageHint,
    detectedLanguage: input.languageHint || "unknown",
    status: "UPLOADED",
    reviewStatus: "pending",
    publishStatus: "not_published",
    confidence: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    rawText: input.rawText,
    citations: [],
    facts: [],
    chunks: [],
    audit: [{ at: now, event: "raw-import-created" }],
  };
  return saveJob(job);
}

export async function createUploadedKbImportJob(input: {
  sourceName: string;
  categoryHint?: string;
  languageHint?: string;
  createdBy?: string;
  sourceUrl?: string;
  asset: KbImportAsset;
}): Promise<KbImportJob> {
  const now = new Date().toISOString();
  const job: KbImportJob = {
    id: randomUUID(),
    sourceName: input.sourceName || input.asset.originalName,
    sourceType: "unknown",
    sourceUrl: input.sourceUrl,
    categoryHint: input.categoryHint,
    detectedCategory: "unknown_needs_review",
    languageHint: input.languageHint,
    detectedLanguage: input.languageHint || "unknown",
    status: "QUARANTINED",
    reviewStatus: "pending",
    publishStatus: "not_published",
    confidence: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    asset: input.asset,
    citations: [],
    facts: [],
    chunks: [],
    audit: [{ at: now, event: "upload-job-created", detail: input.asset.sha256 }],
  };
  return saveJob(job);
}

export async function processKbImportJob(jobId: string): Promise<KbImportJob> {
  const existing = await getKbImportJob(jobId);
  if (!existing) throw new Error(`KB import job not found: ${jobId}`);
  let job = audit({ ...existing, status: "EXTRACTION_RUNNING" }, "process-started");
  await saveJob(job);
  try {
    let text = job.rawText || "";
    let method = "raw-text";
    let extractionConfidence = text.trim() ? 0.95 : 0.1;
    if (!text.trim() && job.asset) {
      const result = await extractTextFromAsset(job.asset);
      text = result.text;
      method = result.method;
      extractionConfidence = result.confidence;
    }
    if (!text.trim()) throw new Error("No extractable text was found.");
    const draft = buildKbDraft({
      jobId: job.id,
      sourceLabel: job.sourceName,
      sourceUrl: job.sourceUrl,
      assetId: job.asset?.id,
      text,
      categoryHint: job.categoryHint,
      languageHint: job.languageHint,
      extractionConfidence,
    });
    job = audit({
      ...job,
      rawText: text,
      cleanedText: draft.cleanedText,
      detectedCategory: draft.detectedCategory,
      detectedLanguage: draft.detectedLanguage,
      confidence: draft.confidence,
      citations: draft.citations,
      facts: draft.facts,
      chunks: draft.chunks,
      status: "NEEDS_ADMIN_REVIEW",
      errorCode: undefined,
      errorMessage: undefined,
    }, "kb-draft-created", method);
    return saveJob(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job = audit({ ...job, status: "EXTRACTION_FAILED", errorCode: "EXTRACTION_FAILED", errorMessage: message }, "process-failed", message);
    return saveJob(job);
  }
}

export async function approveKbImportJob(jobId: string): Promise<KbImportJob> {
  const existing = await getKbImportJob(jobId);
  if (!existing) throw new Error(`KB import job not found: ${jobId}`);
  return saveJob(audit({ ...existing, status: "APPROVED", reviewStatus: "approved" }, "approved"));
}

export async function rejectKbImportJob(jobId: string, reason?: string): Promise<KbImportJob> {
  const existing = await getKbImportJob(jobId);
  if (!existing) throw new Error(`KB import job not found: ${jobId}`);
  return saveJob(audit({ ...existing, status: "REJECTED", reviewStatus: "rejected", errorMessage: reason }, "rejected", reason));
}

export async function publishKbImportJob(jobId: string): Promise<KbImportJob> {
  const existing = await getKbImportJob(jobId);
  if (!existing) throw new Error(`KB import job not found: ${jobId}`);
  if (existing.reviewStatus !== "approved") throw new Error("KB import job must be approved before publish.");
  const paths = await ensureKbImportStorage();
  const payload = {
    at: new Date().toISOString(),
    jobId: existing.id,
    sourceName: existing.sourceName,
    category: existing.detectedCategory,
    citations: existing.citations,
    facts: existing.facts,
    chunks: existing.chunks,
  };
  await appendFile(paths.publishedJsonl, JSON.stringify(payload) + "\n", "utf8");
  return saveJob(audit({ ...existing, status: "PUBLISHED", publishStatus: "published" }, "published", paths.publishedJsonl));
}