import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { getClient, query } from "../lib/db.js";

type JobField = {
  fieldKey: string;
  label: string;
  fieldType: "text" | "textarea" | "number" | "email" | "tel" | "date" | "select" | "radio" | "checkbox";
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string[];
  sortOrder: number;
};

const postingStatuses = ["DRAFT","PUBLISHED","CLOSED","ARCHIVED"] as const;
const applicationStatuses = ["SUBMITTED","SCREENING","CONTACTED","SHORTLISTED","INTERVIEW","ACCEPTED","REJECTED","WITHDRAWN"] as const;
const fieldTypes = ["text","textarea","number","email","tel","date","select","radio","checkbox"] as const;

function userOf(request: FastifyRequest): any { return (request as any).user ?? null; }
function requireUser(request: FastifyRequest) {
  const user = userOf(request);
  if (!user?.id) { const error: any = new Error("AUTH_REQUIRED"); error.statusCode = 401; throw error; }
  return user;
}
function isAdmin(user: any) { const role = String(user?.role ?? "").toLowerCase(); return role === "admin" || role === "superadmin"; }
function clean(value: unknown, max = 5000) { return String(value ?? "").trim().slice(0, max); }
function normalizeSlug(value: unknown) { return clean(value, 100).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-"); }
function normalizeFields(value: unknown): JobField[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 40).map((raw: any, index) => {
    const fieldKey = clean(raw?.fieldKey, 64).replace(/[^A-Za-z0-9_]/g, "_");
    const label = clean(raw?.label, 160);
    const fieldType = fieldTypes.includes(raw?.fieldType) ? raw.fieldType : "text";
    if (!fieldKey || !label || seen.has(fieldKey)) { const error: any = new Error("INVALID_FORM_FIELD"); error.statusCode = 400; throw error; }
    seen.add(fieldKey);
    return {
      fieldKey, label, fieldType,
      required: Boolean(raw?.required),
      placeholder: clean(raw?.placeholder, 200) || null,
      helpText: clean(raw?.helpText, 300) || null,
      options: Array.isArray(raw?.options) ? raw.options.map((x: unknown) => clean(x, 120)).filter(Boolean).slice(0, 30) : [],
      sortOrder: index,
    };
  });
}

async function employerAccount(userId: string) {
  const result = await query<{ organization_name: string; status: string }>(
    "SELECT organization_name,status FROM job_employer_accounts WHERE user_id=$1 LIMIT 1", [userId]);
  return result.rows[0] ?? null;
}
async function requireEmployer(user: any) {
  if (isAdmin(user)) return { organizationName: "موطني", admin: true };
  const account = await employerAccount(user.id);
  if (!account || account.status !== "APPROVED") { const error: any = new Error("APPROVED_EMPLOYER_REQUIRED"); error.statusCode = 403; throw error; }
  return { organizationName: account.organization_name, admin: false };
}
async function ownedJob(user: any, jobId: string) {
  const result = await query<any>(`SELECT * FROM job_postings WHERE id=$1 LIMIT 1`, [jobId]);
  const job = result.rows[0];
  if (!job) return null;
  if (!isAdmin(user) && job.owner_user_id !== user.id) { const error: any = new Error("FORBIDDEN"); error.statusCode = 403; throw error; }
  return job;
}

async function replaceFields(client: any, jobId: string, fields: JobField[]) {
  await client.query("DELETE FROM job_posting_form_fields WHERE job_posting_id=$1", [jobId]);
  for (const field of fields) {
    await client.query(`INSERT INTO job_posting_form_fields
      (job_posting_id,field_key,label,field_type,required,placeholder,help_text,options,sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [
      jobId, field.fieldKey, field.label, field.fieldType, field.required,
      field.placeholder, field.helpText, JSON.stringify(field.options), field.sortOrder,
    ]);
  }
}

async function loadFields(jobId: string) {
  const result = await query<any>(`SELECT id,field_key,label,field_type,required,placeholder,help_text,options,sort_order
    FROM job_posting_form_fields WHERE job_posting_id=$1 ORDER BY sort_order,id`, [jobId]);
  return result.rows.map((row: any) => ({
    id: row.id, fieldKey: row.field_key, label: row.label, fieldType: row.field_type,
    required: row.required, placeholder: row.placeholder, helpText: row.help_text,
    options: Array.isArray(row.options) ? row.options : [], sortOrder: row.sort_order,
  }));
}
export async function registerJobTemplateBuilderRoutes(app: FastifyInstance) {
  app.post("/api/jobs/builder/jobs", async (request, reply) => {
    const user = requireUser(request);
    const access = await requireEmployer(user);
    const body = (request.body ?? {}) as any;
    const title = clean(body.title, 200);
    if (!title) return reply.code(400).send({ error: "TITLE_REQUIRED" });
    let ownerUserId = user.id;
    let organizationName = access.organizationName;
    if (isAdmin(user) && clean(body.ownerUserId, 64)) {
      const target = await employerAccount(clean(body.ownerUserId, 64));
      if (!target || target.status !== "APPROVED") return reply.code(400).send({ error: "OWNER_EMPLOYER_NOT_APPROVED" });
      ownerUserId = clean(body.ownerUserId, 64);
      organizationName = target.organization_name;
    } else if (isAdmin(user) && clean(body.organizationName, 200)) {
      organizationName = clean(body.organizationName, 200);
    }
    const fields = normalizeFields(body.fields);
    const slug = normalizeSlug(body.slug) || `job-${randomUUID().slice(0, 8)}`;
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const created = await client.query<any>(`INSERT INTO job_postings
        (owner_user_id,created_by_user_id,organization_name,title,slug,summary,description,employment_type,work_mode,governorate,caza,locality,salary_text,closes_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [
        ownerUserId,user.id,organizationName,title,slug,clean(body.summary,800) || null,clean(body.description,10000) || null,
        clean(body.employmentType,80) || null,clean(body.workMode,80) || null,clean(body.governorate,120) || null,
        clean(body.caza,120) || null,clean(body.locality,160) || null,clean(body.salaryText,160) || null,body.closesAt || null,
      ]);
      await replaceFields(client, created.rows[0].id, fields);
      await client.query("COMMIT");
      return reply.code(201).send({ ok: true, item: { ...created.rows[0], fields } });
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error?.code === "23505") return reply.code(409).send({ error: "SLUG_ALREADY_EXISTS" });
      throw error;
    } finally { client.release(); }
  });

  app.get("/api/jobs/builder/jobs/mine", async (request) => {
    const user = requireUser(request);
    await requireEmployer(user);
    const result = await query<any>(`SELECT p.*,
      (SELECT COUNT(*)::int FROM job_posting_applications a WHERE a.job_posting_id=p.id) AS application_count
      FROM job_postings p
      WHERE ($1::boolean OR p.owner_user_id=$2)
      ORDER BY p.updated_at DESC,p.created_at DESC`, [isAdmin(user), user.id]);
    return { ok: true, items: result.rows };
  });

  app.get("/api/jobs/builder/jobs/:id/manage", async (request, reply) => {
    const user = requireUser(request);
    await requireEmployer(user);
    const id = clean((request.params as any).id, 64);
    const job = await ownedJob(user, id);
    if (!job) return reply.code(404).send({ error: "NOT_FOUND" });
    return { ok: true, item: { ...job, fields: await loadFields(id) } };
  });

  app.put("/api/jobs/builder/jobs/:id", async (request, reply) => {
    const user = requireUser(request);
    await requireEmployer(user);
    const id = clean((request.params as any).id, 64);
    const existing = await ownedJob(user, id);
    if (!existing) return reply.code(404).send({ error: "NOT_FOUND" });
    const body = (request.body ?? {}) as any;
    const title = clean(body.title, 200);
    if (!title) return reply.code(400).send({ error: "TITLE_REQUIRED" });
    const fields = normalizeFields(body.fields);
    const slug = normalizeSlug(body.slug) || existing.slug;
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const updated = await client.query<any>(`UPDATE job_postings SET
        title=$2,slug=$3,summary=$4,description=$5,employment_type=$6,work_mode=$7,
        governorate=$8,caza=$9,locality=$10,salary_text=$11,closes_at=$12,updated_at=NOW()
        WHERE id=$1 RETURNING *`, [id,title,slug,clean(body.summary,800)||null,clean(body.description,10000)||null,
        clean(body.employmentType,80)||null,clean(body.workMode,80)||null,clean(body.governorate,120)||null,
        clean(body.caza,120)||null,clean(body.locality,160)||null,clean(body.salaryText,160)||null,body.closesAt||null]);
      await replaceFields(client, id, fields);
      await client.query("COMMIT");
      return { ok: true, item: { ...updated.rows[0], fields } };
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error?.code === "23505") return reply.code(409).send({ error: "SLUG_ALREADY_EXISTS" });
      throw error;
    } finally { client.release(); }
  });

  app.patch("/api/jobs/builder/jobs/:id/status", async (request, reply) => {
    const user = requireUser(request);
    await requireEmployer(user);
    const id = clean((request.params as any).id, 64);
    const existing = await ownedJob(user, id);
    if (!existing) return reply.code(404).send({ error: "NOT_FOUND" });
    const status = clean((request.body as any)?.status, 20).toUpperCase();
    if (!postingStatuses.includes(status as any)) return reply.code(400).send({ error: "INVALID_STATUS" });
    if (status === "PUBLISHED") {
      const count = await query<{ count: number }>("SELECT COUNT(*)::int AS count FROM job_posting_form_fields WHERE job_posting_id=$1", [id]);
      if ((count.rows[0]?.count ?? 0) === 0) return reply.code(400).send({ error: "FORM_FIELDS_REQUIRED" });
    }
    const result = await query<any>(`UPDATE job_postings SET status=$2,
      published_at=CASE WHEN $2='PUBLISHED' AND published_at IS NULL THEN NOW() ELSE published_at END,
      updated_at=NOW() WHERE id=$1 RETURNING *`, [id, status]);
    return { ok: true, item: result.rows[0] };
  });

  app.post("/api/jobs/builder/jobs/:id/duplicate", async (request, reply) => {
    const user = requireUser(request);
    await requireEmployer(user);
    const id = clean((request.params as any).id, 64);
    const source = await ownedJob(user, id);
    if (!source) return reply.code(404).send({ error: "NOT_FOUND" });
    const fields = await loadFields(id);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const created = await client.query<any>(`INSERT INTO job_postings
        (owner_user_id,created_by_user_id,organization_name,title,slug,summary,description,employment_type,work_mode,governorate,caza,locality,salary_text,closes_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [
        source.owner_user_id,user.id,source.organization_name,`${source.title} - نسخة`, `job-${randomUUID().slice(0,8)}`,
        source.summary,source.description,source.employment_type,source.work_mode,source.governorate,source.caza,source.locality,source.salary_text,source.closes_at,
      ]);
      await replaceFields(client, created.rows[0].id, fields);
      await client.query("COMMIT");
      return reply.code(201).send({ ok: true, item: { ...created.rows[0], fields } });
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  });

  app.get("/api/jobs/opportunities", async () => {
    const result = await query<any>(`SELECT id,organization_name,title,slug,summary,employment_type,work_mode,
      governorate,caza,locality,salary_text,published_at,closes_at
      FROM job_postings WHERE status='PUBLISHED' AND (closes_at IS NULL OR closes_at>=NOW())
      ORDER BY published_at DESC,created_at DESC LIMIT 100`);
    return { ok: true, items: result.rows };
  });

  app.get("/api/jobs/opportunities/:slug", async (request, reply) => {
    const slug = clean((request.params as any).slug, 100);
    const result = await query<any>(`SELECT * FROM job_postings
      WHERE slug=$1 AND status='PUBLISHED' AND (closes_at IS NULL OR closes_at>=NOW()) LIMIT 1`, [slug]);
    const job = result.rows[0];
    if (!job) return reply.code(404).send({ error: "NOT_FOUND" });
    return { ok: true, item: { ...job, fields: await loadFields(job.id) } };
  });

  app.get("/api/jobs/application-sources", async (request) => {
    const user = requireUser(request);
    const profileResult = await query<any>(`SELECT COALESCE(NULLIF(full_name,''),NULLIF(name,'')) AS name,
      COALESCE(NULLIF(phone_number,''),NULLIF(phone,'')) AS phone,email,region FROM users WHERE id=$1`, [user.id]);
    const generic = await query<any>(`SELECT a.id AS application_id,p.title AS label,a.created_at,
      jsonb_build_object('name',a.applicant_name,'phone',a.applicant_phone,'email',COALESCE(a.applicant_email,'')) || a.answers AS data
      FROM job_posting_applications a JOIN job_postings p ON p.id=a.job_posting_id
      WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 20`, [user.id]);
    const legacy = await query<any>(`WITH x AS (
      SELECT l.application_id,'قطاف التفاح - تنورين'::text AS label,s.created_at,
        jsonb_build_object('name',s.name,'phone',s.phone,'email',COALESCE(s.email,''),'age',s.age,
          'governorate',s.governorate,'caza',s.caza,'locality',s.village) AS data
      FROM job_application_user_links l JOIN seasonal_apple_job_applications s ON s.id=l.application_id
      WHERE l.user_id=$1 AND l.campaign_id='seasonal-apple-job-2026-tannourine'
      UNION ALL
      SELECT l.application_id,'مساعد مدير مبنى - عين المريسة'::text,m.created_at,
        jsonb_build_object('name',m.name,'phone',m.phone,'email',COALESCE(m.email,''),'age',m.age,
          'governorate',m.governorate,'caza',m.caza,'locality',m.village) AS data
      FROM job_application_user_links l JOIN ain_mreisseh_building_assistant_applications m ON m.id=l.application_id
      WHERE l.user_id=$1 AND l.campaign_id='ain-mreisseh-building-assistant')
      SELECT * FROM x ORDER BY created_at DESC LIMIT 20`, [user.id]);
    const templates = await query<any>(`SELECT id,name,data,updated_at FROM job_applicant_saved_templates
      WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 30`, [user.id]);
    return { ok: true, profile: profileResult.rows[0] ?? null,
      previousApplications: [...generic.rows, ...legacy.rows].sort((a:any,b:any)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,20),
      savedTemplates: templates.rows };
  });

  app.get("/api/jobs/applicant-templates", async (request) => {
    const user = requireUser(request);
    const result = await query<any>(`SELECT id,name,data,created_at,updated_at FROM job_applicant_saved_templates
      WHERE user_id=$1 ORDER BY updated_at DESC`, [user.id]);
    return { ok: true, items: result.rows };
  });

  app.post("/api/jobs/applicant-templates", async (request, reply) => {
    const user = requireUser(request);
    const body = (request.body ?? {}) as any;
    const name = clean(body.name, 120);
    const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : null;
    if (!name || !data) return reply.code(400).send({ error: "TEMPLATE_NAME_AND_DATA_REQUIRED" });
    const result = await query<any>(`INSERT INTO job_applicant_saved_templates(user_id,name,data)
      VALUES ($1,$2,$3::jsonb) ON CONFLICT(user_id,name) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()
      RETURNING id,name,data,created_at,updated_at`, [user.id,name,JSON.stringify(data)]);
    return reply.code(201).send({ ok: true, item: result.rows[0] });
  });

  app.delete("/api/jobs/applicant-templates/:id", async (request, reply) => {
    const user = requireUser(request);
    const id = clean((request.params as any).id, 64);
    const result = await query("DELETE FROM job_applicant_saved_templates WHERE id=$1 AND user_id=$2", [id,user.id]);
    if (!(result.rowCount ?? 0)) return reply.code(404).send({ error: "NOT_FOUND" });
    return { ok: true };
  });

  app.post("/api/jobs/opportunities/:slug/apply", async (request, reply) => {
    const user = requireUser(request);
    const slug = clean((request.params as any).slug, 100);
    const body = (request.body ?? {}) as any;
    const jobResult = await query<any>(`SELECT * FROM job_postings WHERE slug=$1 AND status='PUBLISHED'
      AND (closes_at IS NULL OR closes_at>=NOW()) LIMIT 1`, [slug]);
    const job = jobResult.rows[0];
    if (!job) return reply.code(404).send({ error: "NOT_FOUND" });
    const name = clean(body.name, 200), phone = clean(body.phone, 40), email = clean(body.email, 320);
    if (!name || !phone) return reply.code(400).send({ error: "IDENTITY_REQUIRED" });
    const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers) ? body.answers : {};
    const fields = await loadFields(job.id);
    for (const field of fields) {
      const value = answers[field.fieldKey];
      if (field.required && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)))
        return reply.code(400).send({ error: "REQUIRED_FIELD_MISSING", fieldKey: field.fieldKey });
      if ((field.fieldType === "select" || field.fieldType === "radio") && value && !field.options.includes(String(value)))
        return reply.code(400).send({ error: "INVALID_FIELD_OPTION", fieldKey: field.fieldKey });
    }
    const source = ["PROFILE","PREVIOUS_APPLICATION","SAVED_TEMPLATE"].includes(String(body.prefillSource)) ? String(body.prefillSource) : "MANUAL";
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<any>(`INSERT INTO job_posting_applications
        (job_posting_id,user_id,applicant_name,applicant_phone,applicant_email,answers,prefill_source)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`, [job.id,user.id,name,phone,email||null,JSON.stringify(answers),source]);
      const appId = inserted.rows[0].id;
      await client.query(`INSERT INTO job_application_user_links(user_id,campaign_id,application_id,source)
        VALUES ($1,$2,$3,'job_builder') ON CONFLICT(campaign_id,application_id) DO UPDATE SET user_id=EXCLUDED.user_id`,
        [user.id,`job-posting:${job.id}`,String(appId)]);
      const templateName = clean(body.saveTemplateName, 120);
      if (templateName) {
        const templateData = { name,phone,email,...answers };
        await client.query(`INSERT INTO job_applicant_saved_templates(user_id,name,data)
          VALUES ($1,$2,$3::jsonb) ON CONFLICT(user_id,name) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`,
          [user.id,templateName,JSON.stringify(templateData)]);
      }
      await client.query("COMMIT");
      return reply.code(201).send({ ok: true, item: inserted.rows[0] });
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error?.code === "23505") return reply.code(409).send({ error: "ALREADY_APPLIED" });
      throw error;
    } finally { client.release(); }
  });

  app.get("/api/jobs/builder/jobs/:id/applications", async (request, reply) => {
    const user = requireUser(request);
    await requireEmployer(user);
    const id = clean((request.params as any).id, 64);
    const job = await ownedJob(user, id);
    if (!job) return reply.code(404).send({ error: "NOT_FOUND" });
    const status = clean((request.query as any)?.status, 30).toUpperCase();
    const result = await query<any>(`SELECT id,user_id,applicant_name,applicant_phone,applicant_email,answers,
      prefill_source,status,employer_notes,created_at,updated_at FROM job_posting_applications
      WHERE job_posting_id=$1 AND ($2='' OR status=$2) ORDER BY created_at DESC`, [id,status]);
    return { ok: true, job, items: result.rows };
  });

  app.patch("/api/jobs/builder/applications/:id", async (request, reply) => {
    const user = requireUser(request);
    await requireEmployer(user);
    const id = clean((request.params as any).id, 64);
    const application = await query<any>(`SELECT a.*,p.owner_user_id FROM job_posting_applications a
      JOIN job_postings p ON p.id=a.job_posting_id WHERE a.id=$1 LIMIT 1`, [id]);
    const row = application.rows[0];
    if (!row) return reply.code(404).send({ error: "NOT_FOUND" });
    if (!isAdmin(user) && row.owner_user_id !== user.id) return reply.code(403).send({ error: "FORBIDDEN" });
    const body = (request.body ?? {}) as any;
    const status = clean(body.status, 30).toUpperCase();
    if (!applicationStatuses.includes(status as any)) return reply.code(400).send({ error: "INVALID_STATUS" });
    const result = await query<any>(`UPDATE job_posting_applications SET status=$2,employer_notes=$3,updated_at=NOW()
      WHERE id=$1 RETURNING *`, [id,status,clean(body.employerNotes,5000)]);
    return { ok: true, item: result.rows[0] };
  });

  app.get("/api/jobs/builder/summary", async (request) => {
    const user = requireUser(request);
    await requireEmployer(user);
    const result = await query<any>(`SELECT
      COUNT(*) FILTER (WHERE ($1::boolean OR owner_user_id=$2))::int AS total_jobs,
      COUNT(*) FILTER (WHERE status='PUBLISHED' AND ($1::boolean OR owner_user_id=$2))::int AS published_jobs,
      COUNT(*) FILTER (WHERE status='DRAFT' AND ($1::boolean OR owner_user_id=$2))::int AS draft_jobs,
      COALESCE((SELECT COUNT(*) FROM job_posting_applications a JOIN job_postings p ON p.id=a.job_posting_id
        WHERE ($1::boolean OR p.owner_user_id=$2)),0)::int AS total_applications
      FROM job_postings`, [isAdmin(user),user.id]);
    return { ok: true, summary: result.rows[0] };
  });
}
