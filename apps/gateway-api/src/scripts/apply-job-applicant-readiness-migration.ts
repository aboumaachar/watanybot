import { readFile } from "node:fs/promises";
import { closePool, query } from "../lib/db.js";

async function main() {
  const sql = await readFile(new URL("../db/migrations/046_job_applicant_accounts_and_readiness.sql", import.meta.url), "utf8");
  await query(sql);
  console.log("JOB_APPLICANT_READINESS_MIGRATION=PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
});
