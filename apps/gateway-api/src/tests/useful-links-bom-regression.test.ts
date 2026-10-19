import { describe, expect, it } from "vitest";
import { registerOfficialSourcesRoutes } from "../routes/official-sources";

describe("useful links BOM-safe loader", () => {
  it("returns the existing official link records", async () => {
    const routes = new Map<string, (req: any, reply: any) => unknown>();
    const app = {
      get: (path: string, handler: any) => routes.set(`GET ${path}`, handler),
      post: () => undefined,
      patch: () => undefined,
    } as any;
    await registerOfficialSourcesRoutes(app);
    const handler = routes.get("GET /api/useful-links");
    expect(handler).toBeTypeOf("function");
    const response = await handler!({ query: { q: "", limit: "100" } }, {});
    expect(response).toMatchObject({ ok: true, total: 12 });
    const items = (response as any).items;
    expect(items).toHaveLength(12);
    expect(items.some((item: any) => item.id === "lebarmy")).toBe(true);
    expect(items.some((item: any) => item.id === "pension_attestation")).toBe(true);
  });
});
