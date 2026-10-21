import type { FastifyInstance, FastifyRequest } from "fastify";
import { query } from "../lib/db.js";

function userOf(request: FastifyRequest): any {
  return (request as any).user ?? null;
}

function requireUser(request: FastifyRequest) {
  const user = userOf(request);
  if (!user?.id) {
    const error: any = new Error("AUTH_REQUIRED");
    error.statusCode = 401;
    throw error;
  }
  return user;
}

function isAdmin(user: any) {
  const role = String(user?.role ?? "").toLowerCase();
  return role === "admin" || role === "superadmin";
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean).slice(0, 50) : [];
}

async function employerAllowed(user: any) {
  if (isAdmin(user)) return true;
  const result = await query("SELECT 1 FROM job_employer_accounts WHERE user_id=$1 AND status='APPROVED' LIMIT 1", [user.id]);
  return (result.rowCount ?? 0) > 0;
}
export async function registerJobReadinessRoutes(app: FastifyInstance) {
  app.post("/api/jobs/readiness", async (request, reply) => {
    const user = requireUser(request);
    const body = (request.body ?? {}) as any;
    const jobType = String(body.jobType ?? "").trim();
    const title = String(body.title ?? "").trim();
    if (!jobType || !title) return reply.code(400).send({ error: "MISSING_REQUIRED_FIELD" });
    const result = await query(`
      INSERT INTO job_readiness_requests (
        user_id,job_type,title,summary,skills,work_modes,governorate,caza,locality,
        available_from,expected_salary,contact_visibility
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      user.id, jobType, title, body.summary ? String(body.summary).trim() : null,
      list(body.skills), list(body.workModes),
      body.governorate ? String(body.governorate).trim() : null,
      body.caza ? String(body.caza).trim() : null,
      body.locality ? String(body.locality).trim() : null,
      body.availableFrom || null,
      body.expectedSalary ? String(body.expectedSalary).trim() : null,
      body.contactVisibility === "HIDDEN" ? "HIDDEN" : "REGISTERED_EMPLOYERS",
    ]);
    return reply.code(201).send({ ok: true, item: result.rows[0] });
  });

  app.get("/api/jobs/readiness/mine", async (request) => {
    const user = requireUser(request);
    const result = await query("SELECT * FROM job_readiness_requests WHERE user_id=$1 ORDER BY created_at DESC", [user.id]);
    return { ok: true, items: result.rows };
  });

  app.get("/api/jobs/applications/mine/prefill", async (request) => {
    const user = requireUser(request);
    const result = await query(`
      WITH snapshots AS (
        SELECT l.application_id,l.campaign_id,'???? ?????? ?? ??????'::text AS label,
               s.name,s.phone,s.email,s.age,s.governorate,s.caza,s.village,s.village_id,s.created_at
        FROM job_application_user_links l
        JOIN seasonal_apple_job_applications s ON s.id=l.application_id
        WHERE l.user_id=$1 AND l.campaign_id='seasonal-apple-job-2026-tannourine'
        UNION ALL
        SELECT l.application_id,l.campaign_id,'????? ???? ???? ? ??? ???????'::text AS label,
               m.name,m.phone,m.email,m.age,m.governorate,m.caza,m.village,m.village_id,m.created_at
        FROM job_application_user_links l
        JOIN ain_mreisseh_building_assistant_applications m ON m.id=l.application_id
        WHERE l.user_id=$1 AND l.campaign_id='ain-mreisseh-building-assistant'
      )
      SELECT * FROM snapshots ORDER BY created_at DESC LIMIT 20
    `, [user.id]);
    return { ok: true, items: result.rows.map((row: any) => ({
      applicationId: row.application_id, campaignId: row.campaign_id, label: row.label,
      name: row.name, phone: row.phone, email: row.email, age: row.age, createdAt: row.created_at,
      address: { mohafaza: row.governorate, qaza: row.caza, village: row.village,
        localityId: row.village_id, displayAddress: [row.village,row.caza,row.governorate].filter(Boolean).join("? ") },
    })) };
  });

  app.get("/api/jobs/applications/mine", async (request) => {
    const user = requireUser(request);
    const result = await query(`
      WITH items AS (
        SELECT l.application_id,l.campaign_id,'قطاف التفاح في تنورين'::text AS label,
               s.name,s.phone,s.email,s.status,s.follow_up_status,s.created_at,s.updated_at,
               s.governorate,s.caza,s.village,'/jobs/ainelhafeh'::text AS application_href
        FROM job_application_user_links l
        JOIN seasonal_apple_job_applications s ON s.id=l.application_id
        WHERE l.user_id=$1 AND l.campaign_id='seasonal-apple-job-2026-tannourine'
        UNION ALL
        SELECT l.application_id,l.campaign_id,'مساعد مبنى - عين المريسة'::text AS label,
               m.name,m.phone,m.email,m.status,m.follow_up_status,m.created_at,m.updated_at,
               m.governorate,m.caza,m.village,'/jobs/ain-mreisseh-building-assistant'::text AS application_href
        FROM job_application_user_links l
        JOIN ain_mreisseh_building_assistant_applications m ON m.id=l.application_id
        WHERE l.user_id=$1 AND l.campaign_id='ain-mreisseh-building-assistant'
      ) SELECT * FROM items ORDER BY created_at DESC
    `, [user.id]);
    return { ok: true, items: result.rows.map((row: any) => ({
      applicationId: row.application_id, campaignId: row.campaign_id, label: row.label,
      name: row.name, phone: row.phone, email: row.email, status: row.status,
      followUpStatus: row.follow_up_status, createdAt: row.created_at, updatedAt: row.updated_at,
      location: [row.village,row.caza,row.governorate].filter(Boolean).join("، "),
      applicationHref: row.application_href,
    })) };
  });

  app.get("/api/jobs/admin/applications", async (request, reply) => {
    const reviewer = requireUser(request);
    if (!isAdmin(reviewer)) return reply.code(403).send({ error: "FORBIDDEN" });
    const q = (request.query ?? {}) as any;
    const campaign = String(q.campaign ?? "").trim();
    const status = String(q.status ?? "").trim().toLowerCase();
    const search = String(q.q ?? "").trim();
    const result = await query(`
      WITH items AS (
        SELECT l.user_id,l.application_id,l.campaign_id,'قطاف التفاح في تنورين'::text AS label,
               s.name,s.phone,s.email,s.age,s.status,s.follow_up_status,s.admin_notes,s.created_at,s.updated_at,
               s.governorate,s.caza,s.village,'/superadmin/ainelhafeh/applications'::text AS admin_href
        FROM job_application_user_links l
        JOIN seasonal_apple_job_applications s ON s.id=l.application_id
        WHERE l.campaign_id='seasonal-apple-job-2026-tannourine'
        UNION ALL
        SELECT l.user_id,l.application_id,l.campaign_id,'مساعد مبنى - عين المريسة'::text AS label,
               m.name,m.phone,m.email,m.age,m.status,m.follow_up_status,m.admin_notes,m.created_at,m.updated_at,
               m.governorate,m.caza,m.village,'/superadmin/ain-mreisseh-building-assistant/applications'::text AS admin_href
        FROM job_application_user_links l
        JOIN ain_mreisseh_building_assistant_applications m ON m.id=l.application_id
        WHERE l.campaign_id='ain-mreisseh-building-assistant'
      )
      SELECT * FROM items
      WHERE ($1='' OR campaign_id=$1)
        AND ($2='' OR lower(status)=$2)
        AND ($3='' OR name ILIKE '%'||$3||'%' OR phone ILIKE '%'||$3||'%'
             OR COALESCE(email,'') ILIKE '%'||$3||'%' OR application_id ILIKE '%'||$3||'%')
      ORDER BY created_at DESC LIMIT 250
    `, [campaign, status, search]);
    return { ok: true, items: result.rows.map((row: any) => ({
      userId: row.user_id, applicationId: row.application_id, campaignId: row.campaign_id,
      label: row.label, name: row.name, phone: row.phone, email: row.email, age: row.age,
      status: row.status, followUpStatus: row.follow_up_status, adminNotes: row.admin_notes,
      createdAt: row.created_at, updatedAt: row.updated_at,
      location: [row.village,row.caza,row.governorate].filter(Boolean).join("، "),
      adminHref: row.admin_href,
    })) };
  });

  app.patch("/api/jobs/readiness/:id/status", async (request, reply) => {
    const user = requireUser(request);
    const id = String((request.params as any).id ?? "");
    const status = String((request.body as any)?.status ?? "").toUpperCase();
    if (!["ACTIVE","PAUSED","CLOSED"].includes(status)) return reply.code(400).send({ error: "INVALID_STATUS" });
    const result = await query(`
      UPDATE job_readiness_requests SET status=$3, updated_at=NOW()
      WHERE id=$1 AND user_id=$2 RETURNING *
    `, [id, user.id, status]);
    if (!(result.rowCount ?? 0)) return reply.code(404).send({ error: "NOT_FOUND" });
    return { ok: true, item: result.rows[0] };
  });

  app.post("/api/jobs/employer-access/request", async (request, reply) => {
    const user = requireUser(request);
    const organizationName = String((request.body as any)?.organizationName ?? "").trim();
    if (!organizationName) return reply.code(400).send({ error: "ORGANIZATION_REQUIRED" });
    const result = await query(`
      INSERT INTO job_employer_accounts (user_id,organization_name,status,requested_at)
      VALUES ($1,$2,'PENDING',NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        organization_name=EXCLUDED.organization_name,
        status=CASE WHEN job_employer_accounts.status='APPROVED' THEN 'APPROVED' ELSE 'PENDING' END,
        requested_at=NOW()
      RETURNING user_id,organization_name,status,requested_at,reviewed_at
    `, [user.id, organizationName]);
    return reply.code(201).send({ ok: true, item: result.rows[0] });
  });

  app.get("/api/jobs/employer-access/me", async (request) => {
    const user = requireUser(request);
    const result = await query(`
      SELECT user_id,organization_name,status,requested_at,reviewed_at
      FROM job_employer_accounts WHERE user_id=$1
    `, [user.id]);
    return { ok: true, item: result.rows[0] ?? null };
  });

  app.get("/api/jobs/admin/summary", async (request, reply) => {
    const reviewer = requireUser(request);
    if (!isAdmin(reviewer)) return reply.code(403).send({ error: "FORBIDDEN" });
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM job_application_user_links)::int AS linked_applications,
        (SELECT COUNT(DISTINCT user_id) FROM job_application_user_links)::int AS linked_applicants,
        (SELECT COUNT(*) FROM job_readiness_requests WHERE status='ACTIVE')::int AS active_candidates,
        (SELECT COUNT(*) FROM job_employer_accounts WHERE status='PENDING')::int AS pending_employers,
        (SELECT COUNT(*) FROM job_employer_accounts WHERE status='APPROVED')::int AS approved_employers
    `);
    return { ok: true, summary: result.rows[0] };
  });

  app.get("/api/jobs/employer-access/admin", async (request, reply) => {
    const reviewer = requireUser(request);
    if (!isAdmin(reviewer)) return reply.code(403).send({ error: "FORBIDDEN" });
    const status = String((request.query as any)?.status ?? "PENDING").toUpperCase();
    if (!["PENDING","APPROVED","REJECTED","SUSPENDED"].includes(status))
      return reply.code(400).send({ error: "INVALID_STATUS" });
    const result = await query(`
      SELECT e.user_id,e.organization_name,e.status,e.requested_at,e.reviewed_at,
             COALESCE(NULLIF(u.full_name,''),NULLIF(u.name,'')) AS account_name,u.email
      FROM job_employer_accounts e JOIN users u ON u.id=e.user_id
      WHERE e.status=$1 ORDER BY e.requested_at ASC
    `, [status]);
    return { ok: true, items: result.rows };
  });

  app.patch("/api/jobs/employer-access/:userId/status", async (request, reply) => {
    const reviewer = requireUser(request);
    if (!isAdmin(reviewer)) return reply.code(403).send({ error: "FORBIDDEN" });
    const userId = String((request.params as any).userId ?? "");
    const body = (request.body ?? {}) as any;
    const status = String(body.status ?? "").toUpperCase();
    if (!["PENDING","APPROVED","REJECTED","SUSPENDED"].includes(status))
      return reply.code(400).send({ error: "INVALID_STATUS" });
    const result = await query(`
      UPDATE job_employer_accounts
      SET status=$2, reviewed_at=NOW(), reviewed_by=$3, note=$4
      WHERE user_id=$1
      RETURNING user_id,organization_name,status,requested_at,reviewed_at
    `, [userId, status, reviewer.id, body.note ? String(body.note).trim() : null]);
    if (!(result.rowCount ?? 0)) return reply.code(404).send({ error: "NOT_FOUND" });
    return { ok: true, item: result.rows[0] };
  });

  app.get("/api/jobs/candidates/search", async (request, reply) => {
    const user = requireUser(request);
    if (!(await employerAllowed(user))) return reply.code(403).send({ error: "APPROVED_EMPLOYER_REQUIRED" });
    const q = (request.query ?? {}) as any;
    const search = String(q.q ?? "").trim();
    const jobType = String(q.jobType ?? "").trim();
    const governorate = String(q.governorate ?? "").trim();
    const workMode = String(q.workMode ?? "").trim();
    const result = await query(`
      SELECT r.id,r.job_type,r.title,r.summary,r.skills,r.work_modes,r.governorate,r.caza,r.locality,
             r.available_from,r.expected_salary,r.created_at,u.id AS user_id,
             COALESCE(NULLIF(u.full_name,''),NULLIF(u.name,'')) AS candidate_name,
             CASE WHEN r.contact_visibility='REGISTERED_EMPLOYERS'
                  THEN COALESCE(NULLIF(u.phone_number,''),NULLIF(u.phone,'')) ELSE NULL END AS phone,
             CASE WHEN r.contact_visibility='REGISTERED_EMPLOYERS' AND u.email NOT LIKE '%@accounts.koudama.local'
                  THEN u.email ELSE NULL END AS email
      FROM job_readiness_requests r JOIN users u ON u.id=r.user_id
      WHERE r.status='ACTIVE'
        AND ($1='' OR r.job_type ILIKE '%'||$1||'%')
        AND ($2='' OR COALESCE(r.governorate,'') ILIKE '%'||$2||'%')
        AND ($3='' OR $3=ANY(r.work_modes))
        AND ($4='' OR r.title ILIKE '%'||$4||'%' OR COALESCE(r.summary,'') ILIKE '%'||$4||'%'
             OR COALESCE(array_to_string(r.skills,' '),'') ILIKE '%'||$4||'%'
             OR COALESCE(u.full_name,u.name,'') ILIKE '%'||$4||'%')
      ORDER BY r.updated_at DESC,r.created_at DESC LIMIT 100
    `, [jobType, governorate, workMode, search]);
    return { ok: true, items: result.rows };
  });
}
