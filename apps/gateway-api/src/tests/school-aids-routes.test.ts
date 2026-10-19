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
  it("serves only image-backed public forms", async () => {
    const res = await app.inject({ method: "GET", url: "/api/school-aids/items" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { forms: Array<{ id: string; previewUrl: string; downloadUrl: string; sourceStatus: string; preferUniversal?: boolean }> };
    expect(body.forms).toHaveLength(3);
    const isImageUrl = (url: string) => /\.(?:png|jpe?g|webp)(?:$|[?#])/i.test(url);
    for (const item of body.forms) {
      expect(isImageUrl(item.previewUrl)).toBe(true);
      expect(isImageUrl(item.downloadUrl)).toBe(true);
      expect(item.sourceStatus).toBe("OFFICIAL_FILE_ATTACHED");
      expect(item.preferUniversal).toBe(true);
    }
    expect(body.forms.some((item) => item.id === "school-aid-application")).toBe(false);
  });
});
