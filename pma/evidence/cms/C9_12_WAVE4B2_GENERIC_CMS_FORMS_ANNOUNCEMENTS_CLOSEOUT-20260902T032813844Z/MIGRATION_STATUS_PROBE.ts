import { query, closePool } from "../../../../apps/gateway-api/src/lib/db.ts";

(async () => {
    const rows = await query("SELECT name FROM _migrations WHERE name = $1", ["037_generic_cms_review_ready.sql"]);
    console.log(JSON.stringify({ migration: "037_generic_cms_review_ready.sql", applied: rows.rowCount === 1 }));
    await closePool();
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});