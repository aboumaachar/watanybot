import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { jobsRoutes } from "../routes";
import { InMemoryMarketplaceJobApplicationsRepository } from "../repository";

describe("V1.0.19 marketplace application HTTP failure boundary", () => {
  it("returns non-2xx and no success payload when durable storage fails", async () => {
    const repository = new InMemoryMarketplaceJobApplicationsRepository();
    repository.save = async () => { throw new Error("storage unavailable"); };
    const app = Fastify({ logger: false });
    await app.register(jobsRoutes, { applicationsRepository: repository });
    const response = await app.inject({
      method: "POST",
      url: "/api/v2/jobs/job_v2_001/apply",
      payload: { name: "Failure Test", phone: "70000012" },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
    expect(response.statusCode).toBeLessThan(600);
    expect(response.json().application).toBeUndefined();
    expect(await repository.listAll()).toHaveLength(0);
    await app.close();
  });
});