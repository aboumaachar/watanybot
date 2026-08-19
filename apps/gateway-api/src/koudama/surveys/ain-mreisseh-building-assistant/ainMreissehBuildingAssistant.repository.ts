import { promises as fs } from "node:fs";
import path from "node:path";
import { query } from "../../../lib/db.js";
import {
  AIN_MREISSEH_BUILDING_ASSISTANT_CAMPAIGN_ID,
  type AinMreissehBuildingAssistantAdminPatch,
  type AinMreissehBuildingAssistantApplication,
  type AinMreissehBuildingAssistantApplicationInput,
} from "./ainMreissehBuildingAssistant.types.js";

const CAMPAIGN_ID = AIN_MREISSEH_BUILDING_ASSISTANT_CAMPAIGN_ID;
const LOCATION_RUNTIME_PATHS = [
  path.resolve(process.cwd(), "apps", "web-user", "public", "data", "location", "canonical", "runtime.json"),
  path.resolve(process.cwd(), "..", "web-user", "public", "data", "location", "canonical", "runtime.json"),
];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === "نعم";
}

function normalizePhone(value: unknown): string {
  return clean(value).replace(/[\s().-]/g, "");
}

function rowToApplication(row: Record<string, unknown>): AinMreissehBuildingAssistantApplication {
  return {
    id: clean(row.id),
    campaignId: CAMPAIGN_ID,
    name: clean(row.name),
    phone: clean(row.phone),
    age: clean(row.age),
    email: clean(row.email),
    governorate: clean(row.governorate),
    governorateAr: clean(row.governorate_ar),
    caza: clean(row.caza),
    cazaAr: clean(row.caza_ar),
    village: clean(row.village),
    villageAr: clean(row.village_ar),
    villageId: clean(row.village_id),
    canWorkFullTime: Boolean(row.can_work_full_time),
    acceptsSalary600: Boolean(row.accepts_salary_600),
    wantsHousing: Boolean(row.wants_housing),
    availableStartDate: new Date(String(row.available_start_date)).toISOString().slice(0, 10),
    status: clean(row.status).toLowerCase() as AinMreissehBuildingAssistantApplication["status"],
    followUpStatus: clean(row.follow_up_status).toLowerCase() as AinMreissehBuildingAssistantApplication["followUpStatus"],
    adminNotes: clean(row.admin_notes),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

async function databaseAvailable(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function validateCanonicalLocation(input: AinMreissehBuildingAssistantApplicationInput): Promise<void> {
  if (!clean(input.governorate) || !clean(input.caza) || !clean(input.village) || !clean(input.villageId)) {
    throw new Error("INVALID_ADDRESS_LOCATOR_SELECTION");
  }

  try {
    let runtimeText = "";
    for (const runtimePath of LOCATION_RUNTIME_PATHS) {
      try {
        runtimeText = await fs.readFile(runtimePath, "utf8");
        break;
      } catch {
        // Try the next workspace/package-relative path.
      }
    }
    if (!runtimeText) throw new Error("LOCATION_RUNTIME_NOT_FOUND");
    const runtime = JSON.parse(runtimeText) as { localities?: Array<{ id?: string }> };
    if (!runtime.localities?.some((locality) => locality.id === input.villageId)) {
      throw new Error("INVALID_VILLAGE_ID");
    }
  } catch (error) {
    if (error instanceof Error && ["INVALID_VILLAGE_ID", "INVALID_ADDRESS_LOCATOR_SELECTION"].includes(error.message)) throw error;
    throw new Error("ADDRESS_LOCATOR_DATA_UNAVAILABLE");
  }
}

async function normalizeInput(input: AinMreissehBuildingAssistantApplicationInput): Promise<{
  name: string;
  phone: string;
  age: string;
  email: string;
  governorate: string;
  governorateAr: string;
  caza: string;
  cazaAr: string;
  village: string;
  villageAr: string;
  villageId: string;
  canWorkFullTime: boolean;
  acceptsSalary600: boolean;
  wantsHousing: boolean;
  availableStartDate: string;
}> {
  const normalized = {
    name: clean(input.name),
    phone: normalizePhone(input.phone),
    age: clean(input.age),
    email: clean(input.email).toLowerCase(),
    governorate: clean(input.governorate),
    governorateAr: clean(input.governorateAr),
    caza: clean(input.caza),
    cazaAr: clean(input.cazaAr),
    village: clean(input.village),
    villageAr: clean(input.villageAr),
    villageId: clean(input.villageId),
    canWorkFullTime: booleanValue(input.canWorkFullTime),
    acceptsSalary600: booleanValue(input.acceptsSalary600),
    wantsHousing: booleanValue(input.wantsHousing),
    availableStartDate: clean(input.availableStartDate),
  };

  if (!normalized.name || !normalized.phone || !normalized.age || !normalized.availableStartDate) throw new Error("MISSING_REQUIRED_FIELD");
  if (!/^\+?[0-9]{7,15}$/.test(normalized.phone)) throw new Error("INVALID_PHONE");
  if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) throw new Error("INVALID_EMAIL");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.availableStartDate) || Number.isNaN(Date.parse(normalized.availableStartDate))) throw new Error("INVALID_START_DATE");
  await validateCanonicalLocation({ ...input, ...normalized });
  return normalized;
}

export async function createAinMreissehBuildingAssistantApplication(input: AinMreissehBuildingAssistantApplicationInput): Promise<AinMreissehBuildingAssistantApplication> {
  const normalized = await normalizeInput(input);
  const id = `AMBA-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  if (await databaseAvailable()) {
    const result = await query(
      `INSERT INTO ain_mreisseh_building_assistant_applications
        (id,campaign_id,name,phone,age,email,governorate,governorate_ar,caza,caza_ar,village,village_ar,village_id,
         can_work_full_time,accepts_salary_600,wants_housing,available_start_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [id, CAMPAIGN_ID, normalized.name, normalized.phone, normalized.age, normalized.email, normalized.governorate, normalized.governorateAr,
        normalized.caza, normalized.cazaAr, normalized.village, normalized.villageAr, normalized.villageId,
        normalized.canWorkFullTime, normalized.acceptsSalary600, normalized.wantsHousing, normalized.availableStartDate],
    );
    return rowToApplication(result.rows[0]);
  }
  throw new Error("DATABASE_UNAVAILABLE");
}

export async function listAinMreissehBuildingAssistantApplications(filters: { q?: string; status?: string; followUpStatus?: string } = {}) {
  const values: unknown[] = [CAMPAIGN_ID];
  const where = ["campaign_id = $1"];
  const q = clean(filters.q);
  const status = clean(filters.status).toLowerCase();
  const followUpStatus = clean(filters.followUpStatus).toLowerCase();
  if (q) {
    values.push(`%${q}%`);
    where.push(`(name ILIKE $${values.length} OR phone ILIKE $${values.length} OR village_ar ILIKE $${values.length})`);
  }
  if (status) { values.push(status); where.push(`LOWER(COALESCE(status, 'pending')) = $${values.length}`); }
  if (followUpStatus) { values.push(followUpStatus); where.push(`LOWER(COALESCE(follow_up_status, 'not_contacted')) = $${values.length}`); }
  const whereSql = where.join(" AND ");
  const countResult = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM ain_mreisseh_building_assistant_applications WHERE ${whereSql}`, values);
  const listResult = await query(`SELECT * FROM ain_mreisseh_building_assistant_applications WHERE ${whereSql} ORDER BY created_at DESC`, values);
  return { items: listResult.rows.map(rowToApplication), total: countResult.rows[0]?.total ?? 0 };
}

export async function updateAinMreissehBuildingAssistantApplication(id: string, patch: AinMreissehBuildingAssistantAdminPatch) {
  const updates: string[] = [];
  const values: unknown[] = [id, CAMPAIGN_ID];
  if (patch.status !== undefined) { values.push(patch.status); updates.push(`status = $${values.length}`); }
  if (patch.followUpStatus !== undefined) { values.push(patch.followUpStatus); updates.push(`follow_up_status = $${values.length}`); }
  if (patch.adminNotes !== undefined) { values.push(clean(patch.adminNotes)); updates.push(`admin_notes = $${values.length}`); }
  if (!updates.length) throw new Error("NO_UPDATES");
  values.push(new Date().toISOString());
  const result = await query(
    `UPDATE ain_mreisseh_building_assistant_applications SET ${updates.join(", ")}, updated_at = $${values.length}
     WHERE id = $1 AND campaign_id = $2 RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToApplication(result.rows[0]) : null;
}
