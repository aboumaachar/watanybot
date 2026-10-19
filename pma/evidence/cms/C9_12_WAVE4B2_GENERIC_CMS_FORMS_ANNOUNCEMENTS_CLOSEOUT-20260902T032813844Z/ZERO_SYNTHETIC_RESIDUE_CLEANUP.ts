import { getClient, closePool } from "../../../../apps/gateway-api/src/lib/db.ts";

(async () => {
    const publicIdPattern = "apex-c%";
    const actorPattern = "superadmin-apex-c%";
    const legacyActor = "apex-cms-superadmin";
    const client = await getClient();
    try {
        await client.query("BEGIN");
        const relationships = await client.query("DELETE FROM cms_content_relationships WHERE entity_id IN (SELECT id FROM cms_content_entities WHERE public_id ILIKE $1)", [publicIdPattern]);
        const entities = await client.query("DELETE FROM cms_content_entities WHERE public_id ILIKE $1", [publicIdPattern]);
        const audits = await client.query("DELETE FROM admin_audit_events WHERE entity_id ILIKE $1 OR actor_id ILIKE $1 OR actor_id ILIKE $2 OR actor_id = $3", [publicIdPattern, actorPattern, legacyActor]);
        const versions = await client.query("DELETE FROM admin_entity_versions WHERE entity_id ILIKE $1 OR created_by ILIKE $1 OR created_by ILIKE $2 OR created_by = $3", [publicIdPattern, actorPattern, legacyActor]);
        await client.query("COMMIT");
        console.log(JSON.stringify({ committed: true, deleted: { entities: entities.rowCount, relationships: relationships.rowCount, audits: audits.rowCount, versions: versions.rowCount } }));
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await closePool();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});