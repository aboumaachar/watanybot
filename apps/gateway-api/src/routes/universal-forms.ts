import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { getClient, query } from "../lib/db.js";
import {
  ensureCommunityAttachmentStorage,
  storeCommunityAttachmentUpload,
} from "../community/attachment-security.js";

const FORM_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const LEGACY_SUBMISSION_STATUSES = new Set(["SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"]);
const WORKFLOW_STATES = new Set(["SUBMITTED", "ASSIGNED", "IN_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED", "CLOSED", "ARCHIVED"]);
const PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);
const ACCESS_MODES = new Set(["PUBLIC_ANONYMOUS", "PUBLIC_IDENTIFIED", "ACCOUNT_REQUIRED", "VERIFIED_ACCOUNT_REQUIRED"]);
const FIELD_TYPES = new Set([
  "text", "textarea", "number", "integer", "email", "tel", "phone", "date",
  "select", "radio", "checkbox", "yes_no", "multi_select", "universal_locator", "file", "section",
]);
const CONDITION_ACTIONS = new Set(["show", "hide", "require", "disable"]);
const CONDITION_OPERATORS = new Set(["equals", "not_equals", "contains", "gt", "lt", "is_empty", "not_empty"]);
const DEFAULT_FILE_MIME_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword",
];

type FormCondition = {
  sourceKey: string;
  operator: string;
  value?: unknown;
  action: string;
};

type FormField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options: string[];
  condition?: FormCondition;
  pageBreakBefore?: boolean;
  allowedMimeTypes?: string[];
  maxFiles?: number;
  maxFileSizeMb?: number;
};

type FormSettings = {
  accessMode: string;
  notifyApplicantOnSubmit: boolean;
  notifyApplicantOnStatusChange: boolean;
  notifyAdminsOnSubmit: boolean;
  submitLabel?: string;
};

function clean(value: unknown, max = 5000): string {
  return String(value ?? "").trim().slice(0, max);
}

function slugify(value: unknown): string {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
}

function requireAdmin(request: FastifyRequest): { id: string; role: string } {
  const user = (request as any).user ?? {};
  const id = clean(user.id, 64);
  const role = clean(user.role, 32).toLowerCase();
  if (!id) throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
  if (!["admin", "superadmin"].includes(role)) throw Object.assign(new Error("FORBIDDEN"), { statusCode: 403 });
  return { id, role };
}

function normalizeSettings(value: unknown): FormSettings {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const requestedAccess = clean(raw.accessMode, 40);
  const accessMode = ACCESS_MODES.has(requestedAccess) ? requestedAccess : "PUBLIC_ANONYMOUS";
  return {
    accessMode,
    notifyApplicantOnSubmit: raw.notifyApplicantOnSubmit !== false,
    notifyApplicantOnStatusChange: raw.notifyApplicantOnStatusChange !== false,
    notifyAdminsOnSubmit: raw.notifyAdminsOnSubmit !== false,
    submitLabel: clean(raw.submitLabel, 80) || undefined,
  };
}

function normalizeCondition(value: unknown): FormCondition | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const sourceKey = clean(raw.sourceKey, 64).replace(/[^A-Za-z0-9_]/g, "_");
  const operator = clean(raw.operator, 24);
  const action = clean(raw.action, 24);
  if (!sourceKey || !CONDITION_OPERATORS.has(operator) || !CONDITION_ACTIONS.has(action)) return undefined;
  return { sourceKey, operator, action, value: raw.value };
}

function normalizeFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 120).map((raw: any) => {
    const key = clean(raw?.key ?? raw?.fieldKey, 64).replace(/[^A-Za-z0-9_]/g, "_");
    const label = clean(raw?.label ?? raw?.labelAr, 180);
    const type = clean(raw?.type ?? raw?.fieldType, 40);
    if (!key || !label || seen.has(key) || !FIELD_TYPES.has(type)) {
      throw Object.assign(new Error("INVALID_FORM_FIELD"), { statusCode: 400 });
    }
    seen.add(key);
    const allowedMimeTypes = Array.isArray(raw?.allowedMimeTypes)
      ? raw.allowedMimeTypes.map((item: unknown) => clean(item, 120)).filter(Boolean).slice(0, 12)
      : undefined;
    const maxFiles = Math.max(1, Math.min(10, Number(raw?.maxFiles) || 1));
    const maxFileSizeMb = Math.max(1, Math.min(10, Number(raw?.maxFileSizeMb) || 5));
    return {
      key, label, type, required: type === "section" ? false : Boolean(raw?.required),
      placeholder: clean(raw?.placeholder, 220) || undefined,
      helpText: clean(raw?.helpText, 320) || undefined,
      options: Array.isArray(raw?.options) ? raw.options.map((item: unknown) => clean(item, 120)).filter(Boolean).slice(0, 40) : [],
      condition: normalizeCondition(raw?.condition),
      pageBreakBefore: type === "section" ? Boolean(raw?.pageBreakBefore) : undefined,
      allowedMimeTypes: type === "file" ? (allowedMimeTypes?.length ? allowedMimeTypes : DEFAULT_FILE_MIME_TYPES) : undefined,
      maxFiles: type === "file" ? maxFiles : undefined,
      maxFileSizeMb: type === "file" ? maxFileSizeMb : undefined,
    };
  });
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function conditionMatches(condition: FormCondition | undefined, answers: Record<string, unknown>): boolean {
  if (!condition) return false;
  const actual = answers[condition.sourceKey];
  const expected = condition.value;
  if (condition.operator === "equals") return String(actual ?? "") === String(expected ?? "");
  if (condition.operator === "not_equals") return String(actual ?? "") !== String(expected ?? "");
  if (condition.operator === "contains") {
    const target = String(expected ?? "");
    if (Array.isArray(actual)) return actual.map(String).includes(target);
    return String(actual ?? "").includes(target);
  }
  if (condition.operator === "gt") return Number(actual) > Number(expected);
  if (condition.operator === "lt") return Number(actual) < Number(expected);
  if (condition.operator === "is_empty") return isEmptyValue(actual);
  if (condition.operator === "not_empty") return !isEmptyValue(actual);
  return false;
}

function fieldState(field: FormField, answers: Record<string, unknown>) {
  const matched = conditionMatches(field.condition, answers);
  const action = field.condition?.action;
  const visible = action === "show" ? matched : action === "hide" ? !matched : true;
  const disabled = action === "disable" && matched;
  const required = visible && !disabled && (field.required || (action === "require" && matched));
  return { visible, disabled, required };
}

function hasAddress(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Boolean(clean(
    row.governorateId || row.governorateName || row.cazaId || row.cazaName ||
    row.villageId || row.villageName || row.manualText,
    500,
  ));
}

function validateAnswers(fields: FormField[], raw: unknown): Record<string, unknown> {
  const answers = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const sanitized: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === "section") continue;
    const state = fieldState(field, answers);
    if (!state.visible || state.disabled) continue;
    const value = answers[field.key];
    const empty = isEmptyValue(value);
    if (state.required && empty) throw Object.assign(new Error(`REQUIRED_FIELD_MISSING:${field.key}`), { statusCode: 400 });
    if (state.required && field.type === "universal_locator" && !hasAddress(value)) {
      throw Object.assign(new Error(`REQUIRED_FIELD_MISSING:${field.key}`), { statusCode: 400 });
    }
    if (["select", "radio"].includes(field.type) && !empty && !field.options.includes(String(value))) {
      throw Object.assign(new Error(`INVALID_FIELD_OPTION:${field.key}`), { statusCode: 400 });
    }
    if (field.type === "multi_select" && !empty && (!Array.isArray(value) || value.some((item) => !field.options.includes(String(item))))) {
      throw Object.assign(new Error(`INVALID_FIELD_OPTION:${field.key}`), { statusCode: 400 });
    }
    if (field.type === "file" && !empty && !Array.isArray(value)) {
      throw Object.assign(new Error(`INVALID_FILE_FIELD:${field.key}`), { statusCode: 400 });
    }
    if (!empty) sanitized[field.key] = value;
  }
  return sanitized;
}

function reference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `FORM-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function legacyStatusForWorkflow(value: string): string {
  if (value === "APPROVED") return "APPROVED";
  if (value === "REJECTED") return "REJECTED";
  if (value === "CLOSED" || value === "ARCHIVED") return "ARCHIVED";
  if (value === "SUBMITTED") return "SUBMITTED";
  return "IN_REVIEW";
}

function mapForm(row: any) {
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description,
    status: row.status, currentVersion: Number(row.current_version || 0),
    fields: Array.isArray(row.draft_fields_json) ? row.draft_fields_json : [],
    settings: normalizeSettings(row.draft_settings_json),
    submissionCount: Number(row.submission_count ?? 0),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function loadPublishedFormBySlug(slug: string) {
  const result = await query<any>(`SELECT f.*,v.fields_json,v.settings_json FROM universal_forms f
    JOIN universal_form_versions v ON v.form_id=f.id AND v.version=f.current_version
    WHERE f.slug=$1 AND f.status='PUBLISHED' LIMIT 1`, [slug]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    fields: normalizeFields(row.fields_json),
    settings: normalizeSettings(row.settings_json),
  };
}

async function enforceAccessMode(request: FastifyRequest, settings: FormSettings) {
  const user = (request as any).user ?? null;
  if (settings.accessMode === "ACCOUNT_REQUIRED" && !user?.id) {
    throw Object.assign(new Error("AUTH_REQUIRED"), { statusCode: 401 });
  }
  if (settings.accessMode === "VERIFIED_ACCOUNT_REQUIRED") {
    if (!user?.id) throw Object.assign(new Error("AUTH_REQUIRED"), { statusCode: 401 });
    const result = await query<any>("SELECT phone_verified_at FROM users WHERE id=$1 LIMIT 1", [user.id]);
    if (!result.rows[0]?.phone_verified_at) throw Object.assign(new Error("VERIFIED_ACCOUNT_REQUIRED"), { statusCode: 403 });
  }
}

async function submissionIdentity(request: FastifyRequest, settings: FormSettings, raw: unknown) {
  const user = (request as any).user ?? null;
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  let identity = {
    name: clean(input.name, 180),
    phone: clean(input.phone, 40),
    email: clean(input.email, 320),
  };
  if (user?.id && (!identity.name || !identity.phone || !identity.email)) {
    const result = await query<any>(`SELECT COALESCE(NULLIF(full_name,''),NULLIF(name,''),'') AS name,
      COALESCE(NULLIF(phone_number,''),NULLIF(phone,''),'') AS phone,COALESCE(email,'') AS email
      FROM users WHERE id=$1 LIMIT 1`, [user.id]);
    const row = result.rows[0] ?? {};
    identity = {
      name: identity.name || clean(row.name, 180),
      phone: identity.phone || clean(row.phone, 40),
      email: identity.email || clean(row.email, 320),
    };
  }
  if (settings.accessMode === "PUBLIC_IDENTIFIED" && (!identity.name || !identity.phone || !identity.email)) {
    throw Object.assign(new Error("IDENTITY_REQUIRED"), { statusCode: 400 });
  }
  return identity;
}

function notifyUser(app: FastifyInstance, userId: string | null | undefined, title: string, body: string, route: string) {
  if (!userId) return;
  try {
    app.pluginDb.prepare(`INSERT OR IGNORE INTO notifications
      (id,title,body,kind,ts,read,user_id,ref_type,ref_id) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(`form_${randomUUID()}`, title, body, "system", Date.now(), 0, userId, "route", route);
  } catch (error) {
    app.log.warn({ err: error, userId }, "universal_form_notification_failed");
  }
}

async function notifyAdmins(app: FastifyInstance, title: string, body: string, route: string) {
  try {
    const result = await query<any>("SELECT id FROM users WHERE role IN ('admin','superadmin') AND status='active' LIMIT 100");
    for (const row of result.rows) notifyUser(app, row.id, title, body, route);
  } catch (error) {
    app.log.warn({ err: error }, "universal_form_admin_notification_failed");
  }
}

function fileFieldByKey(fields: FormField[], fieldKey: string): FormField | null {
  return fields.find((item) => item.key === fieldKey && item.type === "file") ?? null;
}

function safeDownloadName(value: string): string {
  return value.replace(/[\r\n"\\]/g, "_").slice(0, 180) || "attachment.bin";
}

async function fileBufferFromRequest(request: any) {
  let fieldKey = "";
  let uploadToken = "";
  let file: { buffer: Buffer; filename: string; mimeType: string } | null = null;
  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (file) throw Object.assign(new Error("ONE_FILE_PER_UPLOAD"), { statusCode: 400 });
      file = {
        buffer: await part.toBuffer(),
        filename: part.filename || "attachment.bin",
        mimeType: part.mimetype || "application/octet-stream",
      };
      continue;
    }
    if (part.fieldname === "fieldKey") fieldKey = clean(part.value, 64);
    if (part.fieldname === "uploadToken") uploadToken = clean(part.value, 160);
  }
  if (!fieldKey || !uploadToken || !file) {
    throw Object.assign(new Error("UPLOAD_FIELDS_REQUIRED"), { statusCode: 400 });
  }
  return { fieldKey, uploadToken, file };
}

export async function universalFormsRoutes(app: FastifyInstance) {
  app.get("/api/universal-forms", async () => {
    const result = await query<any>(`SELECT f.*, (SELECT COUNT(*) FROM universal_form_submissions s WHERE s.form_id=f.id) AS submission_count
      FROM universal_forms f WHERE f.status='PUBLISHED' ORDER BY f.updated_at DESC`);
    return { ok: true, items: result.rows.map(mapForm) };
  });

  app.get("/api/universal-forms/:slug", async (request: any, reply) => {
    const form = await loadPublishedFormBySlug(slugify(request.params?.slug));
    if (!form) return reply.code(404).send({ error: "FORM_NOT_FOUND" });
    return { ok: true, item: {
      id: form.id, slug: form.slug, name: form.name, description: form.description,
      status: form.status, currentVersion: Number(form.current_version),
      fields: form.fields, settings: form.settings,
    } };
  });

  app.post("/api/universal-forms/:slug/uploads", async (request: any, reply) => {
    const form = await loadPublishedFormBySlug(slugify(request.params?.slug));
    if (!form) return reply.code(404).send({ error: "FORM_NOT_FOUND" });
    await enforceAccessMode(request, form.settings);
    const upload = await fileBufferFromRequest(request);
    const field = fileFieldByKey(form.fields, upload.fieldKey);
    if (!field) return reply.code(400).send({ error: "FILE_FIELD_NOT_FOUND" });
    const allowed = field.allowedMimeTypes?.length ? field.allowedMimeTypes : DEFAULT_FILE_MIME_TYPES;
    if (!allowed.includes(upload.file.mimeType)) return reply.code(415).send({ error: "FILE_TYPE_NOT_ALLOWED" });
    const maxBytes = Math.max(1, field.maxFileSizeMb || 5) * 1024 * 1024;
    if (upload.file.buffer.length > maxBytes) return reply.code(413).send({ error: "FILE_TOO_LARGE" });
    const uploadId = randomUUID();
    const stored = await storeCommunityAttachmentUpload({
      attachmentId: uploadId,
      filename: upload.file.filename,
      mimeType: upload.file.mimeType,
      buffer: upload.file.buffer,
    });
    if (!stored.ok) return reply.code(stored.statusCode).send({ error: stored.error });
    try {
      const result = await query<any>(`INSERT INTO universal_form_uploads
        (id,form_id,form_version,field_key,upload_token,submitter_user_id,original_name,mime_type,bytes,sha256,storage_key,scan_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'clean')
        RETURNING id,field_key,original_name,mime_type,bytes,created_at`, [
        uploadId, form.id, Number(form.current_version), field.key, upload.uploadToken,
        request.user?.id || null, stored.value.originalName, stored.value.mimeType,
        stored.value.bytes, stored.value.sha256, stored.value.storageKey,
      ]);
      return reply.code(201).send({ ok: true, item: result.rows[0] });
    } catch (error) {
      await fs.unlink(stored.value.storedPath).catch(() => undefined);
      throw error;
    }
  });

  app.delete("/api/universal-forms/:slug/uploads/:id", async (request: any, reply) => {
    const form = await loadPublishedFormBySlug(slugify(request.params?.slug));
    if (!form) return reply.code(404).send({ error: "FORM_NOT_FOUND" });
    const uploadToken = clean(request.query?.token, 160);
    if (!uploadToken) return reply.code(400).send({ error: "UPLOAD_TOKEN_REQUIRED" });
    const result = await query<any>(`DELETE FROM universal_form_uploads
      WHERE id=$1 AND form_id=$2 AND upload_token=$3 AND bound_submission_id IS NULL
      AND (submitter_user_id IS NULL OR submitter_user_id=$4) RETURNING storage_key`,
      [clean(request.params?.id, 64), form.id, uploadToken, request.user?.id || null]);
    const row = result.rows[0];
    if (!row) return reply.code(404).send({ error: "UPLOAD_NOT_FOUND" });
    const storage = await ensureCommunityAttachmentStorage();
    await fs.unlink(path.join(storage.cleanDir, row.storage_key)).catch(() => undefined);
    return { ok: true };
  });

  app.post("/api/universal-forms/:slug/submissions", async (request: any, reply) => {
    const form = await loadPublishedFormBySlug(slugify(request.params?.slug));
    if (!form) return reply.code(404).send({ error: "FORM_NOT_FOUND" });
    await enforceAccessMode(request, form.settings);
    const identity = await submissionIdentity(request, form.settings, request.body?.identity);
    const answers = validateAnswers(form.fields, request.body?.answers);
    const uploadToken = clean(request.body?.uploadToken, 160);
    const client = await getClient();
    let inserted: any;
    try {
      await client.query("BEGIN");
      inserted = (await client.query<any>(`INSERT INTO universal_form_submissions
        (reference,form_id,form_version,submitter_user_id,answers,identity_json,status,workflow_state,source_type,source_id)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,'SUBMITTED','SUBMITTED',$7,$8)
        RETURNING *`, [reference(),form.id,Number(form.current_version),request.user?.id||null,
        JSON.stringify(answers),JSON.stringify(identity),clean(request.body?.sourceType,80)||null,clean(request.body?.sourceId,160)||null])).rows[0];
      for (const field of form.fields.filter((item: FormField) => item.type === "file")) {
        const value = answers[field.key];
        if (value === undefined) continue;
        const ids = Array.isArray(value) ? value.map((item) => clean(item, 64)).filter(Boolean) : [];
        if (ids.length > (field.maxFiles || 1)) throw Object.assign(new Error(`TOO_MANY_FILES:${field.key}`), { statusCode: 400 });
        if (!uploadToken || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
          throw Object.assign(new Error(`INVALID_FILE_UPLOAD:${field.key}`), { statusCode: 400 });
        }
        const matched = await client.query<any>(`SELECT id FROM universal_form_uploads
          WHERE id=ANY($1::uuid[]) AND form_id=$2 AND form_version=$3 AND field_key=$4
          AND upload_token=$5 AND bound_submission_id IS NULL AND expires_at>NOW()
          AND (($6::uuid IS NULL AND submitter_user_id IS NULL) OR submitter_user_id=$6)`,
          [ids,form.id,Number(form.current_version),field.key,uploadToken,request.user?.id||null]);
        if (matched.rows.length !== ids.length) {
          throw Object.assign(new Error(`INVALID_FILE_UPLOAD:${field.key}`), { statusCode: 400 });
        }
        await client.query(`UPDATE universal_form_uploads SET bound_submission_id=$2 WHERE id=ANY($1::uuid[])`, [ids,inserted.id]);
      }
      await client.query(`INSERT INTO universal_form_submission_events
        (submission_id,actor_user_id,event_type,to_state,payload_json)
        VALUES ($1,$2,'SUBMITTED','SUBMITTED',$3::jsonb)`,
        [inserted.id,request.user?.id||null,JSON.stringify({ sourceType: inserted.source_type || null })]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
    const publicRoute = `/forms/live/${form.slug}`;
    if (form.settings.notifyApplicantOnSubmit && request.user?.id) {
      notifyUser(app, request.user.id, "تم استلام النموذج", `تم استلام ${form.name}. المرجع: ${inserted.reference}`, publicRoute);
    }
    if (form.settings.notifyAdminsOnSubmit) {
      await notifyAdmins(app, "طلب نموذج جديد", `${form.name} · ${inserted.reference}`, "/ops/forms");
    }
    return reply.code(201).send({ ok: true, item: {
      id: inserted.id, reference: inserted.reference, status: inserted.status,
      workflowState: inserted.workflow_state, created_at: inserted.created_at,
    } });
  });

  app.get("/api/admin/forms", async (request) => {
    requireAdmin(request);
    const status = clean((request.query as any)?.status, 20).toUpperCase();
    const params: unknown[] = [];
    const where = status && FORM_STATUSES.has(status) ? `WHERE f.status=$${params.push(status)}` : "";
    const result = await query<any>(`SELECT f.*, (SELECT COUNT(*) FROM universal_form_submissions s WHERE s.form_id=f.id) AS submission_count
      FROM universal_forms f ${where} ORDER BY f.updated_at DESC`, params);
    return { ok: true, items: result.rows.map(mapForm) };
  });

  app.get("/api/admin/forms/assignees", async (request) => {
    requireAdmin(request);
    const result = await query<any>(`SELECT id,COALESCE(NULLIF(full_name,''),NULLIF(name,''),email,'Admin') AS name,email,role
      FROM users WHERE status='active' AND role IN ('admin','superadmin') ORDER BY role DESC,name ASC LIMIT 200`);
    return { ok: true, items: result.rows };
  });

  app.post("/api/admin/forms", async (request: any, reply) => {
    const actor = requireAdmin(request);
    const body = request.body ?? {};
    const name = clean(body.name, 180), slug = slugify(body.slug || body.name);
    if (!name || !slug) return reply.code(400).send({ error: "FORM_NAME_AND_SLUG_REQUIRED" });
    const fields = normalizeFields(body.fields);
    const settings = normalizeSettings(body.settings);
    try {
      const result = await query<any>(`INSERT INTO universal_forms
        (slug,name,description,owner_user_id,draft_fields_json,draft_settings_json,created_by,updated_by)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$7) RETURNING *`,
        [slug,name,clean(body.description,1000)||null,actor.id,JSON.stringify(fields),JSON.stringify(settings),actor.id]);
      return reply.code(201).send({ ok: true, item: mapForm(result.rows[0]) });
    } catch (error: any) {
      if (error?.code === "23505") return reply.code(409).send({ error: "FORM_SLUG_EXISTS" });
      throw error;
    }
  });

  app.get("/api/admin/forms/:id", async (request: any, reply) => {
    requireAdmin(request);
    const result = await query<any>(`SELECT f.*, (SELECT COUNT(*) FROM universal_form_submissions s WHERE s.form_id=f.id) AS submission_count
      FROM universal_forms f WHERE f.id=$1 LIMIT 1`, [clean(request.params?.id, 64)]);
    return result.rows[0] ? { ok: true, item: mapForm(result.rows[0]) } : reply.code(404).send({ error: "FORM_NOT_FOUND" });
  });

  app.put("/api/admin/forms/:id", async (request: any, reply) => {
    const actor = requireAdmin(request);
    const id = clean(request.params?.id, 64), body = request.body ?? {};
    const name = clean(body.name, 180), slug = slugify(body.slug || body.name);
    if (!name || !slug) return reply.code(400).send({ error: "FORM_NAME_AND_SLUG_REQUIRED" });
    const fields = normalizeFields(body.fields);
    const settings = normalizeSettings(body.settings);
    try {
      const result = await query<any>(`UPDATE universal_forms SET slug=$2,name=$3,description=$4,
        draft_fields_json=$5::jsonb,draft_settings_json=$6::jsonb,updated_by=$7,updated_at=NOW()
        WHERE id=$1 RETURNING *`, [id,slug,name,clean(body.description,1000)||null,
        JSON.stringify(fields),JSON.stringify(settings),actor.id]);
      return result.rows[0] ? { ok: true, item: mapForm(result.rows[0]) } : reply.code(404).send({ error: "FORM_NOT_FOUND" });
    } catch (error: any) {
      if (error?.code === "23505") return reply.code(409).send({ error: "FORM_SLUG_EXISTS" });
      throw error;
    }
  });

  app.post("/api/admin/forms/:id/publish", async (request: any, reply) => {
    const actor = requireAdmin(request), id = clean(request.params?.id, 64);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const form = (await client.query<any>("SELECT * FROM universal_forms WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (!form) { await client.query("ROLLBACK"); return reply.code(404).send({ error: "FORM_NOT_FOUND" }); }
      const version = Number(form.current_version || 0) + 1;
      const fields = normalizeFields(form.draft_fields_json ?? []);
      const settings = normalizeSettings(form.draft_settings_json ?? {});
      await client.query(`INSERT INTO universal_form_versions(form_id,version,fields_json,settings_json,published_by)
        VALUES ($1,$2,$3::jsonb,$4::jsonb,$5)`, [id,version,JSON.stringify(fields),JSON.stringify(settings),actor.id]);
      const updated = await client.query<any>(`UPDATE universal_forms SET status='PUBLISHED',current_version=$2,
        draft_fields_json=$3::jsonb,draft_settings_json=$4::jsonb,updated_by=$5,updated_at=NOW()
        WHERE id=$1 RETURNING *`, [id,version,JSON.stringify(fields),JSON.stringify(settings),actor.id]);
      await client.query("COMMIT");
      return { ok: true, item: mapForm(updated.rows[0]) };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  });

  app.post("/api/admin/forms/:id/clone", async (request: any, reply) => {
    const actor = requireAdmin(request), id = clean(request.params?.id, 64), body = request.body ?? {};
    const form = (await query<any>("SELECT * FROM universal_forms WHERE id=$1 LIMIT 1", [id])).rows[0];
    if (!form) return reply.code(404).send({ error: "FORM_NOT_FOUND" });
    const name = clean(body.name, 180) || `${form.name} - نسخة`;
    const slug = slugify(body.slug) || `${form.slug}-copy-${Date.now().toString().slice(-6)}`;
    try {
      const created = await query<any>(`INSERT INTO universal_forms
        (slug,name,description,owner_user_id,draft_fields_json,draft_settings_json,created_by,updated_by)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$7) RETURNING *`,
        [slug,name,form.description,actor.id,JSON.stringify(form.draft_fields_json ?? []),JSON.stringify(form.draft_settings_json ?? {}),actor.id]);
      return reply.code(201).send({ ok: true, item: mapForm(created.rows[0]) });
    } catch (error: any) {
      if (error?.code === "23505") return reply.code(409).send({ error: "FORM_SLUG_EXISTS" });
      throw error;
    }
  });

  app.patch("/api/admin/forms/:id/status", async (request: any, reply) => {
    const actor = requireAdmin(request), id = clean(request.params?.id, 64);
    const status = clean(request.body?.status, 20).toUpperCase();
    if (!FORM_STATUSES.has(status)) return reply.code(400).send({ error: "INVALID_FORM_STATUS" });
    if (status === "PUBLISHED") return reply.code(400).send({ error: "USE_PUBLISH_ENDPOINT" });
    const result = await query<any>(`UPDATE universal_forms SET status=$2,updated_by=$3,updated_at=NOW()
      WHERE id=$1 RETURNING *`, [id,status,actor.id]);
    return result.rows[0] ? { ok: true, item: mapForm(result.rows[0]) } : reply.code(404).send({ error: "FORM_NOT_FOUND" });
  });

  app.get("/api/admin/forms/templates", async (request) => {
    requireAdmin(request);
    const result = await query<any>(`SELECT id,template_key,name,description,category,fields_json,settings_json,is_system,created_at,updated_at
      FROM universal_form_templates ORDER BY is_system DESC,category,name`);
    return { ok: true, items: result.rows.map((row: any) => ({
      id: row.id, templateKey: row.template_key, name: row.name, description: row.description,
      category: row.category, fields: row.fields_json, settings: row.settings_json,
      isSystem: row.is_system, createdAt: row.created_at, updatedAt: row.updated_at,
    })) };
  });

  app.post("/api/admin/forms/templates/:id/create-form", async (request: any, reply) => {
    const actor = requireAdmin(request);
    const template = (await query<any>("SELECT * FROM universal_form_templates WHERE id=$1 LIMIT 1", [clean(request.params?.id,64)])).rows[0];
    if (!template) return reply.code(404).send({ error: "FORM_TEMPLATE_NOT_FOUND" });
    const body = request.body ?? {};
    const name = clean(body.name, 180) || template.name;
    const slug = slugify(body.slug || name);
    if (!slug) return reply.code(400).send({ error: "FORM_NAME_AND_SLUG_REQUIRED" });
    try {
      const created = await query<any>(`INSERT INTO universal_forms
        (slug,name,description,owner_user_id,draft_fields_json,draft_settings_json,created_by,updated_by)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$7) RETURNING *`, [slug,name,
        clean(body.description,1000)||template.description||null,actor.id,JSON.stringify(normalizeFields(template.fields_json)),
        JSON.stringify(normalizeSettings(template.settings_json)),actor.id]);
      return reply.code(201).send({ ok: true, item: mapForm(created.rows[0]) });
    } catch (error: any) {
      if (error?.code === "23505") return reply.code(409).send({ error: "FORM_SLUG_EXISTS" });
      throw error;
    }
  });

  app.post("/api/admin/forms/:id/save-template", async (request: any, reply) => {
    const actor = requireAdmin(request), body = request.body ?? {};
    const form = (await query<any>("SELECT * FROM universal_forms WHERE id=$1 LIMIT 1", [clean(request.params?.id,64)])).rows[0];
    if (!form) return reply.code(404).send({ error: "FORM_NOT_FOUND" });
    const name = clean(body.name, 180) || form.name;
    const templateKey = slugify(body.templateKey || `${form.slug}-${Date.now().toString().slice(-6)}`);
    if (!name || !templateKey) return reply.code(400).send({ error: "TEMPLATE_NAME_REQUIRED" });
    try {
      const created = await query<any>(`INSERT INTO universal_form_templates
        (template_key,name,description,category,fields_json,settings_json,is_system,created_by)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,FALSE,$7) RETURNING *`, [templateKey,name,
        clean(body.description,1000)||form.description||null,clean(body.category,60).toUpperCase()||'GENERAL',
        JSON.stringify(normalizeFields(form.draft_fields_json)),JSON.stringify(normalizeSettings(form.draft_settings_json)),actor.id]);
      return reply.code(201).send({ ok: true, item: created.rows[0] });
    } catch (error: any) {
      if (error?.code === "23505") return reply.code(409).send({ error: "FORM_TEMPLATE_KEY_EXISTS" });
      throw error;
    }
  });

  app.get("/api/admin/forms/submissions/all", async (request: any) => {
    requireAdmin(request);
    const formId = clean(request.query?.form_id, 64);
    const workflow = clean(request.query?.workflow_state, 24).toUpperCase();
    const priority = clean(request.query?.priority, 16).toUpperCase();
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (formId) clauses.push(`s.form_id=$${params.push(formId)}`);
    if (workflow && WORKFLOW_STATES.has(workflow)) clauses.push(`s.workflow_state=$${params.push(workflow)}`);
    if (priority && PRIORITIES.has(priority)) clauses.push(`s.priority=$${params.push(priority)}`);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await query<any>(`SELECT s.*,f.name AS form_name,f.slug AS form_slug,
      COALESCE(NULLIF(u.full_name,''),NULLIF(u.name,''),u.email,'') AS assignee_name,
      (SELECT COUNT(*) FROM universal_form_uploads a WHERE a.bound_submission_id=s.id) AS attachment_count
      FROM universal_form_submissions s JOIN universal_forms f ON f.id=s.form_id
      LEFT JOIN users u ON u.id=s.assigned_user_id
      ${where} ORDER BY s.created_at DESC LIMIT 500`, params);
    return { ok: true, items: result.rows };
  });

  app.get("/api/admin/forms/submissions/:id", async (request: any, reply) => {
    requireAdmin(request);
    const id = clean(request.params?.id, 64);
    const submission = (await query<any>(`SELECT s.*,f.name AS form_name,f.slug AS form_slug,
      COALESCE(NULLIF(u.full_name,''),NULLIF(u.name,''),u.email,'') AS assignee_name
      FROM universal_form_submissions s JOIN universal_forms f ON f.id=s.form_id
      LEFT JOIN users u ON u.id=s.assigned_user_id WHERE s.id=$1 LIMIT 1`, [id])).rows[0];
    if (!submission) return reply.code(404).send({ error: "SUBMISSION_NOT_FOUND" });
    const events = await query<any>(`SELECT e.*,COALESCE(NULLIF(u.full_name,''),NULLIF(u.name,''),u.email,'') AS actor_name
      FROM universal_form_submission_events e LEFT JOIN users u ON u.id=e.actor_user_id
      WHERE e.submission_id=$1 ORDER BY e.created_at ASC`, [id]);
    const uploads = await query<any>(`SELECT id,field_key,original_name,mime_type,bytes,sha256,created_at
      FROM universal_form_uploads WHERE bound_submission_id=$1 ORDER BY created_at`, [id]);
    return { ok: true, item: submission, events: events.rows, uploads: uploads.rows };
  });

  app.get("/api/admin/forms/uploads/:id/content", async (request: any, reply) => {
    requireAdmin(request);
    const row = (await query<any>(`SELECT original_name,mime_type,storage_key,scan_status
      FROM universal_form_uploads WHERE id=$1 AND bound_submission_id IS NOT NULL LIMIT 1`,
      [clean(request.params?.id,64)])).rows[0];
    if (!row || row.scan_status !== "clean") return reply.code(404).send({ error: "UPLOAD_NOT_FOUND" });
    const storage = await ensureCommunityAttachmentStorage();
    try {
      const buffer = await fs.readFile(path.join(storage.cleanDir, row.storage_key));
      reply.header("Content-Disposition", `attachment; filename="${safeDownloadName(row.original_name)}"`);
      reply.type(row.mime_type || "application/octet-stream");
      return reply.send(buffer);
    } catch {
      return reply.code(404).send({ error: "UPLOAD_CONTENT_NOT_FOUND" });
    }
  });

  app.patch("/api/admin/forms/submissions/:id", async (request: any, reply) => {
    const actor = requireAdmin(request);
    const id = clean(request.params?.id, 64), body = request.body ?? {};
    const requestedWorkflow = body.workflowState ?? body.status;
    const workflow = requestedWorkflow === undefined ? undefined : clean(requestedWorkflow, 24).toUpperCase();
    if (workflow !== undefined && !WORKFLOW_STATES.has(workflow)) return reply.code(400).send({ error: "INVALID_WORKFLOW_STATE" });
    const priority = body.priority === undefined ? undefined : clean(body.priority, 16).toUpperCase();
    if (priority !== undefined && !PRIORITIES.has(priority)) return reply.code(400).send({ error: "INVALID_PRIORITY" });
    const existing = (await query<any>(`SELECT s.*,f.slug AS form_slug,f.name AS form_name,v.settings_json AS submission_settings_json
      FROM universal_form_submissions s JOIN universal_forms f ON f.id=s.form_id
      JOIN universal_form_versions v ON v.form_id=s.form_id AND v.version=s.form_version
      WHERE s.id=$1 LIMIT 1`, [id])).rows[0];
    if (!existing) return reply.code(404).send({ error: "SUBMISSION_NOT_FOUND" });
    const assignedUserId = body.assignedUserId === undefined ? existing.assigned_user_id : (clean(body.assignedUserId,64) || null);
    if (assignedUserId) {
      const assignee = (await query<any>("SELECT id FROM users WHERE id=$1 AND status='active' AND role IN ('admin','superadmin') LIMIT 1", [assignedUserId])).rows[0];
      if (!assignee) return reply.code(400).send({ error: "INVALID_ASSIGNEE" });
    }
    let dueAt = existing.due_at;
    if (body.dueAt !== undefined) {
      if (!body.dueAt) dueAt = null;
      else {
        const parsed = new Date(String(body.dueAt));
        if (Number.isNaN(parsed.valueOf())) return reply.code(400).send({ error: "INVALID_DUE_DATE" });
        dueAt = parsed.toISOString();
      }
    }
    const tags = body.tags === undefined ? existing.tags : (Array.isArray(body.tags)
      ? body.tags.map((item: unknown) => clean(item,60)).filter(Boolean).slice(0,20)
      : []);
    const nextWorkflow = workflow ?? existing.workflow_state ?? existing.status;
    const nextPriority = priority ?? existing.priority ?? "NORMAL";
    const nextDepartment = body.assignedDepartment === undefined ? existing.assigned_department : (clean(body.assignedDepartment,160) || null);
    const nextAdminNotes = body.adminNotes === undefined ? existing.admin_notes : (clean(body.adminNotes,4000) || null);
    const nextPublicNote = body.publicNote === undefined ? existing.public_note : (clean(body.publicNote,2000) || null);
    const changed: Record<string, unknown> = {};
    if (nextWorkflow !== (existing.workflow_state ?? existing.status)) changed.workflowState = nextWorkflow;
    if (assignedUserId !== existing.assigned_user_id) changed.assignedUserId = assignedUserId;
    if (nextDepartment !== existing.assigned_department) changed.assignedDepartment = nextDepartment;
    if (nextPriority !== existing.priority) changed.priority = nextPriority;
    if (String(dueAt ?? "") !== String(existing.due_at ?? "")) changed.dueAt = dueAt;
    if (nextAdminNotes !== existing.admin_notes) changed.adminNotes = true;
    if (nextPublicNote !== existing.public_note) changed.publicNote = nextPublicNote;
    if (JSON.stringify(tags ?? []) !== JSON.stringify(existing.tags ?? [])) changed.tags = tags;
    if (Object.keys(changed).length === 0) return reply.code(400).send({ error: "NO_UPDATES" });

    const client = await getClient();
    let updated: any;
    try {
      await client.query("BEGIN");
      updated = (await client.query<any>(`UPDATE universal_form_submissions SET
        status=$2,workflow_state=$3,assigned_user_id=$4,assigned_department=$5,priority=$6,due_at=$7,
        admin_notes=$8,public_note=$9,tags=$10::jsonb,updated_by=$11,updated_at=NOW()
        WHERE id=$1 RETURNING *`, [id,legacyStatusForWorkflow(nextWorkflow),nextWorkflow,assignedUserId,nextDepartment,
        nextPriority,dueAt,nextAdminNotes,nextPublicNote,JSON.stringify(tags ?? []),actor.id])).rows[0];
      const eventType = changed.workflowState ? "STATUS_CHANGED"
        : (changed.assignedUserId !== undefined || changed.assignedDepartment !== undefined) ? "ASSIGNMENT_CHANGED" : "UPDATED";
      await client.query(`INSERT INTO universal_form_submission_events
        (submission_id,actor_user_id,event_type,from_state,to_state,note,payload_json)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`, [id,actor.id,eventType,
        existing.workflow_state ?? existing.status,nextWorkflow,nextPublicNote,JSON.stringify(changed)]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
    const settings = normalizeSettings(existing.submission_settings_json ?? {});
    if (settings.notifyApplicantOnStatusChange && existing.submitter_user_id && (changed.workflowState || changed.publicNote !== undefined)) {
      const bodyText = nextPublicNote || `تم تحديث حالة الطلب ${updated.reference} إلى ${nextWorkflow}`;
      notifyUser(app, existing.submitter_user_id, `تحديث ${existing.form_name}`, bodyText, `/forms/live/${existing.form_slug}`);
    }
    return { ok: true, item: updated, changed };
  });
}
