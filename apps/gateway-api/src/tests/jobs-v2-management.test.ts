import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../server";

describe("jobs v2 management routes", () => {
  beforeAll(async () => {
    await app.ready();
  });

  it("creates, updates, changes status, and lists employer postings", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v2/jobs",
      payload: {
        employer_id: "emp_001",
        title_ar: "مسؤول دعم ميداني",
        description_ar: "متابعة شؤون المتقاعدين وتنسيق الطلبات",
        category_id: 1,
        location_city: "طرابلس",
        job_type: "full_time",
      },
    });

    expect(createRes.statusCode).toBe(200);
    const createBody = createRes.json() as { ok: boolean; job: { id: string; employer_id: string; title_ar: string } };
    expect(createBody.ok).toBe(true);
    expect(createBody.job.employer_id).toBe("emp_001");

    const jobId = createBody.job.id;

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v2/jobs/${encodeURIComponent(jobId)}`,
      payload: {
        actor_employer_id: "emp_001",
        title_ar: "مسؤول دعم ميداني أول",
        salary_min: 700,
        salary_max: 1000,
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = patchRes.json() as { ok: boolean; job: { title_ar: string; salary_min: number; salary_max: number } };
    expect(patchBody.ok).toBe(true);
    expect(patchBody.job.title_ar).toContain("أول");
    expect(patchBody.job.salary_min).toBe(700);
    expect(patchBody.job.salary_max).toBe(1000);

    const statusRes = await app.inject({
      method: "POST",
      url: `/api/v2/jobs/${encodeURIComponent(jobId)}/status`,
      payload: {
        actor_employer_id: "emp_001",
        status: "paused",
      },
    });

    expect(statusRes.statusCode).toBe(200);
    const statusBody = statusRes.json() as { ok: boolean; job: { status: string } };
    expect(statusBody.ok).toBe(true);
    expect(statusBody.job.status).toBe("paused");

    const mineRes = await app.inject({
      method: "GET",
      url: "/api/v2/jobs/my/postings?employer_id=emp_001",
    });

    expect(mineRes.statusCode).toBe(200);
    const mineBody = mineRes.json() as { postings: Array<{ id: string; status: string }> };
    expect(mineBody.postings.some((item) => item.id === jobId && item.status === "paused")).toBe(true);
  });
});
