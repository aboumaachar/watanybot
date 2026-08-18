import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import Fastify from "fastify";
import pg from "pg";
import { jobsRoutes } from "../jobs/routes.js";
import { PostgresMarketplaceJobApplicationsRepository } from "../jobs/repository.js";
import { registerCivilianJobsRoutes } from "../civilian-jobs/civilian-jobs.routes.js";
import { PostgresCivilianJobsRepository } from "../civilian-jobs/civilian-jobs.repository.js";

const port = Number(process.env.APEX_V119_PROOF_PORT || "55219");
const baseUrl = `http://127.0.0.1:${port}`;
const tsx = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
const script = path.resolve(process.cwd(), "apps/gateway-api/src/scripts/apex-v119-process-restart-proof.ts");

async function serve() {
  const app = Fastify({ logger: false });
  const marketplace = new PostgresMarketplaceJobApplicationsRepository();
  const civilian = new PostgresCivilianJobsRepository();
  await app.register(jobsRoutes, { applicationsRepository: marketplace });
  await app.register(registerCivilianJobsRoutes, { repository: civilian });
  app.get("/__apex/health", async () => ({ ok: true }));
  app.get("/__apex/proof/state", async () => ({
    marketplace: await marketplace.listByPhone("70000021"),
    civilian: await civilian.listApplications(),
  }));
  await app.listen({ host: "127.0.0.1", port });
  process.on("SIGTERM", async () => { await app.close(); process.exit(0); });
}

async function waitForHealth(child: ChildProcess) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/__apex/health`);
      if (response.ok) return;
    } catch { /* process is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`proof process did not become healthy (pid=${child.pid})`);
}

async function stop(child: ChildProcess) {
  child.kill("SIGTERM");
  const [code] = await once(child, "exit") as [number | null, string | null];
  if (code !== 0 && code !== null) throw new Error(`proof process exited ${String(code)}`);
}

async function request(pathname: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function prove() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("DELETE FROM civilian_job_applications WHERE opportunity_id = $1", ["opp-demo-security-supervisor"]);
  await pool.query("DELETE FROM marketplace_job_applications WHERE phone = $1", ["70000021"]);
  await pool.query(
    `INSERT INTO civilian_job_opportunities (id, type, status, title, organization)
     VALUES ($1, 'PAID_JOB', 'PUBLISHED', 'Security Supervisor', 'Restart proof fixture')
     ON CONFLICT (id) DO UPDATE SET status = 'PUBLISHED'`,
    ["opp-demo-security-supervisor"],
  );
  await pool.end();
  const env = { ...process.env, APEX_V119_PROOF_SERVER: "1" };
  const start = () => spawn(process.execPath, [tsx, script], { env, stdio: ["ignore", "pipe", "pipe"] });
  const first = start();
  await waitForHealth(first);
  const civilian = await request("/api/opportunities/opp-demo-security-supervisor/apply", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ applicantName: "Restart Proof Civilian", applicantPhone: "70000022", applicantType: "VETERAN" }),
  });
  const marketplace = await request("/api/v2/jobs/job_v2_001/apply", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Restart Proof Marketplace", phone: "70000021" }),
  });
  await stop(first);
  const second = start();
  await waitForHealth(second);
  const state = await request("/__apex/proof/state");
  await stop(second);
  const civilianId = (civilian.item as { id: string }).id;
  const marketplaceId = (marketplace.application as { id: string }).id;
  const civilianRows = state.civilian as Array<{ id: string }>;
  const marketplaceRows = state.marketplace as Array<{ id: string }>;
  if (civilianRows.length !== 1 || civilianRows[0].id !== civilianId) throw new Error("civilian restart continuity failed");
  if (marketplaceRows.length !== 1 || marketplaceRows[0].id !== marketplaceId) throw new Error("marketplace restart continuity failed");
  console.log("PROCESS_A_EXIT=0");
  console.log("PROCESS_B_EXIT=0");
  console.log("CIVILIAN_ID_PRESERVED=PASS");
  console.log("MARKETPLACE_ID_PRESERVED=PASS");
  console.log("APPLICATION_CARDINALITY=1");
}

if (process.env.APEX_V119_PROOF_SERVER === "1") {
  await serve();
} else {
  await prove();
}