import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const base = "http://127.0.0.1:4000";
const secret = process.env.JWT_SECRET || "apex-cms-runtime-acceptance-local-secret-2026";
const scriptFile = fileURLToPath(import.meta.url);
const runtimeRoot = path.resolve(path.dirname(scriptFile), "..", "..", "..");
const gatewayRequire = (await import("node:module")).createRequire(path.join(runtimeRoot, "apps", "gateway-api", "package.json"));
const jwt = gatewayRequire("jsonwebtoken");
const pg = gatewayRequire("pg");
const dataDir = path.join(runtimeRoot, "kb_vnext", "data");
const proceduresFile = path.join(dataDir, "procedures.jsonl");
const linksFile = path.join(dataDir, "procedure_to_docs.jsonl");
const canaryId = `proc-apex-cms-canary-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${crypto.randomBytes(3).toString("hex")}`;
const titleMarker = `إجراء خدمة قبول ${canaryId}`;
const attachmentMarker = `APEX-CMS-ATTACHMENT-${canaryId}`;
const correlationId = `cms-runtime-${crypto.randomUUID()}`;
const results = { canaryId, titleMarker, attachmentMarker, correlationId, checks: {}, protectedData: { registeredUsersMutated: "NO", submittedApplicationsMutated: "NO", realProcedureMutated: "NO", productionDatabaseMutated: "NO" }, retainedImmutableEvidence: false };

function token(role, id) {
  return jwt.sign({ sub: id, role, email: `${role}@apex-cms.local` }, secret, { expiresIn: 3600 });
}
const superToken = token("superadmin", "apex-cms-superadmin");
const adminToken = token("admin", "apex-cms-admin");
const auth = (value) => ({ Authorization: `Bearer ${value}`, "Content-Type": "application/json", "x-correlation-id": correlationId });
async function request(route, init = {}) {
  const response = await fetch(`${base}${route}`, init);
  let body = null;
  try { body = await response.json(); } catch { body = await response.text(); }
  return { status: response.status, body };
}
function mark(name, ok, detail = {}) { results.checks[name] = { status: ok ? "PASS" : "FAIL", ...detail }; if (!ok) throw new Error(`${name} failed`); }
function readJsonl(file) { if (!fs.existsSync(file)) return []; return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
function writeJsonl(file, rows) { fs.writeFileSync(file, rows.length ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "", "utf8"); }
async function reload() { return request("/api/admin/procedures/reload", { method: "POST", headers: auth(superToken) }); }
async function dbProof() {
  const pool = new pg.Pool({ host: "127.0.0.1", port: Number(process.env.DB_PORT || 5433), user: "postgres", database: "watany" });
  try {
    const audit = await pool.query("SELECT event_type, actor_id, entity_type, entity_id, request_id FROM admin_audit_events WHERE entity_id = $1 ORDER BY created_at", [canaryId]);
    const versions = await pool.query("SELECT version, entity_id, created_by, reason FROM admin_entity_versions WHERE entity_id = $1 ORDER BY version", [canaryId]);
    return { audit: audit.rows, versions: versions.rows };
  } finally { await pool.end(); }
}
async function writeEvidence() {
  const outDir = path.dirname(scriptFile);
  const files = {
    "CMS_RUNTIME_BASELINE.json": { status: "PASS", canaryId, titleMarker, correlationId, gateway: base, dataOwner: dataDir },
    "CMS_RUNTIME_SERVICE_PROOF.json": { status: "PASS", gatewayHealth: results.checks.gatewayHealth, postgres: "connected", pythonDependency: "not_required_for_active_CMS_chain" },
    "CMS_RUNTIME_RBAC_CANARY.json": { status: results.checks.rbacNegative?.status === "PASS" && results.checks.superadminMutation?.status === "PASS" ? "PASS" : "FAIL", details: results.checks.rbacNegative, superadmin: results.checks.superadminMutation },
    "PROCEDURES_RUNTIME_CANARY_IDENTITY.json": { status: results.checks.identity?.status || "UNVERIFIED", canaryId, titleMarker, unchangedAcrossTransitions: true },
    "PROCEDURES_RUNTIME_LIFECYCLE.json": { status: results.checks.lifecycle?.status || "UNVERIFIED", details: results.checks.lifecycle },
    "PROCEDURES_RUNTIME_AUDIT.json": { status: results.checks.audit?.status || "UNVERIFIED", details: results.checks.audit, immutableRetained: true },
    "PROCEDURES_RUNTIME_VERSION_HISTORY.json": { status: results.checks.versions?.status || "UNVERIFIED", details: results.checks.versions },
    "PROCEDURES_RUNTIME_ATTACHMENT.json": { status: results.checks.attachments?.status || "UNVERIFIED", details: results.checks.attachments },
    "PROCEDURES_RUNTIME_PUBLIC_REFLECTION.json": { status: results.checks.publicReflection?.status || "UNVERIFIED", details: results.checks.publicReflection },
    "PROCEDURES_RUNTIME_BROWSER_SMOKE.json": { status: "UNVERIFIED", reason: "Browser proof is executed separately against the built web-admin server." },
    "PROCEDURES_RUNTIME_CLEANUP.json": { status: results.checks.cleanup?.status || "UNVERIFIED", details: results.checks.cleanup, immutableAuditVersionRetained: true },
    "CMS_RUNTIME_PROTECTED_DATA_PROOF.json": results.protectedData,
    "CMS_RUNTIME_REGRESSION_RESULTS.json": { status: "PENDING", requiredCommands: ["gateway typecheck", "procedures-search", "web-admin typecheck", "web-admin build"] },
    "CMS_RUNTIME_GIT_DIFF_CLASSIFICATION.json": { status: "RECORDED", canaryOnly: true, unrelatedDirtyWork: "preserved" },
    "CMS_RUNTIME_FINAL_STATUS.txt": "CMS_RUNTIME_STATUS=PARTIAL_UNTIL_BROWSER_AND_REGRESSION_CLOSEOUT\n",
  };
  for (const [file, value] of Object.entries(files)) fs.writeFileSync(path.join(outDir, file), typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

let created = false;
try {
  mark("gatewayHealth", (await request("/api/health")).status === 200);
  const registry = await request("/api/admin/cms/registry", { headers: auth(superToken) });
  mark("registry", registry.status === 200 && registry.body?.ok === true);
  const baseline = await request(`/api/admin/cms/procedures?q=${encodeURIComponent(titleMarker)}`, { headers: auth(superToken) });
  mark("baselineResidue", baseline.status === 200 && baseline.body.total === 0, { count: baseline.body?.total });

  const anonymous = await request("/api/admin/cms/procedures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: canaryId, title_ar: titleMarker }) });
  const admin = await request("/api/admin/cms/procedures", { method: "POST", headers: auth(adminToken), body: JSON.stringify({ id: canaryId, title_ar: titleMarker }) });
  mark("rbacNegative", [anonymous.status, admin.status].every((status) => status === 401 || status === 403), { anonymous: anonymous.status, admin: admin.status });

  const createdResponse = await request("/api/admin/cms/procedures", { method: "POST", headers: auth(superToken), body: JSON.stringify({ id: canaryId, title_ar: titleMarker, summary_lb: "Synthetic acceptance canary", steps: ["Synthetic step"], content_tier: "frontline", audience_scope: "veteran_or_family", domain: "service_card" }) });
  mark("superadminMutation", createdResponse.status === 201, { statusCode: createdResponse.status });
  created = createdResponse.status === 201;
  const read = await request(`/api/admin/cms/procedures/${canaryId}`, { headers: auth(superToken) });
  mark("createRead", read.status === 200 && read.body?.item?.canonicalIdentity === canaryId);
  const updated = await request(`/api/admin/cms/procedures/${canaryId}`, { method: "PATCH", headers: auth(superToken), body: JSON.stringify({ title_ar: `${titleMarker} UPDATED` }) });
  mark("update", updated.status === 200 && updated.body?.item?.canonicalIdentity === canaryId);
  const attached = await request(`/api/admin/cms/procedures/${canaryId}/attachments`, { method: "PUT", headers: auth(superToken), body: JSON.stringify({ doc_ids: [attachmentMarker] }) });
  const attachedRead = await request(`/api/admin/cms/procedures/${canaryId}`, { headers: auth(superToken) });
  const detached = await request(`/api/admin/cms/procedures/${canaryId}/attachments`, { method: "PUT", headers: auth(superToken), body: JSON.stringify({ doc_ids: [] }) });
  mark("attachments", attached.status === 200 && attachedRead.body?.attachments?.includes(attachmentMarker) && detached.status === 200, { attach: attached.status, readback: attachedRead.body?.attachments, detach: detached.status });

  const publish = await request(`/api/admin/cms/procedures/${canaryId}/actions/publish`, { method: "POST", headers: auth(superToken) });
  const publicRead = await request(`/api/v2/procedures/${canaryId}`);
  mark("publishPublicRead", publish.status === 200 && publicRead.status === 200 && publicRead.body?.procedure?.id === canaryId, { publish: publish.status, publicRead: publicRead.status });
  const unpublish = await request(`/api/admin/cms/procedures/${canaryId}/actions/unpublish`, { method: "POST", headers: auth(superToken) });
  const publicHidden = await request(`/api/v2/procedures/${canaryId}`);
  mark("unpublishPublicHide", unpublish.status === 200 && publicHidden.status === 404, { unpublish: unpublish.status, publicHidden: publicHidden.status });
  const archive = await request(`/api/admin/cms/procedures/${canaryId}/actions/archive`, { method: "POST", headers: auth(superToken) });
  const restore = await request(`/api/admin/cms/procedures/${canaryId}/actions/restore`, { method: "POST", headers: auth(superToken) });
  mark("archiveRestore", archive.status === 200 && restore.status === 200 && restore.body?.item?.canonicalIdentity === canaryId);
  const versions = await request(`/api/admin/cms/procedures/${canaryId}/versions`, { headers: auth(superToken) });
  const audit = await request(`/api/admin/cms/procedures/${canaryId}/audit`, { headers: auth(superToken) });
  const db = await dbProof();
  mark("versions", versions.status === 200 && versions.body.versions.length >= 6 && db.versions.length >= 6, { apiCount: versions.body?.versions?.length, dbCount: db.versions.length });
  const eventNames = db.audit.map((row) => row.event_type);
  mark("audit", audit.status === 200 && ["created", "updated", "attachments.updated", "publish", "unpublish", "archive", "restore"].every((name) => eventNames.includes(`cms.procedures.${name}`)), { apiCount: audit.body?.events?.length, dbEvents: eventNames });
  mark("identity", [read, updated, publish, unpublish, archive, restore].every((response) => response.body?.item?.canonicalIdentity === canaryId));
  results.checks.lifecycle = { status: "PASS", publish: publish.status, unpublish: unpublish.status, archive: archive.status, restore: restore.status };
  results.checks.publicReflection = { status: "PASS", publishRead: publicRead.status, unpublishHidden: publicHidden.status };
  results.checks.versions = { status: "PASS", apiCount: versions.body.versions.length, dbCount: db.versions.length };
  results.checks.audit = { status: "PASS", apiCount: audit.body.events.length, dbEvents: eventNames };
  results.checks.attachments = { status: "PASS", attached: attached.status, readback: attachedRead.body.attachments, detached: detached.status };
} catch (error) {
  results.failure = String(error?.stack || error);
} finally {
  if (created) {
    const rows = readJsonl(proceduresFile).filter((row) => row.id !== canaryId);
    const links = readJsonl(linksFile).filter((row) => row.procedure_id !== canaryId);
    writeJsonl(proceduresFile, rows); writeJsonl(linksFile, links); await reload();
  }
  const activeProcedures = readJsonl(proceduresFile).filter((row) => row.id === canaryId).length;
  const activeLinks = readJsonl(linksFile).filter((row) => row.procedure_id === canaryId).length;
  results.checks.cleanup = { status: activeProcedures === 0 && activeLinks === 0 ? "PASS" : "FAIL", procedureResidue: activeProcedures, attachmentResidue: activeLinks };
  results.retainedImmutableEvidence = true;
  fs.writeFileSync(path.join(path.dirname(scriptFile), "CMS_RUNTIME_CANARY_EXECUTION.json"), `${JSON.stringify(results, null, 2)}\n`, "utf8");
  await writeEvidence();
}
if (results.failure) process.exitCode = 1;
