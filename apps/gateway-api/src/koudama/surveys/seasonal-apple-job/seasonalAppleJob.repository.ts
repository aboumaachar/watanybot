import { promises as fs } from 'fs';
import path from 'path';
import type {
  SeasonalAppleJobAdminPatch,
  SeasonalAppleJobAcceptedApplication,
  SeasonalAppleJobApplication,
  SeasonalAppleJobApplicationInput,
} from './seasonalAppleJob.types';
import { calculateSeasonalAppleJobScore } from './seasonalAppleJob.scoring';
import { query } from '../../../lib/db';

const DATA_FILE = path.resolve(process.cwd(), 'data', 'koudama-seasonal-apple-job-applications.json');

type LocatorVillageRow = {
  id: string;
  muhafaza_name: string;
  caza_name: string;
  village_name?: string;
  display_name?: string;
};

type LocatorDataset = {
  villages: LocatorVillageRow[];
};

type LocatorLookup = {
  byVillageId: Map<string, { governorate: string; caza: string; village: string }>;
  byAddressKey: Set<string>;
};

let locatorLookupPromise: Promise<LocatorLookup> | null = null;

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readAll(): Promise<SeasonalAppleJobApplication[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: SeasonalAppleJobApplication[]): Promise<void> {
  await ensureDataFile();
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2), 'utf8');
  await fs.rename(tmp, DATA_FILE);
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 'true' || value === 'نعم';
}

function rowToApplication(row: Record<string, any>): SeasonalAppleJobApplication {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    age: row.age,
    gender: row.gender || '',
    relationType: row.relation_type,
    governorate: row.governorate,
    governorateAr: row.governorate_ar || '',
    caza: row.caza,
    cazaAr: row.caza_ar || '',
    village: row.village,
    villageAr: row.village_ar || '',
    villageId: row.village_id,
    availability: row.availability,
    preferredPeriod: row.preferred_period || '',
    weekendWork: row.weekend_work || '',
    canArrive6am: row.can_arrive_6am,
    hasAgriExperience: row.has_agri_experience,
    experienceText: row.experience_text || '',
    canStandHours: row.can_stand_hours,
    healthNote: row.health_note || '',
    futureJobsInterest: row.future_jobs_interest,
    interests: Array.isArray(row.interests) ? row.interests : [],
    familyMore: row.family_more || '',
    weightedScore: Number(row.weighted_score || 0),
    status: row.status,
    followUpStatus: row.follow_up_status,
    adminNotes: row.admin_notes || '',
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function databaseAvailable(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

function normalizeKeyPart(value: string): string {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ');
}

function buildAddressKey(governorate: string, caza: string, village: string): string {
  return `${normalizeKeyPart(governorate)}::${normalizeKeyPart(caza)}::${normalizeKeyPart(village)}`;
}

async function readLocatorDataset(): Promise<LocatorDataset> {
  const candidatePaths = [
    path.resolve(process.cwd(), '..', 'web-user', 'public', 'vendor', 'lebanon-admin-widget', 'data', 'lebanon_admin_data.json'),
    path.resolve(process.cwd(), 'apps', 'web-user', 'public', 'vendor', 'lebanon-admin-widget', 'data', 'lebanon_admin_data.json'),
  ];

  for (const filePath of candidatePaths) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<LocatorDataset>;
      if (Array.isArray(parsed.villages) && parsed.villages.length > 0) {
        return { villages: parsed.villages };
      }
    } catch {
      // Try the next candidate path.
    }
  }

  throw new Error('ADDRESS_LOCATOR_DATA_UNAVAILABLE');
}

async function getLocatorLookup(): Promise<LocatorLookup> {
  if (!locatorLookupPromise) {
    locatorLookupPromise = (async () => {
      const dataset = await readLocatorDataset();
      const byVillageId = new Map<string, { governorate: string; caza: string; village: string }>();
      const byAddressKey = new Set<string>();

      for (const row of dataset.villages) {
        const id = cleanText(row.id);
        const governorate = cleanText(row.muhafaza_name);
        const caza = cleanText(row.caza_name);
        const village = cleanText(row.display_name || row.village_name);

        if (!id || !governorate || !caza || !village) continue;

        byVillageId.set(id, { governorate, caza, village });
        byAddressKey.add(buildAddressKey(governorate, caza, village));
      }

      if (byVillageId.size === 0) {
        throw new Error('ADDRESS_LOCATOR_DATA_EMPTY');
      }

      return { byVillageId, byAddressKey };
    })();
  }

  return locatorLookupPromise;
}

async function validateAddressFromLocator(
  governorate: string,
  caza: string,
  village: string,
  villageId: string,
): Promise<void> {
  const locatorLookup = await getLocatorLookup();

  const addressKey = buildAddressKey(governorate, caza, village);
  if (!locatorLookup.byAddressKey.has(addressKey)) {
    throw new Error('INVALID_ADDRESS_LOCATOR_SELECTION');
  }

  if (!villageId) return;

  const villageEntry = locatorLookup.byVillageId.get(villageId);
  if (!villageEntry) {
    throw new Error('INVALID_VILLAGE_ID');
  }

  const expectedKey = buildAddressKey(villageEntry.governorate, villageEntry.caza, villageEntry.village);
  if (expectedKey !== addressKey) {
    throw new Error('ADDRESS_VILLAGE_MISMATCH');
  }
}

function requireText(value: unknown, field: string): string {
  const text = cleanText(value);
  if (!text) throw new Error(`Missing required field: ${field}`);
  return text;
}

async function normalizeInput(input: SeasonalAppleJobApplicationInput): Promise<SeasonalAppleJobApplicationInput> {
  const normalized = {
    ...input,
    name: requireText(input.name, 'name'),
    phone: requireText(input.phone, 'phone'),
    email: cleanText(input.email),
    age: requireText(input.age, 'age'),
    gender: cleanText(input.gender),
    relationType: requireText(input.relationType, 'relationType'),
    governorate: requireText(input.governorate, 'governorate'),
    caza: requireText(input.caza, 'caza'),
    village: requireText(input.village, 'village'),
    villageId: cleanText(input.villageId),
    availability: requireText(input.availability, 'availability'),
    canArrive6am: input.canArrive6am,
    hasAgriExperience: input.hasAgriExperience,
    experienceText: cleanText(input.experienceText),
    canStandHours: input.canStandHours,
    healthNote: cleanText(input.healthNote),
    futureJobsInterest: input.futureJobsInterest,
  };

  await validateAddressFromLocator(
    normalized.governorate,
    normalized.caza,
    normalized.village,
    normalized.villageId,
  );

  return normalized;
}

export async function createSeasonalAppleJobApplication(
  input: SeasonalAppleJobApplicationInput,
): Promise<SeasonalAppleJobApplication> {
  const normalized = await normalizeInput(input);
  const now = new Date().toISOString();

  const row: SeasonalAppleJobApplication = {
    ...normalized,
    id: `SAJ-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    campaignId: 'seasonal-apple-job-2026-tannourine',
    weightedScore: calculateSeasonalAppleJobScore(normalized),
    status: 'pending_review',
    followUpStatus: 'not_contacted',
    adminNotes: '',
    createdAt: now,
    updatedAt: now,
  };

  if (await databaseAvailable()) {
    const result = await query(
      `INSERT INTO seasonal_apple_job_applications
        (id, campaign_id, name, phone, email, age, gender, relation_type,
         governorate, governorate_ar, caza, caza_ar, village, village_ar, village_id,
         availability, preferred_period, weekend_work, can_arrive_6am, has_agri_experience,
         experience_text, can_stand_hours, health_note, future_jobs_interest, interests,
         family_more, weighted_score, status, follow_up_status, admin_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
       RETURNING *`,
      [row.id, row.campaignId, row.name, row.phone, row.email, String(row.age), row.gender, row.relationType,
        row.governorate, (row as any).governorateAr || '', row.caza, (row as any).cazaAr || '', row.village,
        (row as any).villageAr || '', row.villageId || '', row.availability, row.preferredPeriod || '', String(row.weekendWork || ''),
        booleanValue(row.canArrive6am), booleanValue(row.hasAgriExperience), row.experienceText || '', booleanValue(row.canStandHours),
        row.healthNote || '', booleanValue(row.futureJobsInterest), JSON.stringify(row.interests || []), row.familyMore || '',
        row.weightedScore, row.status, row.followUpStatus, row.adminNotes],
    );
    return rowToApplication(result.rows[0]);
  }

  const rows = await readAll();
  rows.unshift(row);
  await writeAll(rows);
  return row;
}

export async function listSeasonalAppleJobApplications(): Promise<SeasonalAppleJobApplication[]> {
  if (await databaseAvailable()) {
    const result = await query('SELECT * FROM seasonal_apple_job_applications ORDER BY weighted_score DESC, created_at DESC');
    return result.rows.map((row) => rowToApplication(row));
  }
  const rows = await readAll();
  return rows.sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

export async function listAcceptedSeasonalAppleJobApplications(): Promise<SeasonalAppleJobAcceptedApplication[]> {
  const applications = await listSeasonalAppleJobApplications();

  return applications
    .filter((application) => application.status === 'accepted')
    .map(({ id, name, relationType, governorate, caza, village, availability, preferredPeriod, createdAt }) => ({
      id,
      name,
      relationType,
      governorate,
      caza,
      village,
      availability,
      preferredPeriod,
      createdAt,
    }));
}

export async function getSeasonalAppleJobApplication(id: string): Promise<SeasonalAppleJobApplication | null> {
  if (await databaseAvailable()) {
    const result = await query('SELECT * FROM seasonal_apple_job_applications WHERE id = $1', [id]);
    return result.rows[0] ? rowToApplication(result.rows[0]) : null;
  }
  const rows = await readAll();
  return rows.find((row) => row.id === id) ?? null;
}

export async function updateSeasonalAppleJobApplication(
  id: string,
  patch: SeasonalAppleJobAdminPatch,
): Promise<SeasonalAppleJobApplication | null> {
  if (await databaseAvailable()) {
    const result = await query(
      `UPDATE seasonal_apple_job_applications
       SET status = COALESCE($2, status), follow_up_status = COALESCE($3, follow_up_status),
           admin_notes = COALESCE($4, admin_notes), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, patch.status || null, patch.followUpStatus || null, patch.adminNotes ?? null],
    );
    return result.rows[0] ? rowToApplication(result.rows[0]) : null;
  }
  const rows = await readAll();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return null;

  rows[index] = {
    ...rows[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await writeAll(rows);
  return rows[index];
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function exportSeasonalAppleJobApplicationsCsv(): Promise<string> {
  const rows = await listSeasonalAppleJobApplications();
  const headers = [
    'id',
    'createdAt',
    'name',
    'phone',
    'email',
    'age',
    'gender',
    'relationType',
    'governorate',
    'caza',
    'village',
    'villageId',
    'availability',
    'canArrive6am',
    'hasAgriExperience',
    'canStandHours',
    'futureJobsInterest',
    'weightedScore',
    'status',
    'followUpStatus',
    'adminNotes',
  ];

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape((row as any)[header])).join(',')),
  ].join('\n');
}