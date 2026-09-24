import Fastify from "fastify";
import watanyEndpointCompatibilityRoutes from "../routes/watanyEndpointCompatibilityRoutes";

describe("Watany compatibility Procedures ownership", () => {
  it("serves the current Procedures runtime instead of legacy file probes", async () => {
    const app = Fastify();
    await app.register(watanyEndpointCompatibilityRoutes);
    const response = await app.inject({ method: "GET", url: "/api/procedures" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.source).not.toBe("missing-procedures-catalog");
    expect(body.total).toBeGreaterThan(0);
    expect(body.items).toHaveLength(body.total);
    expect(body.items[0]).toMatchObject({ id: expect.any(String), title_ar: expect.any(String) });
    await app.close();
  });
});
