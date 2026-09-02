import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "../lib/db.js";
import {
  getAinMreissehBuildingAssistantApplication,
  listAinMreissehBuildingAssistantApplicationHistory,
  updateAinMreissehBuildingAssistantApplication,
} from "../koudama/surveys/ain-mreisseh-building-assistant/ainMreissehBuildingAssistant.repository.js";
import { closePool } from "../lib/db.js";
import { ensureAdminAuthorityTables } from "../admin-authority/adminAuthorityStore.js";

const runIntegration = Boolean(process.env.APEX_WAVE5A_DATABASE_URL);
const applicationId = "W5A-INTEGRATION-001";
const actorId = "W5A_SUPERADMIN";
const entityType = "jobs.ain_mreisseh.application";

describe.runIf(runIntegration)("Ain Mreisseh real PostgreSQL mutation consistency", () => {
  beforeAll(async () => {
    await ensureAdminAuthorityTables();
    await query("DELETE FROM admin_audit_events WHERE entity_id = $1", [applicationId]);
    await query("DELETE FROM admin_entity_versions WHERE entity_id = $1", [applicationId]);
    await query("DELETE FROM ain_mreisseh_building_assistant_applications WHERE id = $1", [applicationId]);
    await query(
      `INSERT INTO ain_mreisseh_building_assistant_applications
       (id, campaign_id, name, phone, age, email, governorate, governorate_ar, caza, caza_ar, village, village_ar, village_id,
        can_work_full_time, accepts_salary_600, wants_housing, available_start_date)
       VALUES ($1, 'ain-mreisseh-building-assistant', 'Wave5A Applicant 001', '+96170000001', '35', 'wave5a-001@synthetic.local',
        'Akkar', 'عكار', 'Akkar', 'عكار', 'Al Aboudieh', 'العبودية', 'LB-LOC-35249', true, true, false, '2026-07-01')`,
      [applicationId],
    );
  });

  afterAll(async () => {
    await query("DROP TRIGGER IF EXISTS w5a_force_history_failure ON admin_audit_events");
    await query("DROP FUNCTION IF EXISTS w5a_force_history_failure()");
    await query("DELETE FROM admin_audit_events WHERE entity_id = $1", [applicationId]);
    await query("DELETE FROM admin_entity_versions WHERE entity_id = $1", [applicationId]);
    await query("DELETE FROM ain_mreisseh_building_assistant_applications WHERE id = $1", [applicationId]);
    await closePool();
  });

  it("persists status, follow-up, and notes mutations with matching history", async () => {
    let item = await getAinMreissehBuildingAssistantApplication(applicationId);
    expect(item).not.toBeNull();
    item = await updateAinMreissehBuildingAssistantApplication(applicationId, { status: "approved", expectedUpdatedAt: item!.updatedAt }, actorId);
    item = await updateAinMreissehBuildingAssistantApplication(applicationId, { followUpStatus: "to_contact", expectedUpdatedAt: item!.updatedAt }, actorId);
    item = await updateAinMreissehBuildingAssistantApplication(applicationId, { adminNotes: "Synthetic follow-up note", expectedUpdatedAt: item!.updatedAt }, actorId);
    const history = await listAinMreissehBuildingAssistantApplicationHistory(applicationId);
    expect(history.map((entry) => entry.eventType)).toEqual(["MANAGEMENT_UPDATED", "MANAGEMENT_UPDATED", "MANAGEMENT_UPDATED", "SUBMITTED"]);
    const audit = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_audit_events WHERE entity_type = $1 AND entity_id = $2 AND actor_id = $3", [entityType, applicationId, actorId]);
    const versions = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_entity_versions WHERE entity_type = $1 AND entity_id = $2 AND created_by = $3", [entityType, applicationId, actorId]);
    expect(Number(audit.rows[0].count)).toBe(3);
    expect(Number(versions.rows[0].count)).toBe(3);
    expect(item!.status).toBe("approved");
    expect(item!.followUpStatus).toBe("to_contact");
    expect(item!.adminNotes).toBe("Synthetic follow-up note");
  });

  it("rolls back application and history when audit persistence fails", async () => {
    const before = await getAinMreissehBuildingAssistantApplication(applicationId);
    const beforeAudit = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_audit_events WHERE entity_id = $1", [applicationId]);
    const beforeVersions = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_entity_versions WHERE entity_id = $1", [applicationId]);
    await query(`CREATE OR REPLACE FUNCTION w5a_force_history_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'W5A_FORCED_HISTORY_FAILURE'; END; $$`);
    await query("CREATE TRIGGER w5a_force_history_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION w5a_force_history_failure()");
    await expect(updateAinMreissehBuildingAssistantApplication(applicationId, { status: "rejected", expectedUpdatedAt: before!.updatedAt }, actorId)).rejects.toThrow("W5A_FORCED_HISTORY_FAILURE");
    await query("DROP TRIGGER w5a_force_history_failure ON admin_audit_events");
    const after = await getAinMreissehBuildingAssistantApplication(applicationId);
    const afterAudit = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_audit_events WHERE entity_id = $1", [applicationId]);
    const afterVersions = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_entity_versions WHERE entity_id = $1", [applicationId]);
    expect(after).toMatchObject({ status: before!.status, updatedAt: before!.updatedAt });
    expect(afterAudit.rows[0].count).toBe(beforeAudit.rows[0].count);
    expect(afterVersions.rows[0].count).toBe(beforeVersions.rows[0].count);
  });
});