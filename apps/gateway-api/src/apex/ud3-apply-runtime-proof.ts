import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

type JsonRecord = Record<string, any>;
const gatewayUrl = String(process.env.UD3_GATEWAY_URL || "http://127.0.0.1:4001").replace(/\/+$/u, "");
const payloadUrl = String(process.env.UD3_PAYLOAD_URL || "http://127.0.0.1:4101").replace(/\/+$/u, "");
const webUserUrl = String(process.env.UD3_WEB_USER_URL || "http://127.0.0.1:5174").replace(/\/+$/u, "");
const databaseUrl = String(process.env.DATABASE_URL || "");

function fail(message: string): never {
  console.error(`UD3_APPLY_PROOF_FAILURE=${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

async function jsonRequest(url: string, init: RequestInit = {}): Promise<{ status: number; body: JsonRecord; text: string }> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let body: JsonRecord = {};
  try { body = JSON.parse(text) as JsonRecord; } catch { body = { raw: text }; }
  return { status: response.status, body, text };
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function expectStatus(result: { status: number; body: JsonRecord }, expected: number, name: string): JsonRecord {
  if (result.status !== expected) return fail(`${name}_STATUS_${result.status}`);
  return result.body;
}

async function login(email: string, password: string): Promise<string> {
  const result = await jsonRequest(`${gatewayUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
  const body = expectStatus(result, 200, "LOGIN");
  if (!body.accessToken) return fail("LOGIN_TOKEN_MISSING");
  return String(body.accessToken);
}

async function payloadRequest(pathname: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return jsonRequest(`${payloadUrl}${pathname}`, { ...init, headers });
}

function procedureInput(procedureCode: string, marker: string) {
  return {
    procedureCode,
    title: { ar: `UD3 ${marker} / Public Service`, en: `UD3 ${marker} / Public Service EN` },
    summary: { ar: `UD3 ${marker} summary AR`, en: `UD3 ${marker} summary EN` },
    eligibility: ["UD3 synthetic actor"],
    requirements: ["UD3 disposable requirement"],
    steps: [`UD3 ${marker} step`],
    category: "ud3-acceptance",
    sourceAuthority: "ud3-runtime-proof",
    publicationState: "DRAFT" as const,
    workflowStatus: "DRAFT" as const,
  };
}

async function main(): Promise<void> {
  if (!databaseUrl || !/(test|apex_v119|ud3)/iu.test(new URL(databaseUrl).pathname)) return fail("DATABASE_URL_NOT_DISPOSABLE");
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const fixtureIds: string[] = [];
  const payloadProcedureIds: string[] = [];
  let firstToken = "";
  let secondToken = "";
  try {
    const password = randomBytes(32).toString("base64url");
    const secondPassword = randomBytes(32).toString("base64url");
    const firstEmail = `ud3-apply-${randomUUID()}@acceptance.invalid`;
    const secondEmail = `ud3-actor-${randomUUID()}@acceptance.invalid`;
    const firstHash = await bcrypt.hash(password, 10);
    const secondHash = await bcrypt.hash(secondPassword, 10);
    const firstUser = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash, role, status) VALUES ($1, $2, $3, 'superadmin', 'active') RETURNING id`,
      [firstEmail, "UD3 Apply Actor", firstHash],
    );
    const secondUser = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash, role, status) VALUES ($1, $2, $3, 'superadmin', 'active') RETURNING id`,
      [secondEmail, "UD3 Other Actor", secondHash],
    );
    fixtureIds.push(firstUser.rows[0].id, secondUser.rows[0].id);
    firstToken = await login(firstEmail, password);
    secondToken = await login(secondEmail, secondPassword);

    const procedureCode = `proc-ud3${randomBytes(5).toString("hex")}`;
    const record = procedureInput(procedureCode, "APPLY");
    const dryRun = await jsonRequest(`${gatewayUrl}/api/admin/cms/procedures/import/dry-run`, {
      method: "POST",
      headers: { ...authHeaders(firstToken), "Content-Type": "application/json" },
      body: JSON.stringify({ schemaVersion: "ud3-procedure-v1", records: [record] }),
    });
    const dryRunBody = expectStatus(dryRun, 200, "DRY_RUN");
    const planId = String(dryRunBody.plan?.planId || "");
    if (!planId) return fail("DRY_RUN_PLAN_ID_MISSING");

    const actorDenied = await jsonRequest(`${gatewayUrl}/api/admin/cms/procedures/import/apply`, {
      method: "POST",
      headers: { ...authHeaders(secondToken), "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    expectStatus(actorDenied, 403, "ACTOR_BINDING");

    const applied = await jsonRequest(`${gatewayUrl}/api/admin/cms/procedures/import/apply`, {
      method: "POST",
      headers: { ...authHeaders(firstToken), "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const appliedBody = expectStatus(applied, 200, "APPLY");
    if (appliedBody.state !== "APPLIED") return fail("APPLY_STATE_INVALID");
    const payloadProcedureId = String(appliedBody.payload?.[0]?.procedureId || "");
    if (!payloadProcedureId) return fail("APPLY_PAYLOAD_ID_MISSING");
    payloadProcedureIds.push(payloadProcedureId);

    const idempotent = await jsonRequest(`${gatewayUrl}/api/admin/cms/procedures/import/apply`, {
      method: "POST",
      headers: { ...authHeaders(firstToken), "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const idempotentBody = expectStatus(idempotent, 200, "IDEMPOTENT_APPLY");
    if (idempotentBody.idempotent !== true) return fail("IDEMPOTENT_APPLY_NOT_PROVEN");

    const staleCode = `proc-ud3stale${randomBytes(4).toString("hex")}`;
    const staleDryRun = await jsonRequest(`${gatewayUrl}/api/admin/cms/procedures/import/dry-run`, {
      method: "POST",
      headers: { ...authHeaders(firstToken), "Content-Type": "application/json" },
      body: JSON.stringify({ schemaVersion: "ud3-procedure-v1", records: [procedureInput(staleCode, "STALE")] }),
    });
    const stalePlanId = String(expectStatus(staleDryRun, 200, "STALE_DRY_RUN").plan?.planId || "");
    if (!stalePlanId) return fail("STALE_PLAN_ID_MISSING");
    await pool.query("UPDATE admin_import_plans SET expires_at = NOW() - interval '1 minute' WHERE plan_id = $1", [stalePlanId]);
    const staleApply = await jsonRequest(`${gatewayUrl}/api/admin/cms/procedures/import/apply`, {
      method: "POST",
      headers: { ...authHeaders(firstToken), "Content-Type": "application/json" },
      body: JSON.stringify({ planId: stalePlanId }),
    });
    expectStatus(staleApply, 409, "STALE_APPLY");

    const publish = await jsonRequest(`${gatewayUrl}/api/admin/cms/procedures/import/publish`, {
      method: "POST",
      headers: { ...authHeaders(firstToken), "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    expectStatus(publish, 200, "PUBLISH");

    const sso = await jsonRequest(`${gatewayUrl}/api/admin/payload-sso`, { method: "POST", headers: authHeaders(firstToken) });
    const ssoBody = expectStatus(sso, 200, "SSO");
    const assertion = String(ssoBody.assertion || "");
    if (!assertion) return fail("SSO_ASSERTION_MISSING");
    const publishedRead = await payloadRequest(`/api/procedures/${encodeURIComponent(payloadProcedureId)}?locale=ar&draft=false`, assertion);
    const publishedBody = expectStatus(publishedRead, 200, "PAYLOAD_PUBLISHED_READ");
    const publishedDoc = publishedBody.doc || publishedBody;
    if (publishedDoc._status !== "published" || publishedDoc.procedureCode !== procedureCode) return fail("PAYLOAD_PUBLISHED_STATE_INVALID");

    const versionsRead = await payloadRequest(`/api/procedures/versions?where%5Bparent%5D%5Bequals%5D=${encodeURIComponent(payloadProcedureId)}&limit=20&sort=-createdAt`, assertion);
    const versionsBody = expectStatus(versionsRead, 200, "PAYLOAD_VERSION_READ");
    const versionDocs = Array.isArray(versionsBody.docs) ? versionsBody.docs : [];
    if (versionDocs.length === 0) return fail("PAYLOAD_VERSION_EMPTY");
    const restoreVersionId = String(versionDocs[versionDocs.length - 1]?.id || versionDocs[0]?.id || "");
    if (!restoreVersionId) return fail("PAYLOAD_RESTORE_VERSION_ID_MISSING");

    const sync = await jsonRequest(`${gatewayUrl}/api/admin/cms/payload-sync/sync`, { method: "POST", headers: authHeaders(firstToken) });
    expectStatus(sync, 200, "GATEWAY_SYNC");
    const publicRead = await jsonRequest(`${gatewayUrl}/api/v2/procedures/${encodeURIComponent(procedureCode)}`);
    const publicBody = expectStatus(publicRead, 200, "PUBLIC_READ");
    if (!publicBody.procedure || String(publicBody.procedure.id) !== procedureCode) return fail("PUBLIC_IDENTITY_INVALID");

    const draftUpdate = await payloadRequest("/api/gateway-procedures/draft-update", assertion, {
      method: "POST",
      body: JSON.stringify({
        id: payloadProcedureId,
        procedureCode,
        ar: { title: "UD3 Restorable Draft AR", summary: "UD3 changed draft", eligibility: record.eligibility, requirements: record.requirements, steps: ["UD3 changed draft step"] },
        en: { title: "UD3 Restorable Draft EN", summary: "UD3 changed draft EN", eligibility: record.eligibility, requirements: record.requirements, steps: ["UD3 changed draft step"] },
      }),
    });
    expectStatus(draftUpdate, 200, "DRAFT_UPDATE");
    const draftRead = await payloadRequest(`/api/procedures/${encodeURIComponent(payloadProcedureId)}?locale=ar&draft=true`, assertion);
    const draftBody = expectStatus(draftRead, 200, "DRAFT_READ");
    const draftDoc = draftBody.doc || draftBody;
    if (draftDoc.title !== "UD3 Restorable Draft AR") return fail("DRAFT_VALUE_NOT_READ_BACK");
    const publishedAfterDraft = await payloadRequest(`/api/procedures/${encodeURIComponent(payloadProcedureId)}?locale=ar&draft=false`, assertion);
    const publishedAfterDraftBody = expectStatus(publishedAfterDraft, 200, "PUBLISHED_SEPARATION_READ");
    const publishedAfterDraftDoc = publishedAfterDraftBody.doc || publishedAfterDraftBody;
    if (publishedAfterDraftDoc.title === "UD3 Restorable Draft AR") return fail("DRAFT_PUBLISHED_SEPARATION_FAILED");

    const restore = await payloadRequest(`/api/procedures/versions/${encodeURIComponent(restoreVersionId)}`, assertion, { method: "POST", body: JSON.stringify({}) });
    expectStatus(restore, 200, "NATIVE_VERSION_RESTORE");
    const republish = await payloadRequest(`/api/procedures/${encodeURIComponent(payloadProcedureId)}?locale=ar&draft=false`, assertion, {
      method: "PATCH",
      body: JSON.stringify({ publicationState: "PUBLISHED", workflowStatus: "PUBLISHED", _status: "published" }),
    });
    expectStatus(republish, 200, "REPUBLISH");
    const restoredRead = await payloadRequest(`/api/procedures/${encodeURIComponent(payloadProcedureId)}?locale=ar&draft=false`, assertion);
    const restoredBody = expectStatus(restoredRead, 200, "RESTORED_READ");
    const restoredDoc = restoredBody.doc || restoredBody;
    if (restoredDoc._status !== "published") return fail("RESTORED_STATUS_INVALID");

    const resync = await jsonRequest(`${gatewayUrl}/api/admin/cms/payload-sync/sync`, { method: "POST", headers: authHeaders(firstToken) });
    expectStatus(resync, 200, "RESYNC");
    const restoredPublicRead = await jsonRequest(`${gatewayUrl}/api/v2/procedures/${encodeURIComponent(procedureCode)}`);
    expectStatus(restoredPublicRead, 200, "RESTORED_PUBLIC_READ");
    const webUser = await jsonRequest(`${webUserUrl}/procedures`);
    if (webUser.status !== 200 || !webUser.text.includes("root")) return fail("WEB_USER_READ_FAILED");

    console.log("PLAN_ID_ONLY_APPLY=PASS");
    console.log("ACTOR_BINDING_DENIAL=PASS");
    console.log("STALE_PLAN_REJECTION=PASS");
    console.log("PAYLOAD_DRAFT_VERSION_CAPTURE=PASS");
    console.log("SEPARATE_PUBLISH=PASS");
    console.log("GATEWAY_SYNC=PASS");
    console.log("PUBLIC_READ=PASS");
    console.log("DRAFT_PUBLISHED_SEPARATION=PASS");
    console.log("NATIVE_VERSION_RESTORE=PASS");
    console.log("REPUBLISH_RESTORED_READBACK=PASS");
    console.log("RESYNC=PASS");
    console.log("WEB_USER_READ=PASS");
    console.log("UD3_APPLY_RUNTIME_PROOF=PASS");
  } finally {
    for (const payloadProcedureId of payloadProcedureIds) {
      try {
        const sso = firstToken ? await jsonRequest(`${gatewayUrl}/api/admin/payload-sso`, { method: "POST", headers: authHeaders(firstToken) }) : null;
        const assertion = sso?.body?.assertion ? String(sso.body.assertion) : "";
        if (assertion) await payloadRequest(`/api/procedures/${encodeURIComponent(payloadProcedureId)}`, assertion, { method: "DELETE" });
      } catch { }
    }
    if (fixtureIds.length > 0) await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [fixtureIds]);
    await pool.end();
  }
}

void main().catch(() => {
  process.exitCode = 1;
});
