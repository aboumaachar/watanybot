import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac.js";
import { appendAdminAuditEvent, createAdminAuditEvent } from "../admin-authority/adminAuthorityAudit.js";

const ADS_TXT_LINE = "google.com, pub-6562406855952870, DIRECT, f08c47fec0942fa0";
const STORE_PATH = path.resolve(process.cwd(), "runtime", "ads-control.json");
type Provider = { id: string; name: string; status: "configured" | "not_configured"; accountId: string | null };
type Placement = { id: string; name: string; routePattern: string; format: "display" | "native" | "house"; enabled: boolean; priority: number; startAt: string | null; endAt: string | null; creative: string | null };
type AdsStore = { provider: Provider; placements: Placement[] };
const defaultStore: AdsStore = { provider: { id: "google-adsense", name: "Google AdSense", status: "not_configured", accountId: null }, placements: [] };

async function loadStore(): Promise<AdsStore> {
  try {
    const parsed = JSON.parse(await readFile(STORE_PATH, "utf8")) as Partial<AdsStore>;
    const provider = parsed.provider;
    return { provider: provider ? { id: provider.id || defaultStore.provider.id, name: provider.name || defaultStore.provider.name, status: provider.status === "configured" ? "configured" : "not_configured", accountId: provider.accountId || null } : defaultStore.provider, placements: Array.isArray(parsed.placements) ? parsed.placements : [] };
  } catch { return defaultStore; }
}
async function saveStore(store: AdsStore): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}
async function audit(request: any, eventType: string, entityType: string, entityId: string, before: unknown, after: unknown): Promise<void> {
  await appendAdminAuditEvent(createAdminAuditEvent({ eventType, actorId: String(request.user?.id || "unknown_admin"), entityType, entityId, before, after, reason: "Universal Dashboard Ads control-plane mutation", requestId: String(request.id || `ads-${Date.now()}`), ip: request.ip ? String(request.ip) : undefined, userAgent: request.headers?.["user-agent"] ? String(request.headers["user-agent"]) : undefined }));
}
function validPlacement(body: any): boolean {
  return Boolean(body && typeof body.name === "string" && body.name.trim() && typeof body.routePattern === "string" && body.routePattern.trim() && ["display", "native", "house"].includes(body.format) && Number.isInteger(body.priority));
}

export async function adminAdsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/ads/status", { preHandler: [requireRole("admin")] }, async (_request, reply) => {
    const store = await loadStore();
    return reply.send({ ok: true, owner: "Gateway Ads Authority", provider: store.provider, placements: store.placements, adsTxt: ADS_TXT_LINE, audit: "Gateway admin audit authority" });
  });
  app.put("/api/admin/ads/provider", { preHandler: [requireRole("superadmin")] }, async (request, reply) => {
    const body = request.body as any;
    if (!body || typeof body.name !== "string" || !body.name.trim()) return reply.code(400).send({ error: "INVALID_PROVIDER" });
    const store = await loadStore(); const before = store.provider;
    store.provider = { id: String(body.id || before.id), name: body.name.trim(), status: body.accountId ? "configured" : "not_configured", accountId: body.accountId ? String(body.accountId) : null };
    await saveStore(store); await audit(request, "ads.provider.updated", "ads_provider", store.provider.id, before, store.provider);
    return reply.send({ ok: true, provider: store.provider });
  });
  app.post("/api/admin/ads/placements", { preHandler: [requireRole("superadmin")] }, async (request, reply) => {
    const body = request.body as any;
    if (!validPlacement(body)) return reply.code(400).send({ error: "INVALID_PLACEMENT" });
    const store = await loadStore();
    const placement: Placement = { id: `placement-${randomUUID()}`, name: body.name.trim(), routePattern: body.routePattern.trim(), format: body.format, enabled: body.enabled !== false, priority: body.priority, startAt: body.startAt || null, endAt: body.endAt || null, creative: body.creative || null };
    store.placements.push(placement); await saveStore(store); await audit(request, "ads.placement.created", "ads_placement", placement.id, null, placement);
    return reply.code(201).send({ ok: true, placement });
  });
  app.patch<{ Params: { id: string } }>("/api/admin/ads/placements/:id", { preHandler: [requireRole("superadmin")] }, async (request, reply) => {
    const body = request.body as any; const store = await loadStore(); const index = store.placements.findIndex((item) => item.id === request.params.id);
    if (index < 0) return reply.code(404).send({ error: "PLACEMENT_NOT_FOUND" });
    const before = store.placements[index]; const next = { ...before, ...body, id: before.id } as Placement;
    if (!validPlacement(next)) return reply.code(400).send({ error: "INVALID_PLACEMENT" });
    store.placements[index] = next; await saveStore(store); await audit(request, "ads.placement.updated", "ads_placement", next.id, before, next);
    return reply.send({ ok: true, placement: next });
  });
  app.get("/api/admin/ads/ads-txt", { preHandler: [requireRole("admin")] }, async (_request, reply) => reply.send({ ok: true, line: ADS_TXT_LINE, source: "Gateway Ads Authority" }));
  app.get<{ Params: { id: string } }>("/api/admin/ads/placements/:id/preview", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const placement = (await loadStore()).placements.find((item) => item.id === request.params.id);
    if (!placement) return reply.code(404).send({ error: "PLACEMENT_NOT_FOUND" });
    return reply.send({ ok: true, preview: { route: placement.routePattern, format: placement.format, creative: placement.creative || "HOUSE_FALLBACK", enabled: placement.enabled } });
  });
}
export default adminAdsRoutes;
