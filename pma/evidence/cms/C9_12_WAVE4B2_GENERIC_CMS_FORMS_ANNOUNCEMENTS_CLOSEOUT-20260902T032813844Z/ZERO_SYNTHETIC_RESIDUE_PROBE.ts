import { query, closePool } from "../../../../apps/gateway-api/src/lib/db.ts";

(async () => {
    const publicIdPattern = "apex-c%";
    const actorPattern = "superadmin-apex-c%";
    const entities = await query("SELECT count(*)::int AS count FROM cms_content_entities WHERE public_id ILIKE $1", [publicIdPattern]);
    const relationships = await query("SELECT count(*)::int AS count FROM cms_content_relationships r JOIN cms_content_entities e ON e.id = r.entity_id WHERE e.public_id ILIKE $1", [publicIdPattern]);
    const audits = await query("SELECT count(*)::int AS count FROM admin_audit_events WHERE entity_id ILIKE $1 OR actor_id ILIKE $1 OR actor_id ILIKE $2", [publicIdPattern, actorPattern]);
    const versions = await query("SELECT count(*)::int AS count FROM admin_entity_versions WHERE entity_id ILIKE $1 OR created_by ILIKE $1 OR created_by ILIKE $2", [publicIdPattern, actorPattern]);
    console.log(JSON.stringify({ entities: entities.rows[0].count, relationships: relationships.rows[0].count, audits: audits.rows[0].count, versions: versions.rows[0].count }));
    await closePool();
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});