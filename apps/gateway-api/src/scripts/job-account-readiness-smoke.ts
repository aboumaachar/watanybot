import { randomBytes, randomUUID } from "node:crypto";
import { closePool, query } from "../lib/db.js";
import { hashPassword } from "../auth/password.js";
import { ensureAndLinkJobApplicant } from "../civilian-jobs/job-applicant-accounts.js";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8015";
const marker = `WATANY-SMOKE-${Date.now()}`;
const employerSuffix = randomUUID().replace(/-/g, "").slice(0, 12);
let candidatePhone = "";
let candidatePassword = "";
const newCandidatePassword = `W!${randomBytes(10).toString("hex")}`;
const employerEmail = `smoke.employer.${randomUUID()}@example.invalid`;
const employerPassword = `E!${randomBytes(10).toString("hex")}`;
let candidateUserId = "";
let employerUserId = "";

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

function bearer(token: string, extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function main() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const randomDigits = BigInt(`0x${randomBytes(6).toString("hex")}`).toString().slice(0, 10).padEnd(10, "7");
    const proposed = `99999${randomDigits}`.slice(0, 15);
    const exists = await query(`
      SELECT 1 FROM users
      WHERE regexp_replace(COALESCE(phone_number,phone,''),'[^0-9]','','g')=$1 LIMIT 1
    `, [proposed]);
    if (!(exists.rowCount ?? 0)) { candidatePhone = proposed; break; }
  }
  if (!candidatePhone) throw new Error("SMOKE_UNIQUE_SYNTHETIC_PHONE_UNAVAILABLE");
  candidatePassword = candidatePhone;

  const account = await ensureAndLinkJobApplicant({
    applicationId: randomUUID(),
    campaignId: "jobs-account-readiness-smoke",
    name: marker,
    phone: candidatePhone,
    email: null,
  });
  candidateUserId = account.userId;

  const initialLogin = await login(candidatePhone, candidatePassword);
  if (initialLogin.status !== 200) throw new Error(`SMOKE_INITIAL_PHONE_LOGIN_HTTP_${initialLogin.status}`);
  const initialBody = await initialLogin.json() as any;
  const candidateToken = String(initialBody.accessToken || "");
  if (!candidateToken) throw new Error("SMOKE_INITIAL_TOKEN_MISSING");

  const meBefore = await http("/api/me", { headers: bearer(candidateToken) });
  if (meBefore.status !== 200) throw new Error(`SMOKE_ME_BEFORE_HTTP_${meBefore.status}`);
  const meBeforeBody = await meBefore.json() as any;
  if (meBeforeBody?.user?.must_change_password !== true) throw new Error("SMOKE_MUST_CHANGE_BEFORE_NOT_TRUE");
  console.log("SMOKE_PHONE_FALLBACK_LOGIN=PASS");
  console.log("SMOKE_MUST_CHANGE_BEFORE=PASS");

  const change = await http("/api/auth/change-password", {
    method: "POST",
    headers: bearer(candidateToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ currentPassword: candidatePassword, newPassword: newCandidatePassword }),
  });
  if (change.status !== 200) throw new Error(`SMOKE_CHANGE_PASSWORD_HTTP_${change.status}`);

  const oldLogin = await login(candidatePhone, candidatePassword);
  if (oldLogin.status !== 401) throw new Error(`SMOKE_OLD_PASSWORD_EXPECTED_401_GOT_${oldLogin.status}`);
  const newLogin = await login(candidatePhone, newCandidatePassword);
  if (newLogin.status !== 200) throw new Error(`SMOKE_NEW_PASSWORD_LOGIN_HTTP_${newLogin.status}`);
  const newBody = await newLogin.json() as any;
  const newCandidateToken = String(newBody.accessToken || "");
  if (!newCandidateToken) throw new Error("SMOKE_NEW_TOKEN_MISSING");

  const meAfter = await http("/api/me", { headers: bearer(newCandidateToken) });
  const meAfterBody = await meAfter.json() as any;
  if (meAfter.status !== 200 || meAfterBody?.user?.must_change_password !== false)
    throw new Error("SMOKE_MUST_CHANGE_AFTER_NOT_FALSE");
  console.log("SMOKE_PASSWORD_ROTATION=PASS");
  console.log("SMOKE_MUST_CHANGE_AFTER=PASS");

  const readiness = await http("/api/jobs/readiness", {
    method: "POST",
    headers: bearer(newCandidateToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      jobType: "smoke-test-role",
      title: marker,
      summary: "synthetic readiness smoke",
      skills: ["smoke-skill"],
      workModes: ["onsite"],
      governorate: "Beirut",
      caza: "Beirut",
      locality: "Beirut",
    }),
  });
  if (readiness.status !== 201) throw new Error(`SMOKE_READINESS_CREATE_HTTP_${readiness.status}`);
  const readinessBody = await readiness.json() as any;
  const readinessId = String(readinessBody?.item?.id || "");
  if (!readinessId) throw new Error("SMOKE_READINESS_ID_MISSING");
  console.log("SMOKE_READINESS_PUBLISH=PASS");

  const employerHash = await hashPassword(employerPassword);
  const employer = await query<{ id: string }>(`
    INSERT INTO users (email,username,password_hash,full_name,name,role,status)
    VALUES ($1,$2,$3,$4,$4,'public','active') RETURNING id
  `, [employerEmail, `smoke_employer_${employerSuffix}`, employerHash, `${marker}-EMPLOYER`]);
  employerUserId = employer.rows[0].id;

  const employerLogin = await login(employerEmail, employerPassword);
  if (employerLogin.status !== 200) throw new Error(`SMOKE_EMPLOYER_LOGIN_HTTP_${employerLogin.status}`);
  const employerBody = await employerLogin.json() as any;
  const employerToken = String(employerBody.accessToken || "");
  if (!employerToken) throw new Error("SMOKE_EMPLOYER_TOKEN_MISSING");

  const forbidden = await http(`/api/jobs/candidates/search?q=${encodeURIComponent(marker)}`, {
    headers: bearer(employerToken),
  });
  if (forbidden.status !== 403) throw new Error(`SMOKE_UNAPPROVED_SEARCH_EXPECTED_403_GOT_${forbidden.status}`);
  console.log("SMOKE_UNAPPROVED_EMPLOYER_DENIED=PASS");

  const requestAccess = await http("/api/jobs/employer-access/request", {
    method: "POST",
    headers: bearer(employerToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ organizationName: `${marker}-ORG` }),
  });
  if (requestAccess.status !== 201) throw new Error(`SMOKE_EMPLOYER_REQUEST_HTTP_${requestAccess.status}`);
  await query("UPDATE job_employer_accounts SET status='APPROVED', reviewed_at=NOW() WHERE user_id=$1", [employerUserId]);

  const allowed = await http(`/api/jobs/candidates/search?q=${encodeURIComponent(marker)}`, {
    headers: bearer(employerToken),
  });
  if (allowed.status !== 200) throw new Error(`SMOKE_APPROVED_SEARCH_HTTP_${allowed.status}`);
  const allowedBody = await allowed.json() as any;
  const found = Array.isArray(allowedBody?.items)
    ? allowedBody.items.find((item: any) => String(item.id) === readinessId)
    : null;
  if (!found) throw new Error("SMOKE_CANDIDATE_NOT_FOUND");
  if (!found.phone) throw new Error("SMOKE_CANDIDATE_PHONE_NOT_EXPOSED_TO_APPROVED_EMPLOYER");
  if (found.email) throw new Error("SMOKE_INTERNAL_PLACEHOLDER_EMAIL_EXPOSED");
  console.log("SMOKE_APPROVED_EMPLOYER_SEARCH=PASS");
  console.log("SMOKE_INTERNAL_EMAIL_HIDDEN=PASS");
  console.log("JOB_ACCOUNT_READINESS_SMOKE=PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  try {
    const ids = [candidateUserId, employerUserId].filter(Boolean);
    if (ids.length) {
      await query("DELETE FROM sessions WHERE user_id = ANY($1::uuid[])", [ids]);
      await query("DELETE FROM users WHERE id = ANY($1::uuid[])", [ids]);
    }
    console.log("SMOKE_CLEANUP=PASS");
  } catch {
    console.error("SMOKE_CLEANUP=BLOCKED");
    process.exitCode = 1;
  } finally {
    await closePool();
  }
});
