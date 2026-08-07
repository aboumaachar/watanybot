import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.JWT_SECRET ||= "test-jwt-secret-for-directory-route-0123456789";
process.env.DISABLE_PLUGIN_DB ||= "true";

let appPromise: Promise<typeof import("../server").app> | null = null;

async function getApp() {
  appPromise ||= import("../server").then((mod) => mod.app);
  return appPromise;
}

describe("Directory route", () => {
  beforeAll(async () => {
    const app = await getApp();
    await app.ready();
  }, 30000);

  afterAll(async () => {
    if (appPromise !== null) {
      const app = await getApp();
      await app.close();
    }
  });

  it("searches the existing phonebook data and returns veteran-facing contacts", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v2/directory/search?q=تقاعد",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.some((item: { name?: string; phone?: string }) => item.name === "دائرة التقاعد" && item.phone === "01-612200")).toBe(true);
  });

  it("falls back to emergency contacts for emergency terms", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v2/directory/search?q=طوارئ",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.some((item: { phone?: string }) => item.phone === "112")).toBe(true);
  });

  it("matches Arabizi hospital queries against the existing phonebook data", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v2/directory/search?q=ra2em%20mostashfa",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.some((item: { name?: string; phone?: string }) => item.name === "المستشفى العسكري" && item.phone === "01-820000")).toBe(true);
  });

  it("matches Arabizi retirement office queries against the existing phonebook data", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v2/directory/search?q=dayeret%20ta2aod",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.some((item: { name?: string; phone?: string }) => item.name === "دائرة التقاعد" && item.phone === "01-612200")).toBe(true);
  });

  it("exposes source metadata for user-provided hospital entries", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v2/directory/search?q=بيروت",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.some((item: { name?: string; source?: string; subCategory?: string }) =>
      item.name === "مستشفى بيروت الحكومي"
      && item.source === "user_provided_hospital_list"
      && item.subCategory === "مستشفيات لبنانية"
    )).toBe(true);
  });
});