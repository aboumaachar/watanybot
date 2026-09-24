import { closePool, query } from "../lib/db.js";
import {
  ApplicantIdentityConflictError,
  ensureAndLinkJobApplicant,
  normalizeJobApplicantPhone,
} from "../civilian-jobs/job-applicant-accounts.js";

const dryRun = process.argv.includes("--dry-run");

type AppRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  campaign_id: string;
};

async function loadApplications(): Promise<AppRow[]> {
  const seasonal = await query<AppRow>(`
    SELECT id,name,phone,email,'seasonal-apple-job-2026-tannourine'::text AS campaign_id
    FROM seasonal_apple_job_applications ORDER BY created_at,id
  `);
  const mreisseh = await query<AppRow>(`
    SELECT id,name,phone,email,'ain-mreisseh-building-assistant'::text AS campaign_id
    FROM ain_mreisseh_building_assistant_applications ORDER BY created_at,id
  `);
  return [...seasonal.rows, ...mreisseh.rows];
}
async function preflight(rows: AppRow[]) {
  const invalidPhone = rows.filter((row) => {
    const digits = normalizeJobApplicantPhone(row.phone);
    return digits.length < 8 || digits.length > 15;
  }).length;

  const identity = await query<{
    ambiguous_phone_groups: string;
    cross_identity_applications: string;
  }>(`
    WITH apps AS (
      SELECT id, regexp_replace(COALESCE(phone,''),'[^0-9]','','g') AS p,
             NULLIF(lower(trim(COALESCE(email,''))),'') AS e
      FROM seasonal_apple_job_applications
      UNION ALL
      SELECT id, regexp_replace(COALESCE(phone,''),'[^0-9]','','g') AS p,
             NULLIF(lower(trim(COALESCE(email,''))),'') AS e
      FROM ain_mreisseh_building_assistant_applications
    ), ambiguous AS (
      SELECT a.p FROM (SELECT DISTINCT p FROM apps WHERE length(p) BETWEEN 8 AND 15) a
      JOIN users u ON regexp_replace(COALESCE(u.phone_number,u.phone,''),'[^0-9]','','g')=a.p
      GROUP BY a.p HAVING COUNT(DISTINCT u.id)>1
    ), cross_matches AS (
      SELECT DISTINCT a.id
      FROM apps a
      JOIN users up ON regexp_replace(COALESCE(up.phone_number,up.phone,''),'[^0-9]','','g')=a.p
      JOIN users ue ON a.e IS NOT NULL AND lower(ue.email)=a.e AND ue.id<>up.id
    )
    SELECT (SELECT COUNT(*) FROM ambiguous)::text AS ambiguous_phone_groups,
           (SELECT COUNT(*) FROM cross_matches)::text AS cross_identity_applications
  `);
  const p = identity.rows[0];
  console.log(`PREFLIGHT_APPLICATIONS=${rows.length}`);
  console.log(`PREFLIGHT_INVALID_PHONE=${invalidPhone}`);
  console.log(`PREFLIGHT_AMBIGUOUS_EXISTING_PHONE_GROUPS=${p?.ambiguous_phone_groups ?? "0"}`);
  console.log(`PREFLIGHT_CROSS_IDENTITY_APPLICATIONS=${p?.cross_identity_applications ?? "0"}`);
  if (p?.cross_identity_applications !== "0") console.log("PREFLIGHT_CROSS_IDENTITY_POLICY=PHONE_PRIMARY");

  if (invalidPhone > 0) throw new Error("BACKFILL_BLOCKED_INVALID_PHONE");
  if (p?.ambiguous_phone_groups !== "0") throw new Error("BACKFILL_BLOCKED_AMBIGUOUS_PHONE");
}

async function reconcile() {
  const result = await query<{
    seasonal_apps: string; seasonal_links: string;
    mreisseh_apps: string; mreisseh_links: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM seasonal_apple_job_applications)::text AS seasonal_apps,
      (SELECT COUNT(*) FROM job_application_user_links WHERE campaign_id='seasonal-apple-job-2026-tannourine')::text AS seasonal_links,
      (SELECT COUNT(*) FROM ain_mreisseh_building_assistant_applications)::text AS mreisseh_apps,
      (SELECT COUNT(*) FROM job_application_user_links WHERE campaign_id='ain-mreisseh-building-assistant')::text AS mreisseh_links
  `);
  const r = result.rows[0];
  console.log(`RECON_SEASONAL=${r.seasonal_links}/${r.seasonal_apps}`);
  console.log(`RECON_MREISSEH=${r.mreisseh_links}/${r.mreisseh_apps}`);
  if (r.seasonal_apps !== r.seasonal_links || r.mreisseh_apps !== r.mreisseh_links)
    throw new Error("BACKFILL_RECONCILIATION_FAILED");
}
async function main() {
  const rows = await loadApplications();
  await preflight(rows);
  if (dryRun) {
    console.log("BACKFILL_DRY_RUN=PASS");
    return;
  }

  let created = 0;
  let reused = 0;
  let conflicts = 0;
  for (const row of rows) {
    try {
      const result = await ensureAndLinkJobApplicant({
        applicationId: row.id,
        campaignId: row.campaign_id,
        name: row.name,
        phone: row.phone,
        email: row.email,
      });
      if (result.created) created += 1;
      else reused += 1;
    } catch (error) {
      if (error instanceof ApplicantIdentityConflictError) {
        conflicts += 1;
        console.error(`IDENTITY_CONFLICT application_id=${row.id} campaign_id=${row.campaign_id} code=${error.code}`);
        continue;
      }
      throw error;
    }
  }
  console.log(`BACKFILL_CREATED_USERS=${created}`);
  console.log(`BACKFILL_REUSED_USERS=${reused}`);
  console.log(`BACKFILL_IDENTITY_CONFLICTS=${conflicts}`);
  if (conflicts > 0) throw new Error("BACKFILL_BLOCKED_IDENTITY_CONFLICTS");
  await reconcile();
  console.log("BACKFILL_FINAL=PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
});
