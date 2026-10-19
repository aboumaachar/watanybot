import { randomBytes, randomUUID } from "node:crypto";
import { closePool, query } from "../lib/db.js";
import { hashPassword } from "../auth/password.js";
import { ensureAndLinkJobApplicant } from "../civilian-jobs/job-applicant-accounts.js";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8015";
const marker = `JOBS-CMS-SMOKE-${Date.now()}`;
const appId = `AMBA-SMOKE-${Date.now()}-${randomBytes(3).toString("hex")}`;
const candidatePhone = `9998${BigInt(`0x${randomBytes(5).toString("hex")}`).toString().slice(0, 10)}`.slice(0, 14);
const adminEmail = `jobs.cms.admin.${randomUUID()}@example.invalid`;
const adminPassword = `A!${randomBytes(10).toString("hex")}`;
let candidateUserId = "";
let adminUserId = "";

async function http(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, init);
}

async function login(identifier: string, password: string) {
  return http("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: identifier, password, rememberMe: false }),
  });
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function main() {  await query(`
    INSERT INTO ain_mreisseh_building_assistant_applications (
      id,campaign_id,name,phone,age,email,governorate,governorate_ar,caza,caza_ar,
      village,village_ar,village_id,can_work_full_time,accepts_salary_600,wants_housing,available_start_date
    ) VALUES ($1,'ain-mreisseh-building-assistant',$2,$3,'35',NULL,'بيروت','بيروت','بيروت','بيروت',
      'عين المريسة','عين المريسة','jobs-cms-smoke-locality',TRUE,TRUE,FALSE,CURRENT_DATE)
  `, [appId, marker, candidatePhone]);

  const account = await ensureAndLinkJobApplicant({
    applicationId: appId,
    campaignId: "ain-mreisseh-building-assistant",
    name: marker,
    phone: candidatePhone,
    email: null,
  });
  candidateUserId = account.userId;

  const candidateLogin = await login(candidatePhone, candidatePhone);
  if (candidateLogin.status !== 200) throw new Error(`CANDIDATE_LOGIN_HTTP_${candidateLogin.status}`);
  const candidateBody = await candidateLogin.json() as any;
  const candidateToken = String(candidateBody.accessToken || "");
  if (!candidateToken) throw new Error("CANDIDATE_TOKEN_MISSING");

  const prefill = await http("/api/jobs/applications/mine/prefill", { headers: bearer(candidateToken) });
  if (prefill.status !== 200) throw new Error(`PREFILL_HTTP_${prefill.status}`);
  const prefillBody = await prefill.json() as any;
  const found = Array.isArray(prefillBody?.items)
    ? prefillBody.items.find((item: any) => item.applicationId === appId)
    : null;
  if (!found) throw new Error("PREFILL_APPLICATION_NOT_FOUND");
  if (found.name !== marker || found.age !== "35" || found.address?.localityId !== "jobs-cms-smoke-locality")
    throw new Error("PREFILL_SNAPSHOT_MISMATCH");
  console.log("SMOKE_PREVIOUS_APPLICATION_PREFILL=PASS");

  const mine = await http("/api/jobs/applications/mine", { headers: bearer(candidateToken) });
  if (mine.status !== 200) throw new Error(`MY_APPLICATIONS_HTTP_${mine.status}`);
  const mineBody = await mine.json() as any;
  const mineFound = Array.isArray(mineBody?.items)
    ? mineBody.items.find((item: any) => item.applicationId === appId)
    : null;
  if (!mineFound || mineFound.status !== "pending") throw new Error("MY_APPLICATIONS_ITEM_MISSING");
  console.log("SMOKE_MY_APPLICATIONS=PASS");
  const adminHash = await hashPassword(adminPassword);
  const admin = await query<{ id: string }>(`
    INSERT INTO users (email,username,password_hash,full_name,name,role,status)
    VALUES ($1,$2,$3,$4,$4,'admin','active') RETURNING id
  `, [adminEmail, `jobs_cms_admin_${randomUUID().replace(/-/g, "").slice(0, 12)}`, adminHash, `${marker}-ADMIN`]);
  adminUserId = admin.rows[0].id;

  const adminLogin = await login(adminEmail, adminPassword);
  if (adminLogin.status !== 200) throw new Error(`ADMIN_LOGIN_HTTP_${adminLogin.status}`);
  const adminBody = await adminLogin.json() as any;
  const adminToken = String(adminBody.accessToken || "");
  if (!adminToken) throw new Error("ADMIN_TOKEN_MISSING");

  const summary = await http("/api/jobs/admin/summary", { headers: bearer(adminToken) });
  if (summary.status !== 200) throw new Error(`ADMIN_SUMMARY_HTTP_${summary.status}`);
  const summaryBody = await summary.json() as any;
  if (typeof summaryBody?.summary?.linked_applications !== "number") throw new Error("ADMIN_SUMMARY_INVALID");

  const employerList = await http("/api/jobs/employer-access/admin?status=PENDING", { headers: bearer(adminToken) });
  if (employerList.status !== 200) throw new Error(`ADMIN_EMPLOYER_LIST_HTTP_${employerList.status}`);

  const applications = await http(`/api/jobs/admin/applications?q=${encodeURIComponent(appId)}`, { headers: bearer(adminToken) });
  if (applications.status !== 200) throw new Error(`ADMIN_APPLICATIONS_HTTP_${applications.status}`);
  const applicationsBody = await applications.json() as any;
  const adminFound = Array.isArray(applicationsBody?.items)
    ? applicationsBody.items.find((item: any) => item.applicationId === appId)
    : null;
  if (!adminFound || adminFound.status !== "pending") throw new Error("ADMIN_APPLICATIONS_ITEM_MISSING");
  console.log("SMOKE_UNIFIED_APPLICATIONS_ADMIN=PASS");
  console.log("SMOKE_JOBS_CMS_ADMIN_API=PASS");
  console.log("JOBS_CMS_NEXT_SMOKE=PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  try {
    const ids = [candidateUserId, adminUserId].filter(Boolean);
    if (ids.length) await query("DELETE FROM sessions WHERE user_id=ANY($1::uuid[])", [ids]);
    if (ids.length) await query("DELETE FROM users WHERE id=ANY($1::uuid[])", [ids]);
    await query("DELETE FROM ain_mreisseh_building_assistant_applications WHERE id=$1", [appId]);
    console.log("SMOKE_CLEANUP=PASS");
  } catch {
    console.error("SMOKE_CLEANUP=BLOCKED");
    process.exitCode = 1;
  } finally {
    await closePool();
  }
});
