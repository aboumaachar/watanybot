/**
 * GET /api/v2/jobs/my/applications ownership matrix, end to end against the disposable test database:
 * real sessions, real rows in job_application_submissions, middle_east_security_applications and
 * marketplace_job_applications. An applicant sees only records proven theirs by the authenticated user id
 * or by that subsystem's own tracking token; a phone number never proves ownership.
 */
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { query } from "../lib/db";
import { assertDisposableTestDatabase } from "./helpers/disposable-db";
import { cleanupSessionUsers, createSessionToken } from "./helpers/session-auth";

const run = randomUUID().slice(0, 8);
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const subOf = (token: string) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).sub as string;

const templateId = `own-tpl-${run}`;
const sharedId = `own-shared-${run}`; // the same id in both subsystems
const phoneB = `+9617${run.replace(/\D/g, "").padEnd(7, "0").slice(0, 7)}`;
const universalTokenA = `ujt-a-${randomUUID()}`;
const universalTokenB = `ujt-b-${randomUUID()}`;
const mesTokenA = `mes-a-${randomUUID()}`;
const legacyId = `own-legacy-${run}`;

const ids = {
  uA: sharedId,
  uB: `own-ub-${run}`,
  uAnonA: `own-uanon-${run}`,
  mA: sharedId,
  mB: `own-mb-${run}`,
  mAnonA: `own-manon-${run}`,
};

let app: FastifyInstance;
let tokenA = "";
let tokenB = "";

async function insertUniversal(id: string, userId: string | null, trackingHash: string | null, phone: string, createdAt: string) {
  await query(
    `INSERT INTO job_application_submissions (id, reference, template_id, template_version, applicant_user_id, anonymous_tracking_token_hash, applicant_name, phone, admin_notes, created_at, updated_at)
     VALUES ($1, $2, $3, 1, $4, $5, 'Applicant', $6, 'INTERNAL-NOTE', $7, $7)`,
    [id, `REF-${id}`, templateId, userId, trackingHash, phone, createdAt],
  );
}

async function insertMes(id: string, userId: string | null, trackingHash: string | null, phone: string, createdAt: string) {
  await query(
    `INSERT INTO middle_east_security_applications (id, user_id, anonymous_tracking_token_hash, full_name, birth_date, birth_place, phone, preferred_location,
       arabic_read, arabic_write, english_read, english_write, security_training, ngo_experience, admin_notes, created_at, updated_at)
     VALUES ($1, $2, $3, 'Applicant', '1990-01-01', 'Beirut', $4, 'بيروت', 'جيد', 'جيد', 'جيد', 'جيد', false, false, 'INTERNAL-NOTE', $5, $5)`,
    [id, userId, trackingHash, phone, createdAt],
  );
}

async function myApplications(headers: Record<string, string> = {}, search = "") {
  const response = await app.inject({ method: "GET", url: `/api/v2/jobs/my/applications${search}`, headers });
  expect(response.statusCode).toBe(200);
  return (response.json() as { applications: Array<Record<string, unknown>> }).applications;
}
const keys = (items: Array<Record<string, unknown>>) => items.map((item) => item.source_key).sort();
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe("GET /api/v2/jobs/my/applications ownership", () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    const server = await import("../server.js");
    app = server.app;
    await app.ready();
    tokenA = await createSessionToken("public", "owner-a");
    tokenB = await createSessionToken("public", "owner-b");
    const userA = subOf(tokenA);
    const userB = subOf(tokenB);
    await query(
      "INSERT INTO job_application_templates (id, slug, employer_name, name, title_ar) VALUES ($1, $1, 'Employer', 'Template', 'Title')",
      [templateId],
    );
    await insertUniversal(ids.uA, userA, null, "+96170000001", "2026-01-01T10:00:00Z");
    await insertUniversal(ids.uB, userB, sha256(universalTokenB), phoneB, "2026-01-02T10:00:00Z");
    await insertUniversal(ids.uAnonA, null, sha256(universalTokenA), "+96170000001", "2026-01-03T10:00:00Z");
    await insertMes(ids.mA, userA, null, "+96170000001", "2026-01-04T10:00:00Z");
    await insertMes(ids.mB, userB, null, phoneB, "2026-01-05T10:00:00Z");
    await insertMes(ids.mAnonA, null, sha256(mesTokenA), "+96170000001", "2026-01-06T10:00:00Z");
    await query(
      "INSERT INTO marketplace_job_applications (id, job_id, veteran_name, phone, status) VALUES ($1, 'job_001', 'Applicant B', $2, 'pending')",
      [legacyId, phoneB],
    );
  }, 60000);

  afterAll(async () => {
    await query("DELETE FROM job_application_submissions WHERE template_id = $1", [templateId]);
    await query("DELETE FROM job_application_templates WHERE id = $1", [templateId]);
    await query("DELETE FROM middle_east_security_applications WHERE id = ANY($1::text[])", [[ids.mA, ids.mB, ids.mAnonA]]);
    await query("DELETE FROM marketplace_job_applications WHERE id = $1", [legacyId]);
    await cleanupSessionUsers();
    const residue = await query<{ n: string }>(
      `SELECT (SELECT count(*) FROM job_application_submissions WHERE template_id = $1)
            + (SELECT count(*) FROM middle_east_security_applications WHERE id LIKE $2)
            + (SELECT count(*) FROM marketplace_job_applications WHERE id = $3) AS n`,
      [templateId, `own-%${run}`, legacyId],
    );
    expect(Number(residue.rows[0].n)).toBe(0);
  });

  it("returns nothing without a session or tracking token", async () => {
    expect(await myApplications()).toEqual([]);
  });

  it("shows a signed-in applicant their own records from both systems, tagged by source", async () => {
    const items = await myApplications(bearer(tokenA));
    expect(keys(items)).toEqual([`middle_east_security:${sharedId}`, `universal:${sharedId}`]);
    expect(new Set(items.map((item) => item.source))).toEqual(new Set(["universal", "middle_east_security"]));
  });

  it("keeps the same id in different systems as distinct records", async () => {
    const items = await myApplications(bearer(tokenA));
    expect(items.filter((item) => item.id === sharedId)).toHaveLength(2);
  });

  it("never discloses another applicant's records through a phone number", async () => {
    const items = await myApplications(bearer(tokenA), `?phone=${encodeURIComponent(phoneB)}`);
    expect(keys(items)).toEqual([`middle_east_security:${sharedId}`, `universal:${sharedId}`]);
    expect(items.some((item) => item.phone === phoneB)).toBe(false);
    const anonymous = await myApplications({}, `?phone=${encodeURIComponent(phoneB)}`);
    expect(anonymous).toEqual([]);
  });

  it("does not list legacy marketplace applications, which have no proven owner", async () => {
    const items = await myApplications(bearer(tokenB), `?phone=${encodeURIComponent(phoneB)}`);
    expect(items.some((item) => item.id === legacyId)).toBe(false);
    expect(keys(items)).toEqual([`middle_east_security:${ids.mB}`, `universal:${ids.uB}`]);
  });

  it("shows an anonymous applicant only the records owned by that subsystem's token", async () => {
    expect(keys(await myApplications({ "x-job-tracking-token": universalTokenA }))).toEqual([`universal:${ids.uAnonA}`]);
    expect(keys(await myApplications({ "x-mes-tracking-token": mesTokenA }))).toEqual([`middle_east_security:${ids.mAnonA}`]);
  });

  it("rejects a tracking token presented to the other subsystem", async () => {
    expect(await myApplications({ "x-mes-tracking-token": universalTokenA })).toEqual([]);
    expect(await myApplications({ "x-job-tracking-token": mesTokenA })).toEqual([]);
  });

  it("returns nothing for wrong, malformed or empty tokens", async () => {
    for (const value of ["wrong-token", "%%%", " ", sha256(universalTokenA)]) {
      expect(await myApplications({ "x-job-tracking-token": value, "x-mes-tracking-token": value })).toEqual([]);
    }
  });

  it("ignores tracking tokens sent in the query string", async () => {
    const search = `?job_tracking_token=${encodeURIComponent(universalTokenA)}&tracking_token=${encodeURIComponent(mesTokenA)}`;
    expect(await myApplications({}, search)).toEqual([]);
  });

  it("does not let user A read user B's records, even with a valid session of A", async () => {
    const items = await myApplications(bearer(tokenA));
    expect(items.some((item) => item.id === ids.uB || item.id === ids.mB)).toBe(false);
  });

  it("merges a signed-in owner's records with their anonymous ones, once each, newest first", async () => {
    const items = await myApplications({ ...bearer(tokenA), "x-job-tracking-token": universalTokenA, "x-mes-tracking-token": mesTokenA });
    expect(items.map((item) => item.source_key)).toEqual([
      `middle_east_security:${ids.mAnonA}`,
      `middle_east_security:${sharedId}`,
      `universal:${ids.uAnonA}`,
      `universal:${sharedId}`,
    ]);
    expect(new Set(items.map((item) => item.source_key)).size).toBe(items.length);
  });

  it("does not expose admin notes or token hashes to the applicant", async () => {
    const items = await myApplications({ ...bearer(tokenA), "x-job-tracking-token": universalTokenA, "x-mes-tracking-token": mesTokenA });
    const body = JSON.stringify(items);
    expect(body).not.toContain("INTERNAL-NOTE");
    expect(body).not.toContain(sha256(universalTokenA));
    expect(body).not.toContain(sha256(mesTokenA));
    expect(body).not.toMatch(/admin_?notes|tracking_token_hash|adminNotes/i);
  });
});
