import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerCivilianJobsRoutes } from "../civilian-jobs.routes";
import { InMemoryCivilianJobsRepository } from "../civilian-jobs.repository";

describe("V1.0.19 civilian application HTTP failure boundary", () => {
  it("returns non-2xx and no success payload when durable storage fails", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    repository.saveApplication = async () => { throw new Error("storage unavailable"); };
    const app = Fastify({ logger: false });
    await app.register(registerCivilianJobsRoutes, { repository });
    const response = await app.inject({
      method: "POST",
      url: "/api/opportunities/civilian-opportunity-001/apply",
      payload: { applicantName: "Failure Test", applicantPhone: "70000011", applicantType: "VETERAN" },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
    expect(response.json().item).toBeUndefined();
    expect(await repository.listApplications()).toHaveLength(0);
    await app.close();
  });
});