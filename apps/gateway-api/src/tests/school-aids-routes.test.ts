import Fastify from "fastify";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { registerSchoolAidsRoutes } from "../routes/school-aids";

const app = Fastify();

beforeAll(async () => {
  await app.register(registerSchoolAidsRoutes as any);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("/api/school-aids routes", () => {
  it("returns items and preview/download URLs with expected extensions", async () => {
    const res = await app.inject({ method: "GET", url: "/api/school-aids/items" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ id: string; previewUrl?: string; downloadUrl?: string }> };
    expect(body.items.length).toBeGreaterThan(0);

    const findById = (id: string) => body.items.find((i) => i.id === id);
    const annexZ = findById("annex-z");
    const annexJ = findById("annex-j");
    const cert = findById("school-year-completion-certificate");

    expect(annexZ).toBeTruthy();
    expect(annexJ).toBeTruthy();
    expect(cert).toBeTruthy();

    const isPdfOrHtml = (u?: string) => !!u && (u.endsWith(".pdf") || u.endsWith(".html"));

    expect(isPdfOrHtml(annexZ?.previewUrl)).toBe(true);
    expect(isPdfOrHtml(annexZ?.downloadUrl)).toBe(true);
    expect(isPdfOrHtml(annexJ?.previewUrl)).toBe(true);
    expect(isPdfOrHtml(annexJ?.downloadUrl)).toBe(true);
    expect(isPdfOrHtml(cert?.previewUrl)).toBe(true);
    expect(isPdfOrHtml(cert?.downloadUrl)).toBe(true);

    // API should indicate the frontend prefer using the in-app universal viewer for these child items
    expect(annexZ?.preferUniversal).toBe(true);
    expect(annexJ?.preferUniversal).toBe(true);
    expect(cert?.preferUniversal).toBe(true);
  });
});
