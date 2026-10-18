import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const listContacts = vi.fn();
const getContact = vi.fn();
const deleteContact = vi.fn();
vi.mock("../integrations/erpnext/client.js", () => ({
  ErpNextClient: class { listContacts = listContacts; getContact = getContact; deleteContact = deleteContact; },
  ErpNextRequestError: class extends Error {
    statusCode: number;
    safeCode: string;
    constructor(statusCode: number, safeCode: string) { super(safeCode); this.statusCode = statusCode; this.safeCode = safeCode; }
  },
}));

describe("admin CRM contacts route", () => {
  afterEach(() => vi.resetAllMocks());

  async function buildApp() {
    process.env.NODE_ENV = "test";
    // These cases impersonate superadmin through the dev role header, which is opt-in only.
    process.env.WATANY_ALLOW_DEV_ROLE_HEADER = "true";
    process.env.JWT_SECRET = "crm-route-regression-secret";
    const { registerAuthHook } = await import("../auth/auth-middleware.js");
    const { adminCrmContactsRoutes } = await import("../routes/admin-crm-contacts.js");
    const app = Fastify();
    registerAuthHook(app);
    await app.register(adminCrmContactsRoutes, { prefix: "/api" });
    await app.ready();
    return { app };
  }

  it("denies unauthenticated CRM reads", async () => {
    const { app } = await buildApp();
    try { expect((await app.inject({ method: "GET", url: "/api/admin-authority/crm/contacts" })).statusCode).toBe(401); }
    finally { await app.close(); }
  });

  it("returns the safe unconfigured credential error", async () => {
    const { app } = await buildApp();
    try {
      const { ErpNextRequestError } = await import("../integrations/erpnext/client.js");
      listContacts.mockRejectedValueOnce(new ErpNextRequestError(503, "erpnext_credential_source_unconfigured"));
      const response = await app.inject({ method: "GET", url: "/api/admin-authority/crm/contacts", headers: { "x-watany-role": "superadmin" } });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ ok: false, error: "erpnext_credential_source_unconfigured" });
    } finally { await app.close(); }
  });

  it("reconciles an ambiguous committed delete without repeating DELETE", async () => {
    const { ErpNextRequestError } = await import("../integrations/erpnext/client.js");
    const { deleteContactWithReconciliation } = await import("../routes/admin-crm-contacts.js");
    const timeout = new ErpNextRequestError(502, "erpnext_unavailable");
    deleteContact.mockRejectedValueOnce(timeout);
    getContact.mockResolvedValueOnce({ name: "APEX-CANARY" }).mockRejectedValueOnce(new ErpNextRequestError(404, "erpnext_contact_request_denied"));
    await expect(deleteContactWithReconciliation({ deleteContact, getContact } as any, "APEX-CANARY", [0, 0])).resolves.toEqual({ reconciled: true });
    expect(deleteContact).toHaveBeenCalledTimes(1);
    expect(getContact).toHaveBeenCalledTimes(2);
  });

  it("fails closed after an ambiguous delete when the contact remains", async () => {
    const { ErpNextRequestError } = await import("../integrations/erpnext/client.js");
    const { deleteContactWithReconciliation } = await import("../routes/admin-crm-contacts.js");
    const timeout = new ErpNextRequestError(502, "erpnext_unavailable");
    deleteContact.mockRejectedValueOnce(timeout);
    getContact.mockResolvedValue({ name: "APEX-CANARY" });
    await expect(deleteContactWithReconciliation({ deleteContact, getContact } as any, "APEX-CANARY", [0, 0])).rejects.toMatchObject({ statusCode: 502, safeCode: "erpnext_unavailable" });
    expect(deleteContact).toHaveBeenCalledTimes(1);
    expect(getContact).toHaveBeenCalledTimes(2);
  });

  it("returns bounded ERPNext contacts for superadmin", async () => {
    listContacts.mockResolvedValueOnce([{ name: "CONTACT-1", first_name: "Ada" }]);
    const { app } = await buildApp();
    try {
      const response = await app.inject({ method: "GET", url: "/api/admin-authority/crm/contacts?limit=200", headers: { "x-watany-role": "superadmin" } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ ok: true, doctype: "Contact", bounded: true, items: [{ name: "CONTACT-1" }] });
      expect(listContacts).toHaveBeenCalledWith(200);
    } finally { await app.close(); }
  });
});