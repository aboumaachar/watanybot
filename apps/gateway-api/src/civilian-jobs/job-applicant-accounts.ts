import type { PoolClient } from "pg";
import pool from "../lib/db.js";
import { hashPassword } from "../auth/password.js";

export class ApplicantIdentityConflictError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ApplicantIdentityConflictError";
  }
}

export type EnsureApplicantInput = {
  applicationId: string;
  campaignId: string;
  name: string;
  phone: string;
  email?: string | null;
};

export function normalizeJobApplicantPhone(value: unknown): string {
  return String(value ?? "").replace(/\D+/g, "");
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
type UserRow = {
  id: string;
  email: string;
  phone: string | null;
  phone_number: string | null;
};

async function findCandidates(client: PoolClient, phoneDigits: string, email: string | null) {
  const result = await client.query<UserRow>(`
    SELECT id,email,phone,phone_number FROM users
    WHERE regexp_replace(COALESCE(phone_number, phone, ''), '[^0-9]', '', 'g') = $1
       OR ($2::text IS NOT NULL AND lower(email)=lower($2))
    ORDER BY created_at ASC, id ASC
  `, [phoneDigits, email]);
  return result.rows;
}

function resolveExisting(rows: UserRow[], phoneDigits: string, email: string | null): UserRow | null {
  if (!rows.length) return null;
  const byPhone = rows.filter((r) => normalizeJobApplicantPhone(r.phone_number || r.phone) === phoneDigits);
  const byEmail = email ? rows.filter((r) => r.email?.toLowerCase() === email) : [];
  const phoneIds = new Set(byPhone.map((r) => r.id));
  const emailIds = new Set(byEmail.map((r) => r.id));
  if (phoneIds.size > 1) throw new ApplicantIdentityConflictError("AMBIGUOUS_PHONE_MATCH", "Duplicate normalized phone users");
  // Job applicant identity is phone-primary because phone is the required fallback login identifier.
  // A conflicting email remains preserved on the application but must not redirect the application
  // to a different existing account when there is exactly one normalized-phone owner.
  if (phoneIds.size === 1) {
    const id = [...phoneIds][0];
    return rows.find((r) => r.id === id) ?? null;
  }
  if (emailIds.size > 1) throw new ApplicantIdentityConflictError("AMBIGUOUS_EMAIL_MATCH", "Multiple email user matches");
  if (emailIds.size === 1) {
    const id = [...emailIds][0];
    return rows.find((r) => r.id === id) ?? null;
  }
  if (rows.length > 1) throw new ApplicantIdentityConflictError("AMBIGUOUS_IDENTITY_MATCH", "Multiple user matches");
  return rows[0] ?? null;
}

async function linkApplication(client: PoolClient, userId: string, input: EnsureApplicantInput) {
  await client.query(`
    INSERT INTO job_application_user_links (user_id,campaign_id,application_id,source)
    VALUES ($1,$2,$3,'job_application')
    ON CONFLICT (campaign_id,application_id) DO UPDATE SET user_id=EXCLUDED.user_id
  `, [userId, input.campaignId, input.applicationId]);
}

export async function ensureAndLinkJobApplicant(input: EnsureApplicantInput) {
  const phoneDigits = normalizeJobApplicantPhone(input.phone);
  if (phoneDigits.length < 8 || phoneDigits.length > 15)
    throw new ApplicantIdentityConflictError("INVALID_PHONE", "Phone must normalize to 8-15 digits");
  const email = normalizeEmail(input.email);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`job-applicant:${phoneDigits}`]);
    let existing = resolveExisting(await findCandidates(client, phoneDigits, email), phoneDigits, email);
    if (existing) {
      await client.query(`UPDATE users SET
        full_name=CASE WHEN NULLIF(BTRIM(COALESCE(full_name,'')),'') IS NULL THEN $2 ELSE full_name END,
        name=CASE WHEN NULLIF(BTRIM(COALESCE(name,'')),'') IS NULL THEN $2 ELSE name END,
        phone_number=CASE WHEN NULLIF(BTRIM(COALESCE(phone_number,'')),'') IS NULL THEN $3 ELSE phone_number END,
        phone=CASE WHEN NULLIF(BTRIM(COALESCE(phone,'')),'') IS NULL THEN $3 ELSE phone END
        WHERE id=$1`, [existing.id, input.name.trim(), phoneDigits]);
      await linkApplication(client, existing.id, input);
      await client.query("COMMIT");
      return { userId: existing.id, created: false };
    }

    const passwordHash = await hashPassword(phoneDigits);
    const generatedEmail = email ?? `job.${phoneDigits}@accounts.koudama.local`;
    const generatedUsername = `phone_${phoneDigits}`;
    await client.query("SAVEPOINT applicant_user_insert");
    try {
      const inserted = await client.query<{ id: string }>(`
        INSERT INTO users (
          email,username,password_hash,full_name,name,phone_number,phone,role,status,
          must_change_password,account_origin
        ) VALUES ($1,$2,$3,$4,$4,$5,$5,'public','active',TRUE,'job_application')
        RETURNING id
      `, [generatedEmail, generatedUsername, passwordHash, input.name.trim(), phoneDigits]);
      const userId = inserted.rows[0].id;
      await linkApplication(client, userId, input);
      await client.query("COMMIT");
      return { userId, created: true };
    } catch (error: any) {
      if (error?.code !== "23505") throw error;
      await client.query("ROLLBACK TO SAVEPOINT applicant_user_insert");
      existing = resolveExisting(await findCandidates(client, phoneDigits, email), phoneDigits, email);
      if (!existing) throw error;
      await linkApplication(client, existing.id, input);
      await client.query("COMMIT");
      return { userId: existing.id, created: false };
    }
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
