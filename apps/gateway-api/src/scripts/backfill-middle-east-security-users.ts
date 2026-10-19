import { closePool, getClient, query } from "../lib/db.js";
import {
  ApplicantIdentityConflictError,
  ensureAndLinkJobApplicant,
  normalizeJobApplicantPhone,
} from "../civilian-jobs/job-applicant-accounts.js";

const CAMPAIGN_ID = "middle-east-security";
const dryRun = process.argv.includes("--dry-run");

type MesRow = {
  id: string;
  full_name: string;
  phone: string;
  user_id: string | null;
};

async function validExistingUserId(value: string | null): Promise<string | null> {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  const result = await query<{ id: string }>(
    "SELECT id FROM users WHERE id::text=$1 LIMIT 1",
    [candidate],
  );
  return result.rows[0]?.id ?? null;
}
async function linkKnownUser(applicationId: string, userId: string) {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE middle_east_security_applications SET user_id=$2,updated_at=NOW() WHERE id=$1",
      [applicationId, userId],
    );
    await client.query(`
      INSERT INTO job_application_user_links(user_id,campaign_id,application_id,source)
      VALUES ($1,$2,$3,'job_application')
      ON CONFLICT(campaign_id,application_id)
      DO UPDATE SET user_id=EXCLUDED.user_id
    `, [userId, CAMPAIGN_ID, applicationId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function preflight(rows: MesRow[]) {
  let invalidPhone = 0;
  let validExistingIds = 0;  for (const row of rows) {
    if (await validExistingUserId(row.user_id)) {
      validExistingIds++;
      continue;
    }
    const phone = normalizeJobApplicantPhone(row.phone);
    if (phone.length < 8 || phone.length > 15) invalidPhone++;
  }

  const ambiguous = await query<{ groups: number }>(`
    WITH applicant_phones AS (
      SELECT DISTINCT regexp_replace(COALESCE(m.phone,''),'[^0-9]','','g') AS phone_digits
      FROM middle_east_security_applications m
      LEFT JOIN users linked ON linked.id::text=m.user_id
      WHERE linked.id IS NULL
    ), user_phones AS (
      SELECT regexp_replace(COALESCE(phone_number,phone,''),'[^0-9]','','g') AS phone_digits,
             COUNT(DISTINCT id)::int AS owners
      FROM users
      GROUP BY 1
    )
    SELECT COUNT(*)::int AS groups
    FROM applicant_phones a
    JOIN user_phones u USING(phone_digits)
    WHERE length(a.phone_digits) BETWEEN 8 AND 15 AND u.owners > 1
  `);

  console.log(`PREFLIGHT_MES_APPLICATIONS=${rows.length}`);
  console.log(`PREFLIGHT_VALID_EXISTING_USER_IDS=${validExistingIds}`);
  console.log(`PREFLIGHT_NEEDS_RESOLUTION=${rows.length-validExistingIds}`);
  console.log(`PREFLIGHT_INVALID_PHONE=${invalidPhone}`);
  console.log(`PREFLIGHT_AMBIGUOUS_USER_PHONE_GROUPS=${ambiguous.rows[0]?.groups ?? 0}`);
  if (invalidPhone > 0) throw new Error("MES_IMPORT_BLOCKED_INVALID_PHONE");
  if ((ambiguous.rows[0]?.groups ?? 0) > 0) throw new Error("MES_IMPORT_BLOCKED_AMBIGUOUS_PHONE");
}

async function reconcile() {
  const result = await query<{
    apps: number;
    links: number;
    valid_user_ids: number;
    mismatched_links: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM middle_east_security_applications) AS apps,
      (SELECT COUNT(*)::int FROM job_application_user_links WHERE campaign_id=$1) AS links,
      (SELECT COUNT(*)::int FROM middle_east_security_applications m
        JOIN users u ON u.id::text=m.user_id WHERE NULLIF(BTRIM(COALESCE(m.user_id,'')),'') IS NOT NULL) AS valid_user_ids,
      (SELECT COUNT(*)::int FROM middle_east_security_applications m
        JOIN job_application_user_links l ON l.campaign_id=$1 AND l.application_id=m.id
        WHERE COALESCE(m.user_id,'')<>l.user_id::text) AS mismatched_links
  `, [CAMPAIGN_ID]);
  const r = result.rows[0];
  console.log(`RECON_MES_LINKS=${r.links}/${r.apps}`);
  console.log(`RECON_MES_VALID_USER_IDS=${r.valid_user_ids}/${r.apps}`);
  console.log(`RECON_MES_MISMATCHED_LINKS=${r.mismatched_links}`);
  if (r.apps !== r.links || r.apps !== r.valid_user_ids || r.mismatched_links !== 0)
    throw new Error("MES_IMPORT_RECONCILIATION_FAILED");
}

async function main() {
  const rows = (await query<MesRow>(`
    SELECT id,full_name,phone,user_id
    FROM middle_east_security_applications
    ORDER BY created_at ASC,id ASC
  `)).rows;
  await preflight(rows);
  if (dryRun) {
    console.log("MES_IMPORT_DRY_RUN=PASS");
    return;
  }

  let preserved = 0;
  let created = 0;
  let reused = 0;
  let conflicts = 0;

  for (const row of rows) {
    const existingUserId = await validExistingUserId(row.user_id);
    try {
      if (existingUserId) {
        await linkKnownUser(row.id, existingUserId);
        preserved++;
        continue;
      }
      const result = await ensureAndLinkJobApplicant({
        applicationId: row.id,
        campaignId: CAMPAIGN_ID,
        name: row.full_name,
        phone: row.phone,
        email: null,
      });
      await query(
        "UPDATE middle_east_security_applications SET user_id=$2,updated_at=NOW() WHERE id=$1",
        [row.id, result.userId],
      );
      if (result.created) created++; else reused++;
    } catch (error) {
      if (error instanceof ApplicantIdentityConflictError) {
        conflicts++;
        console.error(`MES_IDENTITY_CONFLICT application_id=${row.id} code=${error.code}`);
        continue;
      }
      throw error;
    }
  }

  console.log(`MES_IMPORT_PRESERVED_AUTHENTICATED=${preserved}`);
  console.log(`MES_IMPORT_CREATED_USERS=${created}`);
  console.log(`MES_IMPORT_REUSED_USERS=${reused}`);
  console.log(`MES_IMPORT_IDENTITY_CONFLICTS=${conflicts}`);
  if (conflicts > 0) throw new Error("MES_IMPORT_BLOCKED_IDENTITY_CONFLICTS");
  await reconcile();
  console.log("MES_IMPORT_FINAL=PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => { await closePool(); });
