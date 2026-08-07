import { app } from "./server";

describe("Gateway API — debug routes", () => {
  test("GET /api/debug/stats returns OK", async () => {
    const res = await app.inject({ method: "GET", url: "/api/debug/stats" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || "{}");
    expect(body).toHaveProperty("ok", true);
    expect(body).toHaveProperty("stats");
  });

  test("GET /api/debug/logs returns logs array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/debug/logs" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || "{}");
    expect(body).toHaveProperty("logs");
    expect(Array.isArray(body.logs)).toBe(true);
  });

  test("GET /api/debug/performance returns performance array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/debug/performance" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || "{}");
    expect(body).toHaveProperty("performance");
    expect(Array.isArray(body.performance)).toBe(true);
  });

  test("POST /api/debug/clear clears logs", async () => {
    const res = await app.inject({ method: "POST", url: "/api/debug/clear" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || "{}");
    expect(body).toHaveProperty("ok", true);
  });

  test("POST /api/debug/query (kb-check) returns result", async () => {
    const res = await app.inject({ method: "POST", url: "/api/debug/query", payload: { type: "kb-check" } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || "{}");
    expect(body).toHaveProperty("ok");
  });
});
