import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { jobsRoutes } from "../jobs/routes";
import { InMemoryMarketplaceJobApplicationsRepository } from "../jobs/repository";
import { savedJobs } from "../jobs/seed";
import { InMemoryCivilianJobsRepository } from "../civilian-jobs/civilian-jobs.repository";
import type { CivilianOpportunity } from "../civilian-jobs/civilian-jobs.types";

const persistedJob: CivilianOpportunity = {
  id: "opp-persisted-compat-001",
  type: "PAID_JOB",
  audience: ["PUBLIC", "VETERAN"],
  title: "Persistent compatibility test job",
  organization: "Compatibility Employer",
  location: "Tripoli",
  category: "trades",
  summary: "Persisted job exposed through the legacy jobs API.",
  description: "Persistent compatibility job description.",
  requirements: ["Heavy equipment experience"],
  applicationMethod: "Apply via WatanyBot.",
  status: "PUBLISHED",
  adminVerified: true,
  createdAt: "2026-10-03T00:00:00.000Z",
  updatedAt: "2026-10-03T00:00:00.000Z",
};

afterEach(() => {
  savedJobs.length = 0;
});

describe("jobs v2 persisted opportunity compatibility", () => {
  it("supports list, detail, save, saved enrichment, and apply for a persisted job", async () => {
    const civilianRepository = new InMemoryCivilianJobsRepository();
    const applicationsRepository = new InMemoryMarketplaceJobApplicationsRepository();
    await civilianRepository.saveOpportunity(persistedJob);

    const app = Fastify({ logger: false });
    await app.register(jobsRoutes, { civilianJobsRepository: civilianRepository, applicationsRepository });
    await app.ready();

    const listRes = await app.inject({ method: "GET", url: "/api/v2/jobs?q=persistent%20compatibility" });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as { total: number; results: Array<{ id: string; company_name: string }> };
    expect(listBody.results.some((item) => item.id === persistedJob.id)).toBe(true);
    expect(listBody.results.find((item) => item.id === persistedJob.id)?.company_name).toBe(persistedJob.organization);

    const detailRes = await app.inject({ method: "GET", url: `/api/v2/jobs/${persistedJob.id}` });
    expect(detailRes.statusCode).toBe(200);
    const detailBody = detailRes.json() as { job: { id: string; title_ar: string }; detail_access: string };
    expect(detailBody.job.id).toBe(persistedJob.id);
    expect(detailBody.job.title_ar).toBe(persistedJob.title);
    expect(detailBody.detail_access).toBe("public_persisted");

    const saveRes = await app.inject({
      method: "POST",
      url: `/api/v2/jobs/${persistedJob.id}/save`,
      payload: { user_id: "compat-user" },
    });
    expect(saveRes.statusCode).toBe(200);

    const savedRes = await app.inject({ method: "GET", url: "/api/v2/jobs/my/saved?user_id=compat-user" });
    expect(savedRes.statusCode).toBe(200);
    const savedBody = savedRes.json() as { saved: Array<{ job_id: string; title_ar?: string; company_name?: string }> };
    const saved = savedBody.saved.find((item) => item.job_id === persistedJob.id);
    expect(saved?.title_ar).toBe(persistedJob.title);
    expect(saved?.company_name).toBe(persistedJob.organization);

    const applyRes = await app.inject({
      method: "POST",
      url: `/api/v2/jobs/${persistedJob.id}/apply`,
      payload: { name: "Persisted Applicant", phone: "70000099", cover_letter: "Interested" },
    });
    expect(applyRes.statusCode).toBe(200);
    const applyBody = applyRes.json() as { ok: boolean; application: { job_id: string } };
    expect(applyBody.ok).toBe(true);
    expect(applyBody.application.job_id).toBe(persistedJob.id);
    expect(await civilianRepository.listApplications()).toHaveLength(1);

    await app.close();
  });
});
