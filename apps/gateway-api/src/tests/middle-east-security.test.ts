import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, getClientMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  getClientMock: vi.fn(),
}));

vi.mock("../lib/db.js", () => ({ query: queryMock, getClient: getClientMock }));

import { registerMiddleEastSecurityRoutes } from "../koudama/surveys/middle-east-security/middleEastSecurity.routes.js";
import {
  createMiddleEastSecurityApplication,
  getMiddleEastSecurityApplication,
  hashMiddleEastSecuritySecret,
  listMiddleEastSecurityApplicationHistory,
  listMiddleEastSecurityApplications,
  listAllMiddleEastSecurityApplications,
  listMiddleEastSecurityApplicationsForOwner,
  payloadHash,
  updateMiddleEastSecurityApplication,
} from "../koudama/surveys/middle-east-security/middleEastSecurity.repository.js";

const validInput = {
  full_name: "مستخدم تجريبي",
  birth_date: "1990-01-01",
  age_years: 36,
  birth_place: "بيروت",
  phone: "+96170123456",
  preferred_location: "بيروت",
  mohafaza: "عكار",
  mohafaza_id: "LB-GOV-0B6790F71D48",
  caza: "عكار",
  caza_id: "LB-DIST-C08378A1F450",
  village: "العبودية",
  village_id: "LB-LOC-35249",
  village_pcode: "35249",
  location_dataset_version: "1.1.1",
  location_approval_status: "approvedCanonical",
  arabic_read: "جيد",
  arabic_write: "جيد",
  english_read: "وسط",
  english_write: "لا أجيد",
  security_training: false,
  ngo_experience: false,
};

const row = {
  ...validInput,
  id: "MES-test",
  user_id: "user-a",
  campaign_id: "middle-east-security",
  mohafaza: "عكار",
  mohafaza_id: "LB-GOV-0B6790F71D48",
  caza: "عكار",
  caza_id: "LB-DIST-C08378A1F450",
  village: "العبودية",
  village_id: "LB-LOC-35249",
  village_pcode: "35249",
  location_dataset_version: "1.1.1",
  location_approval_status: "approvedCanonical",
  status: "pending",
  follow_up_status: "not_contacted",
  admin_notes: "",
  version: 1,
  created_at: "2026-09-15T10:00:00.000Z",
  updated_at: "2026-09-15T10:00:00.000Z",
};

function transactionClient(current = row) {
  const next = { ...current, status: "approved", version: Number(current.version) + 1, updated_at: "2026-09-15T10:01:00.000Z" };
  const client = {
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes("SELECT * FROM middle_east_security_applications")) return Promise.resolve({ rows: [current] });
      if (sql.includes("UPDATE middle_east_security_applications")) return Promise.resolve({ rows: [next] });
      if (sql.includes("SELECT COALESCE(MAX(version)")) return Promise.resolve({ rows: [{ next_version: 1 }] });
      if (sql.includes("INSERT INTO admin_entity_versions")) return Promise.resolve({ rows: [{ created_at: "2026-09-15T10:01:00.000Z" }] });
      if (sql.includes("INSERT INTO admin_audit_events")) return Promise.resolve({ rows: [{ created_at: "2026-09-15T10:01:00.000Z" }] });
      return Promise.resolve({ rows: [] });
    }),
    release: vi.fn(),
  };
  getClientMock.mockResolvedValue(client);
  return client;
}

describe("Middle East Security application contract", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
    getClientMock.mockReset();
  });

  it("persists a valid application once with a durable reference and owner", async () => {
    queryMock.mockResolvedValueOnce({ rows: [row] });
    const result = await createMiddleEastSecurityApplication(validInput, { userId: "user-a", idempotencyKey: "submit-a" });
    expect(result.item.id).toBe("MES-test");
    expect(result.item.status).toBe("pending");
    expect(result.item.preferred_location).toBe("بيروت");
    expect(result.idempotent).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("user_id");
    expect(queryMock.mock.calls[0][1]).toContain("user-a");
  });

  it.each(["full_name", "birth_date", "birth_place", "phone", "preferred_location", "mohafaza_id", "caza_id", "village_id", "security_training", "ngo_experience"])(
    "rejects missing required field %s before persistence",
    async (field) => {
      const input = { ...validInput, [field]: "" };
      await expect(createMiddleEastSecurityApplication(input)).rejects.toThrow("MISSING_REQUIRED_FIELD");
      expect(queryMock).not.toHaveBeenCalled();
    },
  );

  it.each(["القبيات", "صور", "عرسال", "زحلة", "الضبية", "طريق المطار", "invalid"])(
    "rejects non-approved location %s",
    async (location) => {
      await expect(createMiddleEastSecurityApplication({ ...validInput, preferred_location: location })).rejects.toThrow("INVALID_LOCATION");
      expect(queryMock).not.toHaveBeenCalled();
    },
  );

  it("rejects a caza outside the submitted mohafaza and a village outside the submitted caza", async () => {
    await expect(createMiddleEastSecurityApplication({
      ...validInput,
      caza: "طرابلس",
      caza_id: "LB-DIST-2A4D7F1D2B2A",
    })).rejects.toThrow("INVALID_CAZA_HIERARCHY");
    await expect(createMiddleEastSecurityApplication({
      ...validInput,
      village: "بيروت",
      village_id: "LB-LOC-DOES-NOT-BELONG",
    })).rejects.toThrow("INVALID_VILLAGE_HIERARCHY");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("reads a legacy MES record without structured address fields", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        ...row,
        address: "عنوان تاريخي",
        mohafaza: null,
        mohafaza_id: null,
        caza: null,
        caza_id: null,
        village: null,
        village_id: null,
        village_pcode: null,
        location_dataset_version: null,
        location_approval_status: null,
      }],
    });
    const legacy = await getMiddleEastSecurityApplication(row.id);
    expect(legacy?.address).toBe("عنوان تاريخي");
    expect(legacy?.mohafaza_id).toBeUndefined();
  });

  it("accepts only valid phone values and enforces conditional details", async () => {
    await expect(createMiddleEastSecurityApplication({ ...validInput, age_years: "62.5" })).rejects.toThrow("INVALID_AGE_YEARS");
    await expect(createMiddleEastSecurityApplication({ ...validInput, age_years: 0 })).rejects.toThrow("INVALID_AGE_YEARS");
    await expect(createMiddleEastSecurityApplication({ ...validInput, birth_date: "not-a-date" })).rejects.toThrow("INVALID_BIRTH_DATE");
    await expect(createMiddleEastSecurityApplication({ ...validInput, phone: "123" })).rejects.toThrow("INVALID_PHONE");
    await expect(createMiddleEastSecurityApplication({ ...validInput, security_training: true })).rejects.toThrow("MISSING_SECURITY_TRAINING_DETAILS");
    await expect(createMiddleEastSecurityApplication({ ...validInput, ngo_experience: true })).rejects.toThrow("MISSING_NGO_DETAILS");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("maps historic rows with no age without inferring from birth_date", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...row, age_years: null, birth_date: "1960-01-01" }] });
    const historic = await getMiddleEastSecurityApplication(row.id);
    expect(historic?.age_years).toBeUndefined();
  });

  it("uses a non-guessable anonymous tracker and never authorizes by phone", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...row, user_id: null, anonymous_tracking_token_hash: hashMiddleEastSecuritySecret("tracker-a") }] });
    const result = await createMiddleEastSecurityApplication(validInput, { trackingToken: "tracker-a", idempotencyKey: "anon-a" });
    expect(result.trackingToken).toBe("tracker-a");
    expect(queryMock.mock.calls[0][1]).not.toContain("tracker-a");
    queryMock.mockReset();
    queryMock.mockResolvedValueOnce({ rows: [{ ...row, user_id: null }] });
    await listMiddleEastSecurityApplicationsForOwner({ trackingToken: "tracker-a" });
    expect(queryMock.mock.calls[0][0]).toContain("anonymous_tracking_token_hash");
    expect(queryMock.mock.calls[0][1]).toEqual([hashMiddleEastSecuritySecret("tracker-a")]);
  });

  it("returns the existing row for a repeated idempotency key without creating a duplicate", async () => {
    const expectedPayloadHash = payloadHash({
      ...validInput,
      age_years: "36",
      address: "عكار - عكار - العبودية",
      security_training_details: "",
      ngo_details: "",
      notes: "",
    });
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...row, idempotency_payload_hash: expectedPayloadHash }] });
    const result = await createMiddleEastSecurityApplication(validInput, { userId: "user-a", idempotencyKey: "submit-a" });
    expect(result.idempotent).toBe(true);
    expect(result.item.id).toBe(row.id);
    expect(queryMock.mock.calls[0][0]).toContain("ON CONFLICT");
    expect(queryMock.mock.calls[1][0]).toContain("idempotency_scope");
  });

  it("supports deterministic search, status/follow-up filters, pagination, and summary counts", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 11 }] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [{ status: "pending", count: 7 }, { status: "approved", count: 4 }] });
    const result = await listMiddleEastSecurityApplications({
      q: "بيروت",
      status: "pending",
      followUpStatus: "to_contact",
      page: 2,
      pageSize: 5,
    });

    expect(result.total).toBe(11);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.summary).toEqual({ total: 11, pending: 7, approved: 4, rejected: 0 });
    expect(queryMock.mock.calls[0][0]).toContain("follow_up_status = $2");
    expect(queryMock.mock.calls[1][0]).toContain("ORDER BY created_at DESC, id DESC");
    expect(queryMock.mock.calls[1][0]).toContain("LIMIT $4 OFFSET $5");
  });

  it("iterates every page for bounded all-row export selection", async () => {
    const pageOneRows = Array.from({ length: 100 }, (_, index) => ({ ...row, id: `MES-page-${index}` }));
    const pageTwoRows = [{ ...row, id: "MES-page-100" }];
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 101 }] })
      .mockResolvedValueOnce({ rows: pageOneRows })
      .mockResolvedValueOnce({ rows: [{ status: "pending", count: 101 }] })
      .mockResolvedValueOnce({ rows: [{ total: 101 }] })
      .mockResolvedValueOnce({ rows: pageTwoRows })
      .mockResolvedValueOnce({ rows: [{ status: "pending", count: 101 }] });
    const result = await listAllMiddleEastSecurityApplications({ status: "pending" });
    expect(result.total).toBe(101);
    expect(result.items).toHaveLength(101);
    expect(result.items.at(-1)?.id).toBe("MES-page-100");
    expect(queryMock).toHaveBeenCalledTimes(6);
  });

  it("isolates applied jobs queries by authenticated user or tracker", async () => {
    expect(await listMiddleEastSecurityApplicationsForOwner({})).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
    queryMock.mockResolvedValueOnce({ rows: [row] });
    const mine = await listMiddleEastSecurityApplicationsForOwner({ userId: "user-a" });
    expect(mine).toHaveLength(1);
    expect(queryMock.mock.calls[0][0]).toContain("WHERE user_id = $1");
    expect(queryMock.mock.calls[0][1]).toEqual(["user-a"]);

    queryMock.mockReset();
    queryMock.mockResolvedValueOnce({ rows: [] });
    const other = await listMiddleEastSecurityApplicationsForOwner({ userId: "user-b" });
    expect(other).toHaveLength(0);
    expect(queryMock.mock.calls[0][1]).toEqual(["user-b"]);
  });

  it("denies unauthenticated admin reads and allows ADMIN and SUPERADMIN", async () => {
    const unauthenticated = Fastify();
    await registerMiddleEastSecurityRoutes(unauthenticated);
    const denied = await unauthenticated.inject({ method: "GET", url: "/api/superadmin/middle-east-security/applications" });
    expect(denied.statusCode).toBe(403);
    await unauthenticated.close();

    for (const role of ["ADMIN", "SUPERADMIN"]) {
      const admin = Fastify();
      admin.addHook("onRequest", async (request) => { (request as any).user = { id: `actor-${role}`, role }; });
      await registerMiddleEastSecurityRoutes(admin);
      queryMock
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [{ status: "pending", count: 1 }] });
      const response = await admin.inject({ method: "GET", url: "/api/superadmin/middle-east-security/applications" });
      expect(response.statusCode).toBe(200);
      await admin.close();
      queryMock.mockReset();
      queryMock.mockResolvedValue({ rows: [] });
    }
  });

  it("increments the exact integer version and writes audit/history only after success", async () => {
    const client = transactionClient(row);
    const updated = await updateMiddleEastSecurityApplication(
      row.id,
      { status: "approved", expectedVersion: 1 },
      { id: "actor-a", role: "ADMIN" },
    );
    expect(updated?.version).toBe(2);
    const updateSql = client.query.mock.calls.find((call: [string]) => call[0].includes("UPDATE middle_east_security_applications"))?.[0] || "";
    expect(updateSql).toContain("version = version + 1");
    expect(updateSql).toContain("updated_at = NOW()");
    expect(client.query.mock.calls.some((call: [string]) => call[0].includes("INSERT INTO admin_entity_versions"))).toBe(true);
    expect(client.query.mock.calls.some((call: [string]) => call[0].includes("INSERT INTO admin_audit_events"))).toBe(true);

    const staleClient = transactionClient({ ...row, version: 2 });
    await expect(updateMiddleEastSecurityApplication(row.id, { status: "rejected", expectedVersion: 1 }, "actor-b")).rejects.toThrow("APPLICATION_STALE_VERSION");
    expect(staleClient.query.mock.calls.some((call: [string]) => call[0].includes("UPDATE middle_east_security_applications"))).toBe(false);
  });

  it("persists follow-up mutations and exposes submitted plus management history", async () => {
    const client = transactionClient(row);
    await updateMiddleEastSecurityApplication(row.id, { followUpStatus: "contacted", expectedVersion: 1 }, "actor-a");
    const updateSql = client.query.mock.calls.find((call: [string]) => call[0].includes("UPDATE middle_east_security_applications"))?.[0] || "";
    expect(updateSql).toContain("follow_up_status = $2");

    queryMock.mockImplementation((sql: string) => {
      if (sql.includes("FROM middle_east_security_applications")) return Promise.resolve({ rows: [row] });
      if (sql.includes("FROM admin_entity_versions")) {
        return Promise.resolve({
          rows: [{ version: 1, snapshot: { status: "approved", followUpStatus: "contacted", adminNotes: "", version: 2, updatedAt: row.updated_at }, created_by: "actor-a", created_at: row.updated_at }],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const history = await listMiddleEastSecurityApplicationHistory(row.id);
    expect(history.map((entry) => entry.eventType)).toEqual(["MANAGEMENT_UPDATED", "SUBMITTED"]);
    expect(history[0].snapshot.followUpStatus).toBe("contacted");
  });
});
