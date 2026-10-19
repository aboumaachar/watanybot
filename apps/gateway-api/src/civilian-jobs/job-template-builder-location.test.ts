import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock("../lib/db.js", () => ({
  query: db.query,
  getClient: db.getClient,
}));

import { hasAddressSelection, registerJobTemplateBuilderRoutes } from "./job-template-builder.routes.js";

async function createAdminApp() {
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    (request as any).user = { id: "admin-1", role: "admin" };
  });
  await registerJobTemplateBuilderRoutes(app);
  await app.ready();
  return app;
}

function validLocation() {
  return { governorateId: "beirut", governorateName: "بيروت" };
}

describe("Universal Job mandatory locator contract", () => {
  beforeEach(() => {
    db.query.mockReset();
    db.getClient.mockReset();
  });

  it("accepts an administrative locator or coordinate pair and rejects empty/null coordinates", () => {
    expect(hasAddressSelection({})).toBe(false);
    expect(hasAddressSelection({ latitude: null, longitude: null })).toBe(false);
    expect(hasAddressSelection({ municipalityName: "بيروت" })).toBe(true);
    expect(hasAddressSelection({ latitude: 33.8938, longitude: 35.5018 })).toBe(true);
  });

  it("rejects job creation without a Universal Address Locator", async () => {
    const app = await createAdminApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs/builder/jobs",
      payload: { title: "وظيفة اختبار", organizationName: "موطني", locationData: {}, fields: [] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "LOCATION_REQUIRED" });
    expect(db.getClient).not.toHaveBeenCalled();
    await app.close();
  });

  it("accepts job creation when a valid locator is supplied", async () => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO job_postings")) {
          return { rows: [{ id: "job-1", title: "وظيفة اختبار", slug: "job-1", status: "DRAFT", location_data: JSON.parse(String(params?.[15])) }] };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    db.getClient.mockResolvedValue(client);
    const app = await createAdminApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs/builder/jobs",
      payload: { title: "وظيفة اختبار", organizationName: "موطني", locationData: validLocation(), fields: [] },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ ok: true, item: { id: "job-1" } });
    expect(client.release).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("rejects removing the locator during job update", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: "job-1", owner_user_id: "admin-1", slug: "job-1", location_data: validLocation() }] });
    const app = await createAdminApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/jobs/builder/jobs/job-1",
      payload: { title: "وظيفة اختبار", locationData: {}, fields: [] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "LOCATION_REQUIRED" });
    expect(db.getClient).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects publishing a persisted draft that has no locator", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: "job-1", owner_user_id: "admin-1", status: "DRAFT", location_data: {} }] });
    const app = await createAdminApp();
    const response = await app.inject({
      method: "PATCH",
      url: "/api/jobs/builder/jobs/job-1/status",
      payload: { status: "PUBLISHED" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "LOCATION_REQUIRED" });
    expect(db.query).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("allows publishing when the persisted draft has a valid locator", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: "job-1", owner_user_id: "admin-1", status: "DRAFT", location_data: validLocation() }] })
      .mockResolvedValueOnce({ rows: [{ id: "job-1", status: "PUBLISHED", location_data: validLocation() }] });
    const app = await createAdminApp();
    const response = await app.inject({
      method: "PATCH",
      url: "/api/jobs/builder/jobs/job-1/status",
      payload: { status: "PUBLISHED" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, item: { id: "job-1", status: "PUBLISHED" } });
    expect(db.query).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
