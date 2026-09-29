import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getClient, query } from "../../../lib/db.js";
import { appendAdminAuditEventInTransaction, createAdminAuditEvent } from "../../../admin-authority/adminAuthorityAudit.js";
import { createAdminAuthorityId, createAdminEntityVersionRowInTransaction, ensureAdminAuthorityTables } from "../../../admin-authority/adminAuthorityStore.js";
import { listAdminEntityVersions } from "../../../admin-authority/adminAuthorityVersioning.js";
import {
  MES_LOCATIONS,
  MES_PROFICIENCY,
  MIDDLE_EAST_SECURITY_CAMPAIGN_ID,
  type MiddleEastSecurityAdminPatch,
  type MiddleEastSecurityApplication,
  type MiddleEastSecurityFollowUpStatus,
  type MiddleEastSecurityHistoryEntry,
  type MiddleEastSecurityInput,
  type MiddleEastSecurityStatus,
  type MiddleEastSecuritySubmissionContext,
  type MiddleEastSecuritySubmissionResult,
} from "./middleEastSecurity.types.js";
import { resolveMiddleEastSecurityAddress } from "./middleEastSecurity.address.js";

const ENTITY_TYPE = "jobs.middle_east_security.application";
const FOLLOW_UP_STATUSES = new Set<MiddleEastSecurityFollowUpStatus>([
  "not_contacted",
  "to_contact",
  "contacted",
  "confirmed",
  "no_response",
  "withdrawn",
]);
const STATUSES = new Set<MiddleEastSecurityStatus>(["pending", "approved", "rejected"]);

const clean = (value: unknown): string => String(value ?? "").trim();
const bool = (value: unknown): boolean => value === true || value === "true" || value === "نعم";

function toIso(value: unknown): string {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export function hashMiddleEastSecuritySecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function newTrackingToken(): string {
  return randomBytes(32).toString("base64url");
}

function map(row: Record<string, any>): MiddleEastSecurityApplication {
  return {
    id: clean(row.id),
    userId: clean(row.user_id) || undefined,
    full_name: clean(row.full_name),
    birth_date: clean(row.birth_date).slice(0, 10),
    age_years: row.age_years == null ? undefined : Number(row.age_years),
    birth_place: clean(row.birth_place),
    address: clean(row.address),
    phone: clean(row.phone),
    preferred_location: clean(row.preferred_location),
    mohafaza: clean(row.mohafaza) || undefined,
    mohafaza_id: clean(row.mohafaza_id) || undefined,
    caza: clean(row.caza) || undefined,
    caza_id: clean(row.caza_id) || undefined,
    village: clean(row.village) || undefined,
    village_id: clean(row.village_id) || undefined,
    village_pcode: clean(row.village_pcode) || undefined,
    location_dataset_version: clean(row.location_dataset_version) || undefined,
    location_approval_status: clean(row.location_approval_status) || undefined,
    arabic_read: clean(row.arabic_read),
    arabic_write: clean(row.arabic_write),
    english_read: clean(row.english_read),
    english_write: clean(row.english_write),
    security_training: Boolean(row.security_training),
    security_training_details: clean(row.security_training_details) || undefined,
    ngo_experience: Boolean(row.ngo_experience),
    ngo_details: clean(row.ngo_details) || undefined,
    notes: clean(row.notes) || undefined,
    campaignId: MIDDLE_EAST_SECURITY_CAMPAIGN_ID,
    status: clean(row.status).toLowerCase() as MiddleEastSecurityStatus,
    followUpStatus: (clean(row.follow_up_status).toLowerCase() || "not_contacted") as MiddleEastSecurityFollowUpStatus,
    adminNotes: clean(row.admin_notes),
    version: Number(row.version || 1),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function managementSnapshot(item: MiddleEastSecurityApplication) {
  return {
    status: item.status,
    followUpStatus: item.followUpStatus,
    adminNotes: item.adminNotes,
    version: item.version,
    updatedAt: item.updatedAt,
  };
}

function normalizeInput(input: MiddleEastSecurityInput): MiddleEastSecurityInput {
  const normalized: MiddleEastSecurityInput = {
    full_name: clean(input.full_name),
    birth_date: clean(input.birth_date),
    age_years: clean(input.age_years),
    birth_place: clean(input.birth_place),
    address: clean(input.address),
    phone: clean(input.phone).replace(/[\s().-]/g, ""),
    preferred_location: clean(input.preferred_location),
    mohafaza: clean(input.mohafaza),
    mohafaza_id: clean(input.mohafaza_id),
    caza: clean(input.caza),
    caza_id: clean(input.caza_id),
    village: clean(input.village),
    village_id: clean(input.village_id),
    village_pcode: clean(input.village_pcode),
    location_dataset_version: clean(input.location_dataset_version),
    location_approval_status: clean(input.location_approval_status),
    arabic_read: clean(input.arabic_read),
    arabic_write: clean(input.arabic_write),
    english_read: clean(input.english_read),
    english_write: clean(input.english_write),
    security_training: bool(input.security_training),
    security_training_details: clean(input.security_training_details),
    ngo_experience: bool(input.ngo_experience),
    ngo_details: clean(input.ngo_details),
    notes: clean(input.notes),
  };

  const required = [
    "full_name",
    "birth_date",
    "age_years",
    "birth_place",
    "phone",
    "preferred_location",
    "arabic_read",
    "arabic_write",
    "english_read",
    "english_write",
  ] as const;
  if (required.some((key) => !clean(normalized[key]))) throw new Error("MISSING_REQUIRED_FIELD");
  for (const key of ["security_training", "ngo_experience"] as const) {
    const value = input[key];
    const supplied = value === true || value === false || ["true", "false", "نعم", "لا"].includes(clean(value).toLowerCase());
    if (!Object.prototype.hasOwnProperty.call(input, key) || !supplied) throw new Error("MISSING_REQUIRED_FIELD");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.birth_date) || Number.isNaN(Date.parse(normalized.birth_date))) {
    throw new Error("INVALID_BIRTH_DATE");
  }
  if (!/^\d+$/.test(String(normalized.age_years)) || !Number.isSafeInteger(Number(normalized.age_years)) || Number(normalized.age_years) < 1 || Number(normalized.age_years) > 130) {
    throw new Error("INVALID_AGE_YEARS");
  }
  if (!MES_LOCATIONS.includes(normalized.preferred_location as (typeof MES_LOCATIONS)[number])) throw new Error("INVALID_LOCATION");
  for (const key of ["arabic_read", "arabic_write", "english_read", "english_write"] as const) {
    if (!MES_PROFICIENCY.includes(normalized[key] as (typeof MES_PROFICIENCY)[number])) throw new Error("INVALID_PROFICIENCY");
  }
  if (!/^\+?[0-9]{7,15}$/.test(normalized.phone)) throw new Error("INVALID_PHONE");
  if (normalized.security_training && !clean(normalized.security_training_details)) {
    throw new Error("MISSING_SECURITY_TRAINING_DETAILS");
  }
  if (normalized.ngo_experience && !clean(normalized.ngo_details)) {
    throw new Error("MISSING_NGO_DETAILS");
  }
  return normalized;
}

export function payloadHash(input: MiddleEastSecurityInput): string {
  const stable = Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right)),
  );
  return hashMiddleEastSecuritySecret(JSON.stringify(stable));
}

function ownerScope(userId: string | null, trackingTokenHash: string | null): string {
  return hashMiddleEastSecuritySecret(userId ? `user:${userId}` : `anonymous:${trackingTokenHash}`);
}

export async function createMiddleEastSecurityApplication(
  input: MiddleEastSecurityInput,
  context: MiddleEastSecuritySubmissionContext = {},
): Promise<MiddleEastSecuritySubmissionResult> {
  const normalized = normalizeInput(input);
  const address = await resolveMiddleEastSecurityAddress(normalized);
  const normalizedWithAddress: MiddleEastSecurityInput = { ...normalized, ...address };
  const userId = clean(context.userId) || null;
  const trackingToken = userId ? undefined : clean(context.trackingToken) || newTrackingToken();
  const trackingTokenHash = trackingToken ? hashMiddleEastSecuritySecret(trackingToken) : null;
  const scope = ownerScope(userId, trackingTokenHash);
  const idempotencyKey = clean(context.idempotencyKey) || randomUUID();
  const idempotencyKeyHash = hashMiddleEastSecuritySecret(idempotencyKey);
  const normalizedPayloadHash = payloadHash(normalizedWithAddress);
  const id = `MES-${randomUUID()}`;

  const inserted = await query(
    `INSERT INTO middle_east_security_applications
      (id,user_id,full_name,birth_date,age_years,birth_place,address,mohafaza,mohafaza_id,caza,caza_id,village,village_id,village_pcode,location_dataset_version,location_approval_status,
       phone,preferred_location,
       arabic_read,arabic_write,english_read,english_write,security_training,
       security_training_details,ngo_experience,ngo_details,notes,follow_up_status,
       anonymous_tracking_token_hash,idempotency_scope,idempotency_key_hash,idempotency_payload_hash)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,'not_contacted',$28,$29,$30,$31)
     ON CONFLICT (idempotency_scope,idempotency_key_hash)
       WHERE idempotency_scope IS NOT NULL AND idempotency_key_hash IS NOT NULL
       DO NOTHING
     RETURNING *`,
    [
      id,
      userId,
      normalized.full_name,
      normalized.birth_date,
      Number(normalized.age_years),
      normalized.birth_place,
      address.address,
      address.mohafaza,
      address.mohafaza_id,
      address.caza,
      address.caza_id,
      address.village,
      address.village_id,
      address.village_pcode,
      address.location_dataset_version,
      address.location_approval_status,
      normalizedWithAddress.phone,
      normalizedWithAddress.preferred_location,
      normalizedWithAddress.arabic_read,
      normalizedWithAddress.arabic_write,
      normalizedWithAddress.english_read,
      normalizedWithAddress.english_write,
      normalizedWithAddress.security_training,
      normalizedWithAddress.security_training_details || null,
      normalizedWithAddress.ngo_experience,
      normalizedWithAddress.ngo_details || null,
      normalizedWithAddress.notes || null,
      trackingTokenHash,
      scope,
      idempotencyKeyHash,
      normalizedPayloadHash,
    ],
  );

  if (inserted.rows[0]) {
    return {
      item: map(inserted.rows[0]),
      trackingToken,
      idempotent: false,
    };
  }

  const existing = await query(
    `SELECT * FROM middle_east_security_applications
     WHERE idempotency_scope = $1 AND idempotency_key_hash = $2
     LIMIT 1`,
    [scope, idempotencyKeyHash],
  );
  const existingRow = existing.rows[0];
  if (!existingRow) throw new Error("IDEMPOTENCY_CONFLICT");
  if (clean(existingRow.idempotency_payload_hash) !== normalizedPayloadHash) {
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  }
  return {
    item: map(existingRow),
    trackingToken,
    idempotent: true,
  };
}

export async function listMiddleEastSecurityApplications(filters: {
  q?: string;
  status?: string;
  followUpStatus?: string;
  page?: string | number;
  pageSize?: string | number;
} = {}) {
  const values: unknown[] = [];
  const where: string[] = [];
  const status = clean(filters.status).toLowerCase();
  const followUpStatus = clean(filters.followUpStatus).toLowerCase();
  const q = clean(filters.q);
  if (status) {
    if (!STATUSES.has(status as MiddleEastSecurityStatus)) throw new Error("INVALID_STATUS");
    values.push(status);
    where.push(`status = $${values.length}`);
  }
  if (followUpStatus) {
    if (!FOLLOW_UP_STATUSES.has(followUpStatus as MiddleEastSecurityFollowUpStatus)) throw new Error("INVALID_FOLLOW_UP_STATUS");
    values.push(followUpStatus);
    where.push(`follow_up_status = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    where.push(`(full_name ILIKE $${values.length} OR phone ILIKE $${values.length} OR id ILIKE $${values.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(Number(filters.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize || 25), 1), 100);
  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM middle_east_security_applications ${whereSql}`,
    values,
  );
  const listValues = [...values, pageSize, (page - 1) * pageSize];
  const listResult = await query(
    `SELECT * FROM middle_east_security_applications ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues,
  );
  const summaryResult = await query<{ status: string; count: number }>(
    `SELECT status, COUNT(*)::int AS count
     FROM middle_east_security_applications
     GROUP BY status`,
  );
  const summary = { total: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of summaryResult.rows) {
    const count = Number(row.count || 0);
    summary.total += count;
    if (row.status in summary) summary[row.status as keyof typeof summary] = count;
  }
  const total = Number(countResult.rows[0]?.total || 0);
  return {
    items: listResult.rows.map(map),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    summary,
  };
}

export async function listAllMiddleEastSecurityApplications(filters: {
  q?: string;
  status?: string;
  followUpStatus?: string;
} = {}) {
  const pageSize = 100;
  const firstPage = await listMiddleEastSecurityApplications({ ...filters, page: 1, pageSize });
  const items = [...firstPage.items];
  for (let page = 2; page <= firstPage.totalPages && items.length < firstPage.total; page += 1) {
    const nextPage = await listMiddleEastSecurityApplications({ ...filters, page, pageSize });
    items.push(...nextPage.items);
    if (nextPage.items.length === 0) break;
  }
  return { items, total: firstPage.total };
}

export async function listMiddleEastSecurityApplicationsForOwner(input: {
  userId?: string;
  trackingToken?: string;
}): Promise<MiddleEastSecurityApplication[]> {
  const userId = clean(input.userId);
  const trackingToken = clean(input.trackingToken);
  if (!userId && !trackingToken) return [];
  const rows = userId
    ? await query(
      `SELECT * FROM middle_east_security_applications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [userId],
    )
    : await query(
      `SELECT * FROM middle_east_security_applications
       WHERE anonymous_tracking_token_hash = $1
       ORDER BY created_at DESC, id DESC`,
      [hashMiddleEastSecuritySecret(trackingToken)],
    );
  return rows.rows.map(map);
}

export async function getMiddleEastSecurityApplication(id: string): Promise<MiddleEastSecurityApplication | null> {
  const result = await query(
    "SELECT * FROM middle_east_security_applications WHERE id = $1",
    [id],
  );
  return result.rows[0] ? map(result.rows[0]) : null;
}

export async function listMiddleEastSecurityApplicationHistory(id: string): Promise<MiddleEastSecurityHistoryEntry[]> {
  const item = await getMiddleEastSecurityApplication(id);
  if (!item) return [];
  const versions = await listAdminEntityVersions(ENTITY_TYPE, id);
  const history: MiddleEastSecurityHistoryEntry[] = versions.map((version) => ({
    version: version.version,
    eventType: "MANAGEMENT_UPDATED",
    snapshot: version.snapshot as MiddleEastSecurityHistoryEntry["snapshot"],
    actorId: version.createdBy,
    createdAt: version.createdAt,
  }));
  history.push({
    version: 0,
    eventType: "SUBMITTED",
    snapshot: managementSnapshot({ ...item, status: "pending", followUpStatus: "not_contacted", adminNotes: "", version: 1 }),
    actorId: "public_submission",
    createdAt: item.createdAt,
  });
  return history.sort((left, right) => right.version - left.version);
}

type AdminActor = string | { id?: string; role?: string };

function actorDetails(actor: AdminActor): { id: string; role?: string } {
  if (typeof actor === "string") return { id: clean(actor) || "unknown_admin" };
  return { id: clean(actor.id) || "unknown_admin", role: clean(actor.role) || undefined };
}

export async function updateMiddleEastSecurityApplication(
  id: string,
  patch: MiddleEastSecurityAdminPatch,
  actor: AdminActor = "unknown_admin",
): Promise<MiddleEastSecurityApplication | null> {
  const updates: string[] = [];
  const values: unknown[] = [id];
  if (patch.status !== undefined) {
    if (!STATUSES.has(patch.status)) throw new Error("INVALID_STATUS");
    values.push(patch.status);
    updates.push(`status = $${values.length}`);
  }
  if (patch.followUpStatus !== undefined) {
    if (!FOLLOW_UP_STATUSES.has(patch.followUpStatus)) throw new Error("INVALID_FOLLOW_UP_STATUS");
    values.push(patch.followUpStatus);
    updates.push(`follow_up_status = $${values.length}`);
  }
  if (patch.adminNotes !== undefined) {
    values.push(clean(patch.adminNotes));
    updates.push(`admin_notes = $${values.length}`);
  }
  if (!updates.length) throw new Error("NO_UPDATES");
  if (patch.expectedVersion === undefined) throw new Error("INVALID_EXPECTED_VERSION");
  if (!Number.isInteger(patch.expectedVersion) || patch.expectedVersion < 1) {
    throw new Error("INVALID_EXPECTED_VERSION");
  }

  const details = actorDetails(actor);
  const client: PoolClient = await getClient();
  try {
    await ensureAdminAuthorityTables();
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT * FROM middle_east_security_applications
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );
    if (!currentResult.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const currentItem = map(currentResult.rows[0]);
    if (patch.expectedVersion !== undefined && currentItem.version !== patch.expectedVersion) {
      throw new Error("APPLICATION_STALE_VERSION");
    }
    const result = await client.query(
      `UPDATE middle_east_security_applications
       SET ${updates.join(", ")}, version = version + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new Error("APPLICATION_UPDATE_FAILED");
    const item = map(result.rows[0]);
    const before = managementSnapshot(currentItem);
    const after = managementSnapshot(item);
    await createAdminEntityVersionRowInTransaction(client, {
      id: createAdminAuthorityId("version"),
      entityType: ENTITY_TYPE,
      entityId: id,
      snapshot: after,
      createdBy: details.id,
      reason: "application_management_update",
    });
    await appendAdminAuditEventInTransaction(
      client,
      createAdminAuditEvent({
        eventType: "jobs.middle_east_security.application.updated",
        actorId: details.id,
        entityType: ENTITY_TYPE,
        entityId: id,
        before,
        after,
        reason: details.role ? `application_management_update:${details.role}` : "application_management_update",
      }),
    );
    await client.query("COMMIT");
    return item;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original mutation failure.
    }
    throw error;
  } finally {
    client.release();
  }
}
