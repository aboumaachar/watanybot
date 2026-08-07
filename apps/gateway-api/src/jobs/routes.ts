/* ── Job Search Feature – Fastify routes ─────────────── */
import type { FastifyInstance } from "fastify";
import {
  SEED_CATEGORIES,
  SEED_EMPLOYERS,
  SEED_JOBS,
  applications,
  savedJobs,
} from "./seed.js";
import type { JobApplicationRecord, SavedJob, JobSearchResult } from "./types.js";

let idCounter = 1;
function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${idCounter++}`;
}

function normalize(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function normalizeNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function getJobTypeLabel(t: string): string {
  const m: Record<string, string> = {
    full_time: "دوام كامل",
    part_time: "دوام جزئي",
    contract: "عقد مؤقت",
    freelance: "عمل حر",
  };
  return m[t] || t;
}

function readFlag(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function requireAuthWhen(flag: boolean, userId: string | undefined): { ok: boolean; error?: string } {
  if (!flag) return { ok: true };
  if (userId) return { ok: true };
  return { ok: false, error: "LOGIN_REQUIRED" };
}

function toPublicJobCard(job: {
  id: string;
  title_ar: string;
  location_city?: string;
  job_type: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  show_salary: boolean;
  veteran_preferred: boolean;
  urgent: boolean;
  featured: boolean;
  published_at: string;
}, companyName: string, companyLogo?: string, tags: string[] = []): JobSearchResult {
  return {
    id: job.id,
    title_ar: job.title_ar,
    company_name: companyName,
    company_logo: companyLogo,
    location_city: job.location_city,
    job_type: getJobTypeLabel(job.job_type),
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    show_salary: job.show_salary,
    veteran_preferred: job.veteran_preferred,
    urgent: job.urgent,
    featured: job.featured,
    published_at: job.published_at,
    tags,
  };
}

function toPublicJobDetail(job: {
  id: string;
  category_id: number;
  title_ar: string;
  description_ar: string;
  job_type: string;
  location_city?: string;
  location_area?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  show_salary: boolean;
  veteran_preferred: boolean;
  urgent: boolean;
  featured: boolean;
  published_at: string;
  application_deadline?: string;
  status: string;
}) {
  return {
    id: job.id,
    category_id: job.category_id,
    title_ar: job.title_ar,
    summary_ar: String(job.description_ar || "").slice(0, 240),
    job_type: getJobTypeLabel(job.job_type),
    location_city: job.location_city,
    location_area: job.location_area,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    show_salary: job.show_salary,
    veteran_preferred: job.veteran_preferred,
    urgent: job.urgent,
    featured: job.featured,
    published_at: job.published_at,
    application_deadline: job.application_deadline,
    status: job.status,
    login_required_for_full_details: true,
  };
}

function toPublicEmployerDetail(employer: {
  id: string;
  company_name: string;
  company_name_en?: string;
  industry?: string;
  company_size?: string;
  city?: string;
  description_ar?: string;
  logo_url?: string;
  verified: boolean;
  veteran_friendly: boolean;
} | null) {
  if (!employer) return null;
  return {
    id: employer.id,
    company_name: employer.company_name,
    company_name_en: employer.company_name_en,
    industry: employer.industry,
    company_size: employer.company_size,
    city: employer.city,
    description_ar: employer.description_ar,
    logo_url: employer.logo_url,
    verified: employer.verified,
    veteran_friendly: employer.veteran_friendly,
  };
}

export async function jobsRoutes(app: FastifyInstance) {
  const prefix = "/api/v2/jobs";
  const requireDetailsAuth = readFlag("JOBS_DETAILS_REQUIRE_AUTH", false);
  const requireActionsAuth = readFlag("JOBS_ACTIONS_REQUIRE_AUTH", false);
  const explicitPublicCardShaping = readFlag("JOBS_PUBLIC_CARD_EXPLICIT_SHAPING", false);
  const explicitDetailShaping = readFlag("JOBS_DETAIL_PAYLOAD_SHAPING", false);

  /* ─── GET /api/v2/jobs/categories — list categories ─── */
  app.get(`${prefix}/categories`, async () => {
    return { categories: SEED_CATEGORIES };
  });

  /* ─── GET /api/v2/jobs — search/list jobs ──────────── */
  app.get(prefix, async (req) => {
    const qs = req.query as Record<string, string>;
    const q = normalize(qs.q).toLowerCase();
    const categoryId = qs.category ? Number(qs.category) : undefined;
    const jobType = normalize(qs.job_type);
    const city = normalize(qs.city).toLowerCase();
    const veteranOnly = qs.veteran_only === "true";
    const limit = Math.min(50, Math.max(1, Number(qs.limit || "20")));
    const offset = Math.max(0, Number(qs.offset || "0"));

    let filtered = SEED_JOBS.filter((j) => j.status === "active");

    if (q) {
      filtered = filtered.filter((j) => {
        const blob = [
          j.title_ar,
          j.title_en || "",
          j.description_ar,
          ...(j.skills_required || []),
          ...(j.benefits || []),
          j.location_city || "",
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }

    if (categoryId) filtered = filtered.filter((j) => j.category_id === categoryId);
    if (jobType) filtered = filtered.filter((j) => j.job_type === jobType);
    if (city) filtered = filtered.filter((j) => (j.location_city || "").toLowerCase().includes(city));
    if (veteranOnly) filtered = filtered.filter((j) => j.veteran_only || j.veteran_preferred);

    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);

    const results: JobSearchResult[] = page.map((j) => {
      const emp = SEED_EMPLOYERS.find((e) => e.id === j.employer_id);
      const tags = j.skills_required?.slice(0, 4) || [];
      if (explicitPublicCardShaping) {
        return toPublicJobCard(j, emp?.company_name || "—", emp?.logo_url, tags);
      }
      return toPublicJobCard(j, emp?.company_name || "—", emp?.logo_url, tags);
    });

    return { total, offset, limit, results };
  });

  /* ─── POST /api/v2/jobs — create job posting (employer) ─── */
  app.post(prefix, async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const employerId = normalize(body.employer_id);
    const titleAr = normalize(body.title_ar);
    const descriptionAr = normalize(body.description_ar);
    const categoryId = Number(body.category_id || 0);

    if (!employerId || !titleAr || !descriptionAr || !Number.isFinite(categoryId) || categoryId <= 0) {
      reply.code(400);
      return { error: "employer_id و title_ar و description_ar و category_id مطلوبة" };
    }

    const employer = SEED_EMPLOYERS.find((entry) => entry.id === employerId);
    if (!employer) {
      reply.code(404);
      return { error: "جهة التوظيف غير موجودة" };
    }

    const categoryExists = SEED_CATEGORIES.some((entry) => entry.id === categoryId);
    if (!categoryExists) {
      reply.code(400);
      return { error: "فئة الوظيفة غير صالحة" };
    }

    const now = new Date().toISOString();
    const created = {
      id: makeId("job"),
      employer_id: employerId,
      category_id: categoryId,
      title_ar: titleAr,
      title_en: normalize(body.title_en) || undefined,
      description_ar: descriptionAr,
      requirements_ar: normalize(body.requirements_ar) || undefined,
      qualifications_ar: normalize(body.qualifications_ar) || undefined,
      experience_years: normalizeNumber(body.experience_years),
      education_level: normalize(body.education_level) || undefined,
      job_type: (normalize(body.job_type) || "full_time") as "full_time" | "part_time" | "contract" | "freelance",
      employment_type: normalize(body.employment_type) || undefined,
      salary_min: normalizeNumber(body.salary_min),
      salary_max: normalizeNumber(body.salary_max),
      salary_currency: normalize(body.salary_currency) || "USD",
      salary_period: normalize(body.salary_period) || undefined,
      show_salary: body.show_salary !== false,
      benefits: Array.isArray(body.benefits) ? body.benefits.map((item) => normalize(item)).filter(Boolean) : [],
      location_city: normalize(body.location_city) || undefined,
      location_area: normalize(body.location_area) || undefined,
      remote_work: body.remote_work === true,
      hybrid_work: body.hybrid_work === true,
      skills_required: Array.isArray(body.skills_required) ? body.skills_required.map((item) => normalize(item)).filter(Boolean) : [],
      languages_required: Array.isArray(body.languages_required) ? body.languages_required.map((item) => normalize(item)).filter(Boolean) : [],
      veteran_only: body.veteran_only === true,
      veteran_preferred: body.veteran_preferred !== false,
      military_rank_suitable: Array.isArray(body.military_rank_suitable) ? body.military_rank_suitable.map((item) => normalize(item)).filter(Boolean) : [],
      application_deadline: normalize(body.application_deadline) || undefined,
      status: (normalize(body.status) || "active") as "draft" | "active" | "paused" | "closed" | "filled",
      featured: body.featured === true,
      urgent: body.urgent === true,
      views_count: 0,
      applications_count: 0,
      published_at: now,
      created_at: now,
    };

    SEED_JOBS.unshift(created);
    return { ok: true, job: created };
  });

  /* ─── GET /api/v2/jobs/my/postings — employer postings ─── */
  app.get(`${prefix}/my/postings`, async (req, reply) => {
    const authCheck = requireAuthWhen(requireActionsAuth, req.user?.id);
    if (!authCheck.ok) {
      reply.code(401);
      return { error: authCheck.error };
    }

    const qs = req.query as Record<string, string>;
    const employerId = normalize(qs.employer_id) || normalize(req.user?.id);
    if (!employerId) {
      reply.code(400);
      return { error: "employer_id مطلوب" };
    }

    const postings = SEED_JOBS.filter((entry) => entry.employer_id === employerId)
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
    return { postings };
  });

  /* ─── GET /api/v2/jobs/:id — single job detail ─────── */
  app.get(`${prefix}/:id`, async (req, reply) => {
    const authCheck = requireAuthWhen(requireDetailsAuth, req.user?.id);
    if (!authCheck.ok) {
      reply.code(401);
      return { error: authCheck.error };
    }

    const { id } = req.params as { id: string };
    const job = SEED_JOBS.find((j) => j.id === id);
    if (!job) {
      reply.code(404);
      return { error: "الوظيفة غير موجودة" };
    }
    const emp = SEED_EMPLOYERS.find((e) => e.id === job.employer_id);
    const cat = SEED_CATEGORIES.find((c) => c.id === job.category_id);

    if (!req.user?.id && explicitDetailShaping) {
      return {
        job: toPublicJobDetail(job),
        employer: toPublicEmployerDetail(emp || null),
        category: cat || null,
        detail_access: "public_card",
      };
    }

    return { job, employer: emp || null, category: cat || null, detail_access: "protected" };
  });

  /* ─── PATCH /api/v2/jobs/:id — update employer posting ─── */
  app.patch(`${prefix}/:id`, async (req, reply) => {
    const authCheck = requireAuthWhen(requireActionsAuth, req.user?.id);
    if (!authCheck.ok) {
      reply.code(401);
      return { error: authCheck.error };
    }

    const { id } = req.params as { id: string };
    const body = (req.body || {}) as Record<string, unknown>;
    const actorEmployerId = normalize(body.actor_employer_id) || normalize(req.user?.id);
    if (!actorEmployerId) {
      reply.code(400);
      return { error: "actor_employer_id مطلوب" };
    }

    const job = SEED_JOBS.find((entry) => entry.id === id);
    if (!job) {
      reply.code(404);
      return { error: "الوظيفة غير موجودة" };
    }

    if (job.employer_id !== actorEmployerId) {
      reply.code(403);
      return { error: "غير مسموح بتعديل هذا الإعلان" };
    }

    if (body.title_ar !== undefined) job.title_ar = normalize(body.title_ar) || job.title_ar;
    if (body.description_ar !== undefined) job.description_ar = normalize(body.description_ar) || job.description_ar;
    if (body.location_city !== undefined) job.location_city = normalize(body.location_city) || undefined;
    if (body.location_area !== undefined) job.location_area = normalize(body.location_area) || undefined;
    if (body.job_type !== undefined) job.job_type = (normalize(body.job_type) || job.job_type) as typeof job.job_type;
    if (body.veteran_only !== undefined) job.veteran_only = body.veteran_only === true;
    if (body.veteran_preferred !== undefined) job.veteran_preferred = body.veteran_preferred === true;
    if (body.salary_min !== undefined) job.salary_min = normalizeNumber(body.salary_min);
    if (body.salary_max !== undefined) job.salary_max = normalizeNumber(body.salary_max);
    if (body.show_salary !== undefined) job.show_salary = body.show_salary === true;
    if (body.featured !== undefined) job.featured = body.featured === true;
    if (body.urgent !== undefined) job.urgent = body.urgent === true;
    if (body.application_deadline !== undefined) job.application_deadline = normalize(body.application_deadline) || undefined;

    return { ok: true, job };
  });

  /* ─── POST /api/v2/jobs/:id/status — close/pause/fill posting ─── */
  app.post(`${prefix}/:id/status`, async (req, reply) => {
    const authCheck = requireAuthWhen(requireActionsAuth, req.user?.id);
    if (!authCheck.ok) {
      reply.code(401);
      return { error: authCheck.error };
    }

    const { id } = req.params as { id: string };
    const body = (req.body || {}) as Record<string, unknown>;
    const actorEmployerId = normalize(body.actor_employer_id) || normalize(req.user?.id);
    const nextStatus = normalize(body.status) as "draft" | "active" | "paused" | "closed" | "filled";

    if (!actorEmployerId || !nextStatus) {
      reply.code(400);
      return { error: "actor_employer_id و status مطلوبان" };
    }

    const allowed = new Set(["draft", "active", "paused", "closed", "filled"]);
    if (!allowed.has(nextStatus)) {
      reply.code(400);
      return { error: "status غير صالح" };
    }

    const job = SEED_JOBS.find((entry) => entry.id === id);
    if (!job) {
      reply.code(404);
      return { error: "الوظيفة غير موجودة" };
    }
    if (job.employer_id !== actorEmployerId) {
      reply.code(403);
      return { error: "غير مسموح بإدارة هذا الإعلان" };
    }

    job.status = nextStatus;
    return { ok: true, job };
  });

  /* ─── POST /api/v2/jobs/:id/apply — apply for a job ── */
  app.post(`${prefix}/:id/apply`, async (req, reply) => {
    const authCheck = requireAuthWhen(requireActionsAuth, req.user?.id);
    if (!authCheck.ok) {
      reply.code(401);
      return { error: authCheck.error };
    }

    const { id } = req.params as { id: string };
    const body = (req.body || {}) as Record<string, unknown>;
    const name = normalize(body.name);
    const phone = normalize(body.phone);
    const email = normalize(body.email);
    const cover = normalize(body.cover_letter);

    if (!name || !phone) {
      reply.code(400);
      return { error: "الاسم ورقم الهاتف مطلوبان" };
    }

    const job = SEED_JOBS.find((j) => j.id === id);
    if (!job) {
      reply.code(404);
      return { error: "الوظيفة غير موجودة" };
    }

    const dup = applications.find((a) => a.job_id === id && a.phone === phone);
    if (dup) {
      reply.code(409);
      return { error: "لقد تقدّمت لهذه الوظيفة سابقاً" };
    }

    const record: JobApplicationRecord = {
      id: makeId("app"),
      job_id: id,
      veteran_name: name,
      phone,
      email: email || undefined,
      cover_letter: cover || undefined,
      status: "pending",
      applied_at: new Date().toISOString(),
    };
    applications.push(record);
    job.applications_count += 1;

    return { ok: true, application: record };
  });

  /* ─── GET /api/v2/jobs/my/applications — user apps ─── */
  app.get(`${prefix}/my/applications`, async (req) => {
    const authCheck = requireAuthWhen(requireActionsAuth, req.user?.id);
    if (!authCheck.ok) {
      return { applications: [] };
    }

    const qs = req.query as Record<string, string>;
    const phone = normalize(qs.phone);
    if (!phone) return { applications: [] };

    const mine = applications.filter((a) => a.phone === phone);
    const enriched = mine.map((a) => {
      const job = SEED_JOBS.find((j) => j.id === a.job_id);
      const emp = job ? SEED_EMPLOYERS.find((e) => e.id === job.employer_id) : null;
      return {
        ...a,
        job_title: job?.title_ar || "—",
        company_name: emp?.company_name || "—",
      };
    });
    return { applications: enriched };
  });

  /* ─── POST /api/v2/jobs/:id/save — save job ───────── */
  app.post(`${prefix}/:id/save`, async (req, reply) => {
    const authCheck = requireAuthWhen(requireActionsAuth, req.user?.id);
    if (!authCheck.ok) {
      reply.code(401);
      return { error: authCheck.error };
    }

    const { id } = req.params as { id: string };
    const body = (req.body || {}) as Record<string, unknown>;
    const userId = normalize(req.user?.id) || normalize(body.user_id) || "anon";
    const notes = normalize(body.notes);

    const job = SEED_JOBS.find((j) => j.id === id);
    if (!job) {
      reply.code(404);
      return { error: "الوظيفة غير موجودة" };
    }

    const dup = savedJobs.find((s) => s.job_id === id && s.user_id === userId);
    if (dup) return { ok: true, saved: dup };

    const saved: SavedJob = {
      id: makeId("sj"),
      user_id: userId,
      job_id: id,
      notes: notes || undefined,
      created_at: new Date().toISOString(),
    };
    savedJobs.push(saved);
    return { ok: true, saved };
  });

  /* ─── DELETE /api/v2/jobs/:id/save — remove saved ─── */
  app.delete(`${prefix}/:id/save`, async (req, reply) => {
    const authCheck = requireAuthWhen(requireActionsAuth, req.user?.id);
    if (!authCheck.ok) {
      reply.code(401);
      return { error: authCheck.error };
    }

    const { id } = req.params as { id: string };
    const qs = req.query as Record<string, string>;
    const userId = normalize(req.user?.id) || normalize(qs.user_id) || "anon";

    const idx = savedJobs.findIndex((s) => s.job_id === id && s.user_id === userId);
    if (idx === -1) {
      reply.code(404);
      return { error: "لم يتم العثور على الوظيفة المحفوظة" };
    }
    savedJobs.splice(idx, 1);
    return { ok: true };
  });

  /* ─── GET /api/v2/jobs/my/saved — user saved jobs ─── */
  app.get(`${prefix}/my/saved`, async (req) => {
    const authCheck = requireAuthWhen(requireActionsAuth, req.user?.id);
    if (!authCheck.ok) {
      return { saved: [] };
    }

    const qs = req.query as Record<string, string>;
    const userId = normalize(req.user?.id) || normalize(qs.user_id) || "anon";

    const saved = savedJobs
      .filter((item) => (normalize(item.user_id) || "anon") === userId)
      .map((item) => {
        const job = SEED_JOBS.find((entry) => entry.id === item.job_id);
        const employer = job ? SEED_EMPLOYERS.find((entry) => entry.id === job.employer_id) : null;
        return {
          ...item,
          title_ar: job?.title_ar,
          company_name: employer?.company_name,
          location_city: job?.location_city,
        };
      });

    return { saved };
  });

  /* ─── GET /api/v2/jobs/stats — admin stats ─────────── */
  app.get(`${prefix}/stats`, async () => {
    return {
      total_jobs: SEED_JOBS.filter((j) => j.status === "active").length,
      total_applications: applications.length,
      total_saved: savedJobs.length,
      categories: SEED_CATEGORIES.length,
      employers: SEED_EMPLOYERS.length,
    };
  });
}
