import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import type { PoolClient } from "pg";
import { getClient, query } from "../lib/db.js";
import { appendAdminAuditEventInTransaction, createAdminAuditEvent } from "../admin-authority/adminAuthorityAudit.js";
import { createAdminAuthorityId, createAdminEntityVersionRowInTransaction, ensureAdminAuthorityTables } from "../admin-authority/adminAuthorityStore.js";
import { listAdminEntityVersions } from "../admin-authority/adminAuthorityVersioning.js";
import type {
  UniversalJobAddressInput,
  UniversalJobApplication,
  UniversalJobApplicationHistoryEntry,
  UniversalJobApplicationInput,
  UniversalJobApplicationStatus,
  UniversalJobFieldDefinition,
  UniversalJobFollowUpStatus,
  UniversalJobManagerContext,
  UniversalJobPublishedTemplate,
  UniversalJobSubmissionContext,
  UniversalJobSubmissionResult,
  UniversalJobTemplate,
  UniversalJobTemplateStatus,
} from "./universal-job-applications.types.js";

const APPLICATION_ENTITY_TYPE = "jobs.universal.application";
const clean = (value: unknown): string => String(value ?? "").trim();
const APPLICATION_STATUSES = new Set<UniversalJobApplicationStatus>(["pending", "reviewing", "shortlisted", "approved", "rejected", "hired", "withdrawn"]);
const FOLLOW_UP_STATUSES = new Set<UniversalJobFollowUpStatus>(["not_contacted", "to_contact", "contacted", "interview_scheduled", "interview_completed", "waiting_documents", "follow_up_required", "closed", "no_response", "withdrawn"]);

function isStrictIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function isValidBirthDate(value: string): boolean {
  if (!isStrictIsoDate(value)) return false;
  const today = new Date().toISOString().slice(0, 10);
  const minimum = `${new Date().getUTCFullYear() - 130}-01-01`;
  return value >= minimum && value <= today;
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableHash(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, normalize(child)]));
    }
    return item;
  };
  return hashSecret(JSON.stringify(normalize(value)));
}

function newTrackingToken(): string {
  return randomBytes(32).toString("base64url");
}

function toIso(value: unknown): string {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function mapTemplate(row: Record<string, any>): UniversalJobTemplate {
  return {
    id: clean(row.id),
    slug: clean(row.slug),
    employerId: clean(row.employer_id) || undefined,
    employerName: clean(row.employer_name),
    ownerUserId: clean(row.owner_user_id) || undefined,
    jobId: clean(row.job_id) || undefined,
    name: clean(row.name),
    titleAr: clean(row.title_ar),
    introAr: clean(row.intro_ar),
    employmentType: clean(row.employment_type) || "FULL_TIME",
    status: clean(row.status).toLowerCase() as UniversalJobTemplateStatus,
    allowProfileAutofill: Boolean(row.allow_profile_autofill),
    allowPreviousAutofill: Boolean(row.allow_previous_autofill),
    allowBlankStart: Boolean(row.allow_blank_start),
    currentVersion: Number(row.current_version || 0),
    draftFields: parseJson<UniversalJobFieldDefinition[]>(row.draft_fields_json, []),
    draftSettings: parseJson<Record<string, unknown>>(row.draft_settings_json, {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapApplication(row: Record<string, any>): UniversalJobApplication {
  return {
    id: clean(row.id),
    reference: clean(row.reference),
    templateId: clean(row.template_id),
    templateVersion: Number(row.template_version || 1),
    jobId: clean(row.job_id) || undefined,
    employerId: clean(row.employer_id) || undefined,
    applicantUserId: clean(row.applicant_user_id) || undefined,
    prefillSource: clean(row.prefill_source) || "blank",
    prefillSourceApplicationId: clean(row.prefill_source_application_id) || undefined,
    applicantName: clean(row.applicant_name),
    phone: clean(row.phone),
    ageYears: row.age_years == null ? undefined : Number(row.age_years),
    address: clean(row.address) || undefined,
    mohafaza: clean(row.mohafaza) || undefined,
    mohafazaId: clean(row.mohafaza_id) || undefined,
    caza: clean(row.caza) || undefined,
    cazaId: clean(row.caza_id) || undefined,
    village: clean(row.village) || undefined,
    villageId: clean(row.village_id) || undefined,
    villagePcode: clean(row.village_pcode) || undefined,
    locationDatasetVersion: clean(row.location_dataset_version) || undefined,
    locationApprovalStatus: clean(row.location_approval_status) || undefined,
    answers: parseJson<Record<string, unknown>>(row.answers_json, {}),
    status: clean(row.status).toLowerCase() as UniversalJobApplicationStatus,
    followUpStatus: clean(row.follow_up_status).toLowerCase() as UniversalJobFollowUpStatus,
    adminNotes: clean(row.admin_notes),
    version: Number(row.version || 1),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function isAdmin(role: string): boolean {
  const normalized = clean(role).toLowerCase();
  return normalized === "admin" || normalized === "superadmin";
}

export function canManageUniversalJobTemplate(template: UniversalJobTemplate, manager: UniversalJobManagerContext): boolean {
  if (isAdmin(manager.role)) return true;
  return clean(manager.role).toLowerCase() === "accredited" && Boolean(template.ownerUserId) && template.ownerUserId === manager.userId;
}

function fieldVisible(field: UniversalJobFieldDefinition, answers: Record<string, unknown>): boolean {
  if (!field.condition) return true;
  const current = answers[field.condition.field];
  if (Object.prototype.hasOwnProperty.call(field.condition, "equals")) return current === field.condition.equals;
  if (field.condition.includes !== undefined) return Array.isArray(current) && current.map(String).includes(field.condition.includes);
  return true;
}

function missingValue(value: unknown): boolean {
  if (value === false || value === 0) return false;
  if (Array.isArray(value)) return value.length === 0;
  return value == null || clean(value) === "";
}

function normalizeAnswers(fields: UniversalJobFieldDefinition[], raw: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(fields.filter((field) => field.type !== "universal_locator").map((field) => field.key));
  const answers: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw || {})) if (allowed.has(key)) answers[key] = value;

  for (const field of fields) {
    if (field.type === "universal_locator" || !fieldVisible(field, answers)) continue;
    const value = answers[field.key];
    if (field.required && missingValue(value)) throw new Error(`MISSING_REQUIRED_FIELD:${field.key}`);
    if (missingValue(value)) continue;
    if (field.type === "integer") {
      const number = Number(value);
      if (!Number.isInteger(number) || (field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) throw new Error(`INVALID_INTEGER:${field.key}`);
      answers[field.key] = number;
    }
    if (field.type === "phone" && !/^\+?[0-9]{7,15}$/.test(clean(value).replace(/[\s().-]/g, ""))) throw new Error(`INVALID_PHONE:${field.key}`);
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value))) throw new Error(`INVALID_EMAIL:${field.key}`);
    if (field.type === "date") {
      const dateValue = clean(value);
      if (!isStrictIsoDate(dateValue) || (field.key === "birth_date" && !isValidBirthDate(dateValue))) throw new Error(`INVALID_DATE:${field.key}`);
      answers[field.key] = dateValue;
    }
    if (field.type === "yes_no" && value !== true && value !== false) throw new Error(`INVALID_BOOLEAN:${field.key}`);
    if (field.type === "select" && field.options?.length && !field.options.includes(clean(value))) throw new Error(`INVALID_OPTION:${field.key}`);
    if (field.type === "multi_select") {
      if (!Array.isArray(value)) throw new Error(`INVALID_MULTI_SELECT:${field.key}`);
      const choices = value.map(String);
      if (field.options?.length && choices.some((choice) => !field.options?.includes(choice))) throw new Error(`INVALID_OPTION:${field.key}`);
      answers[field.key] = choices;
    }
  }
  return answers;
}

type CanonicalLocationRuntime = {
  datasetVersion: string;
  approvalStatus: string;
  governorates: Array<{ id: string; nameAr: string }>;
  districts: Array<{ id: string; governorateId: string; nameAr: string }>;
  districtEquivalents: Array<{ id: string; governorateId: string; nameAr: string }>;
  localities: Array<{ id: string; governorateId: string; districtId: string; pcode?: string | null; nameAr: string }>;
};

let canonicalLocationRuntimePromise: Promise<CanonicalLocationRuntime> | undefined;
async function loadCanonicalLocationRuntime(): Promise<CanonicalLocationRuntime> {
  if (!canonicalLocationRuntimePromise) {
    const candidates = [
      resolvePath(process.cwd(), "../web-user/public/data/location/canonical/runtime.json"),
      resolvePath(process.cwd(), "apps/web-user/public/data/location/canonical/runtime.json"),
    ];
    canonicalLocationRuntimePromise = (async () => {
      let lastError: unknown;
      for (const candidate of candidates) {
        try {
          const text = await readFile(candidate, "utf8");
          const runtime = JSON.parse(text) as CanonicalLocationRuntime;
          if (runtime.approvalStatus !== "approvedCanonical" || !runtime.datasetVersion) throw new Error("LOCATION_DATASET_NOT_APPROVED");
          return runtime;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("LOCATION_DATASET_UNAVAILABLE");
    })().catch((error) => {
      canonicalLocationRuntimePromise = undefined;
      throw error;
    });
  }
  return canonicalLocationRuntimePromise;
}

async function resolveAddress(fields: UniversalJobFieldDefinition[], address: UniversalJobAddressInput | undefined) {
  const locator = fields.find((field) => field.type === "universal_locator");
  if (!locator) return null;
  if (!address && locator.required) throw new Error("MISSING_REQUIRED_FIELD:location");
  if (!address) return null;
  const runtime = await loadCanonicalLocationRuntime();
  const governorate = runtime.governorates.find((item) => item.id === clean(address.mohafaza_id));
  const districtNodes = [...runtime.districts, ...runtime.districtEquivalents];
  const district = districtNodes.find((item) => item.id === clean(address.caza_id) && item.governorateId === governorate?.id);
  const locality = runtime.localities.find((item) => item.id === clean(address.village_id) && item.governorateId === governorate?.id && item.districtId === district?.id);
  if (!governorate || !district || !locality) throw new Error("INVALID_LOCATION");
  if (clean(address.mohafaza) && clean(address.mohafaza) !== governorate.nameAr) throw new Error("INVALID_LOCATION");
  if (clean(address.caza) && clean(address.caza) !== district.nameAr) throw new Error("INVALID_LOCATION");
  if (clean(address.village) && clean(address.village) !== locality.nameAr) throw new Error("INVALID_LOCATION");
  if (clean(address.location_dataset_version) && clean(address.location_dataset_version) !== runtime.datasetVersion) throw new Error("INVALID_LOCATION_DATASET_VERSION");
  if (clean(address.location_approval_status) && clean(address.location_approval_status) !== runtime.approvalStatus) throw new Error("INVALID_LOCATION_APPROVAL_STATUS");
  return {
    address: clean(address.address) || undefined,
    mohafaza: governorate.nameAr,
    mohafaza_id: governorate.id,
    caza: district.nameAr,
    caza_id: district.id,
    village: locality.nameAr,
    village_id: locality.id,
    village_pcode: locality.pcode || undefined,
    location_dataset_version: runtime.datasetVersion,
    location_approval_status: runtime.approvalStatus,
  };
}

export async function getUniversalJobTemplateBySlug(slug: string, includeUnpublished = false): Promise<UniversalJobPublishedTemplate | null> {
  const templateResult = await query("SELECT * FROM job_application_templates WHERE slug=$1 LIMIT 1", [slug]);
  if (!templateResult.rows[0]) return null;
  const template = mapTemplate(templateResult.rows[0]);
  if (!includeUnpublished && template.status !== "published") return null;
  const versionResult = await query(
    "SELECT fields_json,settings_json FROM job_application_template_versions WHERE template_id=$1 AND version=$2 LIMIT 1",
    [template.id, template.currentVersion],
  );
  if (!versionResult.rows[0]) return null;
  return {
    ...template,
    fields: parseJson<UniversalJobFieldDefinition[]>(versionResult.rows[0].fields_json, []),
    settings: parseJson<Record<string, unknown>>(versionResult.rows[0].settings_json, {}),
  };
}

export async function getUniversalJobTemplateById(id: string): Promise<UniversalJobTemplate | null> {
  const result = await query("SELECT * FROM job_application_templates WHERE id=$1 LIMIT 1", [id]);
  return result.rows[0] ? mapTemplate(result.rows[0]) : null;
}

export async function listUniversalJobTemplates(manager: UniversalJobManagerContext): Promise<UniversalJobTemplate[]> {
  const result = isAdmin(manager.role)
    ? await query("SELECT * FROM job_application_templates ORDER BY updated_at DESC,id DESC")
    : await query("SELECT * FROM job_application_templates WHERE owner_user_id=$1 ORDER BY updated_at DESC,id DESC", [manager.userId]);
  return result.rows.map(mapTemplate);
}

function validateFields(fields: unknown): UniversalJobFieldDefinition[] {
  if (!Array.isArray(fields)) throw new Error("INVALID_FIELDS");
  const seen = new Set<string>();
  return fields.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("INVALID_FIELDS");
    const field = raw as UniversalJobFieldDefinition;
    const key = clean(field.key);
    if (!/^[a-z][a-z0-9_]*$/i.test(key) || seen.has(key) || !clean(field.labelAr) || !clean(field.type)) throw new Error("INVALID_FIELDS");
    seen.add(key);
    return { ...field, key, labelAr: clean(field.labelAr) };
  });
}

export async function createUniversalJobTemplate(input: Record<string, unknown>, manager: UniversalJobManagerContext): Promise<UniversalJobTemplate> {
  const slug = clean(input.slug).toLowerCase();
  const name = clean(input.name);
  const titleAr = clean(input.titleAr);
  const employerName = clean(input.employerName);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !name || !titleAr || !employerName) throw new Error("INVALID_TEMPLATE");
  const fields = validateFields(input.fields ?? []);
  const ownerUserId = isAdmin(manager.role) ? (clean(input.ownerUserId) || null) : manager.userId;
  if (!isAdmin(manager.role) && clean(manager.role).toLowerCase() !== "accredited") throw new Error("FORBIDDEN");
  const id = `uat-${randomUUID()}`;
  const result = await query(
    `INSERT INTO job_application_templates
      (id,slug,employer_id,employer_name,owner_user_id,job_id,name,title_ar,intro_ar,employment_type,status,allow_profile_autofill,allow_previous_autofill,allow_blank_start,current_version,draft_fields_json,draft_settings_json,created_by,updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12,$13,0,$14::jsonb,$15::jsonb,$16,$16)
     RETURNING *`,
    [id, slug, clean(input.employerId) || null, employerName, ownerUserId, clean(input.jobId) || null, name, titleAr, clean(input.introAr), clean(input.employmentType) || "FULL_TIME", input.allowProfileAutofill !== false, input.allowPreviousAutofill !== false, input.allowBlankStart !== false, JSON.stringify(fields), JSON.stringify((input.settings && typeof input.settings === "object") ? input.settings : {}), manager.userId],
  );
  return mapTemplate(result.rows[0]);
}

export async function updateUniversalJobTemplate(id: string, input: Record<string, unknown>, manager: UniversalJobManagerContext): Promise<UniversalJobTemplate | null> {
  const existing = await getUniversalJobTemplateById(id);
  if (!existing) return null;
  if (!canManageUniversalJobTemplate(existing, manager)) throw new Error("FORBIDDEN");
  const fields = input.fields === undefined ? existing.draftFields : validateFields(input.fields);
  const settings = input.settings === undefined ? existing.draftSettings : ((input.settings && typeof input.settings === "object") ? input.settings : {});
  const result = await query(
    `UPDATE job_application_templates SET
      employer_id=$2,employer_name=$3,job_id=$4,name=$5,title_ar=$6,intro_ar=$7,employment_type=$8,
      allow_profile_autofill=$9,allow_previous_autofill=$10,allow_blank_start=$11,draft_fields_json=$12::jsonb,draft_settings_json=$13::jsonb,updated_by=$14,updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id, input.employerId === undefined ? (existing.employerId || null) : clean(input.employerId) || null, input.employerName === undefined ? existing.employerName : clean(input.employerName), input.jobId === undefined ? (existing.jobId || null) : clean(input.jobId) || null, input.name === undefined ? existing.name : clean(input.name), input.titleAr === undefined ? existing.titleAr : clean(input.titleAr), input.introAr === undefined ? existing.introAr : clean(input.introAr), input.employmentType === undefined ? existing.employmentType : clean(input.employmentType), input.allowProfileAutofill === undefined ? existing.allowProfileAutofill : Boolean(input.allowProfileAutofill), input.allowPreviousAutofill === undefined ? existing.allowPreviousAutofill : Boolean(input.allowPreviousAutofill), input.allowBlankStart === undefined ? existing.allowBlankStart : Boolean(input.allowBlankStart), JSON.stringify(fields), JSON.stringify(settings), manager.userId],
  );
  return result.rows[0] ? mapTemplate(result.rows[0]) : null;
}

export async function publishUniversalJobTemplate(id: string, manager: UniversalJobManagerContext): Promise<UniversalJobTemplate | null> {
  const existing = await getUniversalJobTemplateById(id);
  if (!existing) return null;
  if (!canManageUniversalJobTemplate(existing, manager)) throw new Error("FORBIDDEN");
  if (!existing.draftFields.length) throw new Error("INVALID_FIELDS");
  const nextVersion = existing.currentVersion + 1;
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO job_application_template_versions (id,template_id,version,fields_json,settings_json,published_by)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6)`,
      [`uatv-${randomUUID()}`, id, nextVersion, JSON.stringify(existing.draftFields), JSON.stringify(existing.draftSettings), manager.userId],
    );
    const updated = await client.query(
      "UPDATE job_application_templates SET current_version=$2,status='published',updated_by=$3,updated_at=NOW() WHERE id=$1 RETURNING *",
      [id, nextVersion, manager.userId],
    );
    await client.query("COMMIT");
    return mapTemplate(updated.rows[0]);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve primary */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function cloneUniversalJobTemplate(id: string, input: Record<string, unknown>, manager: UniversalJobManagerContext): Promise<UniversalJobTemplate> {
  const source = await getUniversalJobTemplateById(id);
  if (!source) throw new Error("NOT_FOUND");
  if (!canManageUniversalJobTemplate(source, manager) && !isAdmin(manager.role)) throw new Error("FORBIDDEN");
  return createUniversalJobTemplate({
    slug: input.slug,
    employerId: input.employerId ?? source.employerId,
    employerName: input.employerName ?? source.employerName,
    ownerUserId: input.ownerUserId,
    jobId: input.jobId,
    name: input.name ?? `${source.name} - نسخة`,
    titleAr: input.titleAr ?? source.titleAr,
    introAr: input.introAr ?? source.introAr,
    employmentType: source.employmentType,
    allowProfileAutofill: source.allowProfileAutofill,
    allowPreviousAutofill: source.allowPreviousAutofill,
    allowBlankStart: source.allowBlankStart,
    fields: source.draftFields,
    settings: source.draftSettings,
  }, manager);
}

export async function createUniversalJobApplication(slug: string, input: UniversalJobApplicationInput, context: UniversalJobSubmissionContext = {}): Promise<UniversalJobSubmissionResult> {
  const template = await getUniversalJobTemplateBySlug(slug);
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");
  const answers = normalizeAnswers(template.fields, input.answers || {});
  const resolvedAddress = await resolveAddress(template.fields, input.address);
  const userId = clean(context.userId) || null;
  const trackingToken = userId ? undefined : (clean(context.trackingToken) || newTrackingToken());
  const trackingTokenHash = trackingToken ? hashSecret(trackingToken) : null;
  const scope = hashSecret(userId ? `user:${userId}:template:${template.id}` : `anonymous:${trackingTokenHash}:template:${template.id}`);
  const idempotencyKey = clean(context.idempotencyKey) || randomUUID();
  const idempotencyKeyHash = hashSecret(idempotencyKey);
  const normalizedPayloadHash = stableHash({ answers, address: resolvedAddress, prefillSource: input.prefillSource || "blank", prefillSourceApplicationId: input.prefillSourceApplicationId || null });
  const id = `JOBAPP-${randomUUID()}`;
  const reference = `JOB-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const applicantName = clean(answers.full_name);
  const phone = clean(answers.phone).replace(/[\s().-]/g, "");
  if (!applicantName || !phone) throw new Error("MISSING_REQUIRED_FIELD:identity");
  const ageYears = answers.age_years == null ? null : Number(answers.age_years);

  const inserted = await query(
    `INSERT INTO job_application_submissions
      (id,reference,template_id,template_version,job_id,employer_id,applicant_user_id,anonymous_tracking_token_hash,prefill_source,prefill_source_application_id,
       applicant_name,phone,age_years,address,mohafaza,mohafaza_id,caza,caza_id,village,village_id,village_pcode,location_dataset_version,location_approval_status,
       answers_json,idempotency_scope,idempotency_key_hash,idempotency_payload_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26,$27)
     ON CONFLICT (idempotency_scope,idempotency_key_hash)
       WHERE idempotency_scope IS NOT NULL AND idempotency_key_hash IS NOT NULL
       DO NOTHING
     RETURNING *`,
    [id, reference, template.id, template.currentVersion, template.jobId || null, template.employerId || null, userId, trackingTokenHash, input.prefillSource || "blank", clean(input.prefillSourceApplicationId) || null, applicantName, phone, ageYears, resolvedAddress?.address || null, resolvedAddress?.mohafaza || null, resolvedAddress?.mohafaza_id || null, resolvedAddress?.caza || null, resolvedAddress?.caza_id || null, resolvedAddress?.village || null, resolvedAddress?.village_id || null, resolvedAddress?.village_pcode || null, resolvedAddress?.location_dataset_version || null, resolvedAddress?.location_approval_status || null, JSON.stringify(answers), scope, idempotencyKeyHash, normalizedPayloadHash],
  );
  if (inserted.rows[0]) return { item: mapApplication(inserted.rows[0]), trackingToken, idempotent: false };

  const existing = await query("SELECT * FROM job_application_submissions WHERE idempotency_scope=$1 AND idempotency_key_hash=$2 LIMIT 1", [scope, idempotencyKeyHash]);
  if (!existing.rows[0]) throw new Error("IDEMPOTENCY_CONFLICT");
  if (clean(existing.rows[0].idempotency_payload_hash) !== normalizedPayloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
  return { item: mapApplication(existing.rows[0]), trackingToken, idempotent: true };
}

export async function listUniversalJobApplicationsForOwner(input: { userId?: string; trackingToken?: string }) {
  const userId = clean(input.userId);
  const trackingToken = clean(input.trackingToken);
  if (!userId && !trackingToken) return [];
  const baseSql = `SELECT s.*,t.title_ar,t.employer_name,t.slug FROM job_application_submissions s JOIN job_application_templates t ON t.id=s.template_id`;
  const result = userId
    ? await query(`${baseSql} WHERE s.applicant_user_id=$1 ORDER BY s.created_at DESC,s.id DESC`, [userId])
    : await query(`${baseSql} WHERE s.anonymous_tracking_token_hash=$1 ORDER BY s.created_at DESC,s.id DESC`, [hashSecret(trackingToken)]);
  return result.rows.map((row) => ({ ...mapApplication(row), templateTitle: clean(row.title_ar), employerName: clean(row.employer_name), templateSlug: clean(row.slug) }));
}

export async function getUniversalJobProfileAutofill(slug: string, userId: string): Promise<Record<string, unknown>> {
  const template = await getUniversalJobTemplateBySlug(slug);
  if (!template || !template.allowProfileAutofill) throw new Error("AUTOFILL_UNAVAILABLE");
  const user = await query("SELECT name,phone,email FROM users WHERE id=$1 LIMIT 1", [userId]);
  if (!user.rows[0]) throw new Error("USER_NOT_FOUND");
  const candidate: Record<string, unknown> = { full_name: user.rows[0].name, phone: user.rows[0].phone, email: user.rows[0].email };
  const allowed = new Set(template.fields.filter((field) => field.reusableFromProfile).map((field) => field.key));
  return Object.fromEntries(Object.entries(candidate).filter(([key, value]) => allowed.has(key) && !missingValue(value)));
}

function reusableValues(fields: UniversalJobFieldDefinition[], values: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(fields.filter((field) => field.reusableFromPrevious).map((field) => field.key));
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => allowed.has(key) && !missingValue(value)));
}

export async function listUniversalJobPreviousAutofill(slug: string, userId: string) {
  const template = await getUniversalJobTemplateBySlug(slug);
  if (!template || !template.allowPreviousAutofill) throw new Error("AUTOFILL_UNAVAILABLE");
  const universal = await query(
    `SELECT s.*,t.title_ar,t.employer_name FROM job_application_submissions s
     JOIN job_application_templates t ON t.id=s.template_id
     WHERE s.applicant_user_id=$1 ORDER BY s.created_at DESC LIMIT 30`,
    [userId],
  );
  const items = universal.rows.map((row) => ({
    id: clean(row.id),
    source: "universal",
    title: clean(row.title_ar),
    employer: clean(row.employer_name),
    submittedAt: toIso(row.created_at),
    values: reusableValues(template.fields, parseJson<Record<string, unknown>>(row.answers_json, {})),
    address: {
      address: clean(row.address) || undefined,
      mohafaza: clean(row.mohafaza) || undefined,
      mohafaza_id: clean(row.mohafaza_id) || undefined,
      caza: clean(row.caza) || undefined,
      caza_id: clean(row.caza_id) || undefined,
      village: clean(row.village) || undefined,
      village_id: clean(row.village_id) || undefined,
      village_pcode: clean(row.village_pcode) || undefined,
      location_dataset_version: clean(row.location_dataset_version) || undefined,
      location_approval_status: clean(row.location_approval_status) || undefined,
    },
  }));
  return items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function listUniversalJobApplications(filters: { templateId?: string; q?: string; status?: string; followUpStatus?: string; mohafazaId?: string; cazaId?: string; villageId?: string; accredited?: string; minExperience?: string | number; page?: string | number; pageSize?: string | number }, manager: UniversalJobManagerContext) {
  const values: unknown[] = [];
  const where: string[] = [];
  if (!isAdmin(manager.role)) {
    values.push(manager.userId);
    where.push(`t.owner_user_id=$${values.length}`);
  }
  if (filters.templateId) { values.push(filters.templateId); where.push(`s.template_id=$${values.length}`); }
  if (filters.status) {
    if (!APPLICATION_STATUSES.has(filters.status as UniversalJobApplicationStatus)) throw new Error("INVALID_STATUS");
    values.push(filters.status); where.push(`s.status=$${values.length}`);
  }
  if (filters.followUpStatus) {
    if (!FOLLOW_UP_STATUSES.has(filters.followUpStatus as UniversalJobFollowUpStatus)) throw new Error("INVALID_FOLLOW_UP_STATUS");
    values.push(filters.followUpStatus); where.push(`s.follow_up_status=$${values.length}`);
  }
  for (const [value, column] of [[filters.mohafazaId, "s.mohafaza_id"], [filters.cazaId, "s.caza_id"], [filters.villageId, "s.village_id"]] as const) {
    if (value) { values.push(value); where.push(`${column}=$${values.length}`); }
  }
  if (filters.q) { values.push(`%${clean(filters.q)}%`); where.push(`(s.applicant_name ILIKE $${values.length} OR s.phone ILIKE $${values.length} OR s.reference ILIKE $${values.length})`); }
  if (filters.accredited === "true" || filters.accredited === "false") { values.push(filters.accredited === "true"); where.push(`COALESCE((s.answers_json->>'accredited_driver')::boolean,FALSE)=$${values.length}`); }
  if (filters.minExperience !== undefined && clean(filters.minExperience) !== "") { const min = Number(filters.minExperience); if (!Number.isFinite(min) || min < 0) throw new Error("INVALID_EXPERIENCE"); values.push(min); where.push(`COALESCE((s.answers_json->>'years_experience')::int,0)>=$${values.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(Number(filters.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize || 25), 1), 100);
  const count = await query(`SELECT COUNT(*)::int total FROM job_application_submissions s JOIN job_application_templates t ON t.id=s.template_id ${whereSql}`, values);
  const listValues = [...values, pageSize, (page - 1) * pageSize];
  const rows = await query(
    `SELECT s.*,t.title_ar,t.employer_name,t.slug FROM job_application_submissions s JOIN job_application_templates t ON t.id=s.template_id ${whereSql}
     ORDER BY s.created_at DESC,s.id DESC LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues,
  );
  const total = Number(count.rows[0]?.total || 0);
  return { items: rows.rows.map((row) => ({ ...mapApplication(row), templateTitle: clean(row.title_ar), employerName: clean(row.employer_name), templateSlug: clean(row.slug) })), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getUniversalJobApplicationForManager(id: string, manager: UniversalJobManagerContext): Promise<UniversalJobApplication | null> {
  const result = await query(
    `SELECT s.*,t.owner_user_id FROM job_application_submissions s JOIN job_application_templates t ON t.id=s.template_id WHERE s.id=$1 LIMIT 1`,
    [id],
  );
  if (!result.rows[0]) return null;
  if (!isAdmin(manager.role) && clean(result.rows[0].owner_user_id) !== manager.userId) throw new Error("FORBIDDEN");
  return mapApplication(result.rows[0]);
}

function managementSnapshot(item: UniversalJobApplication) {
  return { status: item.status, followUpStatus: item.followUpStatus, adminNotes: item.adminNotes, version: item.version, updatedAt: item.updatedAt };
}

export async function listUniversalJobApplicationHistory(id: string, manager: UniversalJobManagerContext): Promise<UniversalJobApplicationHistoryEntry[]> {
  const item = await getUniversalJobApplicationForManager(id, manager);
  if (!item) return [];
  const versions = await listAdminEntityVersions(APPLICATION_ENTITY_TYPE, id);
  const history: UniversalJobApplicationHistoryEntry[] = versions.map((version) => ({ version: version.version, eventType: "MANAGEMENT_UPDATED", snapshot: version.snapshot as Record<string, unknown>, actorId: version.createdBy, createdAt: version.createdAt }));
  history.push({ version: 0, eventType: "SUBMITTED", snapshot: managementSnapshot({ ...item, status: "pending", followUpStatus: "not_contacted", adminNotes: "", version: 1 }), actorId: "public_submission", createdAt: item.createdAt });
  return history.sort((a, b) => b.version - a.version);
}

export async function updateUniversalJobApplication(id: string, patch: { status?: UniversalJobApplicationStatus; followUpStatus?: UniversalJobFollowUpStatus; adminNotes?: string; expectedVersion?: number }, manager: UniversalJobManagerContext): Promise<UniversalJobApplication | null> {
  const owned = await getUniversalJobApplicationForManager(id, manager);
  if (!owned) return null;
  if (patch.expectedVersion === undefined || !Number.isInteger(patch.expectedVersion) || patch.expectedVersion < 1) throw new Error("INVALID_EXPECTED_VERSION");
  const updates: string[] = [];
  const values: unknown[] = [id];
  if (patch.status !== undefined) { if (!APPLICATION_STATUSES.has(patch.status)) throw new Error("INVALID_STATUS"); values.push(patch.status); updates.push(`status=$${values.length}`); }
  if (patch.followUpStatus !== undefined) { if (!FOLLOW_UP_STATUSES.has(patch.followUpStatus)) throw new Error("INVALID_FOLLOW_UP_STATUS"); values.push(patch.followUpStatus); updates.push(`follow_up_status=$${values.length}`); }
  if (patch.adminNotes !== undefined) { values.push(clean(patch.adminNotes)); updates.push(`admin_notes=$${values.length}`); }
  if (!updates.length) throw new Error("NO_UPDATES");
  const client: PoolClient = await getClient();
  try {
    await ensureAdminAuthorityTables();
    await client.query("BEGIN");
    const current = await client.query("SELECT * FROM job_application_submissions WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rows[0]) { await client.query("ROLLBACK"); return null; }
    const currentItem = mapApplication(current.rows[0]);
    if (currentItem.version !== patch.expectedVersion) throw new Error("APPLICATION_STALE_VERSION");
    const result = await client.query(`UPDATE job_application_submissions SET ${updates.join(",")},version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`, values);
    const item = mapApplication(result.rows[0]);
    const before = managementSnapshot(currentItem);
    const after = managementSnapshot(item);
    await createAdminEntityVersionRowInTransaction(client, { id: createAdminAuthorityId("version"), entityType: APPLICATION_ENTITY_TYPE, entityId: id, snapshot: after, createdBy: manager.userId, reason: "universal_job_application_management_update" });
    await appendAdminAuditEventInTransaction(client, createAdminAuditEvent({ eventType: "jobs.universal.application.updated", actorId: manager.userId, entityType: APPLICATION_ENTITY_TYPE, entityId: id, before, after, reason: `universal_job_application_management_update:${manager.role}` }));
    await client.query("COMMIT");
    return item;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve primary */ }
    throw error;
  } finally { client.release(); }
}
