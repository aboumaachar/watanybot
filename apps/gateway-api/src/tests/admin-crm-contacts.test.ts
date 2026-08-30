import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const listContacts = vi.fn();
vi.mock("../integrations/erpnext/client.js", () => ({
  ErpNextClient: class { listContacts = listContacts; },
  ErpNextRequestError: class extends Error {
    statusCode: number;
    safeCode: string;
    constructor(statusCode: number, safeCode: string) { super(safeCode); this.statusCode = statusCode; this.safeCode = safeCode; }
  },
}));

describe("admin CRM contacts route", () => {
  afterEach(() => vi.resetAllMocks());

  async function buildApp() {
    process.env.JWT_SECRET = "crm-route-regression-secret";
    const { registerAuthHook, signAccessToken } = await import("../auth/auth-middleware.js");
    const { adminCrmContactsRoutes } = await import("../routes/admin-crm-contacts.js");
    const app = Fastify();
    registerAuthHook(app);
    await app.register(adminCrmContactsRoutes, { prefix: "/api" });
    await app.ready();
    return { app, signAccessToken };
  }

  it("denies unauthenticated CRM reads", async () => {
    const { app } = await buildApp();
    try { expect((await app.inject({ method: "GET", url: "/api/admin-authority/crm/contacts" })).statusCode).toBe(401); }
    finally { await app.close(); }
  });

  it("returns the safe unconfigured credential error", async () => {
    const { app, signAccessToken } = await buildApp();
    try {
      const { ErpNextRequestError } = await import("../integrations/erpnext/client.js");
      listContacts.mockRejectedValueOnce(new ErpNextRequestError(503, "erpnext_credential_source_unconfigured"));
      const token = signAccessToken({ sub: "crm-test", role: "superadmin", email: "crm@test.local" });
      const response = await app.inject({ method: "GET", url: "/api/admin-authority/crm/contacts", headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ ok: false, error: "erpnext_credential_source_unconfigured" });
    } finally { await app.close(); }
  });

  it("returns bounded ERPNext contacts for superadmin", async () => {
    listContacts.mockResolvedValueOnce([{ name: "CONTACT-1", first_name: "Ada" }]);
    const { app, signAccessToken } = await buildApp();
    try {
      const token = signAccessToken({ sub: "crm-test", role: "superadmin", email: "crm@test.local" });
      const response = await app.inject({ method: "GET", url: "/api/admin-authority/crm/contacts?limit=200", headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ ok: true, doctype: "Contact", bounded: true, items: [{ name: "CONTACT-1" }] });
      expect(listContacts).toHaveBeenCalledWith(200);
    } finally { await app.close(); }
  });
});