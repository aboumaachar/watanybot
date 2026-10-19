import Fastify from "fastify";
import * as XLSX from "xlsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listMock, listAllMock, getMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  listAllMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock("../koudama/surveys/middle-east-security/middleEastSecurity.repository.js", () => ({
  listMiddleEastSecurityApplications: listMock,
  listAllMiddleEastSecurityApplications: listAllMock,
  getMiddleEastSecurityApplication: getMock,
}));

import { registerMiddleEastSecurityShareRoutes } from "../koudama/surveys/middle-east-security/middleEastSecurity.share.js";
import { registerMiddleEastSecurityRoutes } from "../koudama/surveys/middle-east-security/middleEastSecurity.routes.js";

const token = "mes-share-test-token-".padEnd(64, "x");
const item = {
  id: "MES-share-1",
  full_name: "مستخدم مشاركة",
  birth_date: "1990-01-01",
  age_years: 36,
  birth_place: "بيروت",
  address: "بيروت - بيروت - بيروت",
  mohafaza: "بيروت",
  caza: "بيروت",
  village: "بيروت",
  phone: "+96170123456",
  preferred_location: "بيروت",
  arabic_read: "جيد",
  arabic_write: "جيد",
  english_read: "وسط",
  english_write: "لا أجيد",
  security_training: false,
  ngo_experience: false,
  notes: "ملاحظة مشاركة",
  status: "pending",
  followUpStatus: "not_contacted",
  adminNotes: "internal note",
  version: 3,
  userId: "private-user",
  createdAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T00:00:00.000Z",
};

const listResult = {
  items: [item],
  total: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  summary: { total: 1, pending: 1, approved: 0, rejected: 0 },
};

describe("Middle East Security share capability", () => {
  beforeEach(() => {
    process.env.MES_SHARE_TOKEN = token;
    listMock.mockResolvedValue(listResult);
    listAllMock.mockResolvedValue({ items: listResult.items, total: listResult.total });
    getMock.mockResolvedValue(item);
  });

  afterEach(() => {
    delete process.env.MES_SHARE_TOKEN;
    listMock.mockReset();
    listAllMock.mockReset();
    getMock.mockReset();
  });

  it("fails closed for invalid share tokens", async () => {
    const app = Fastify();
    await registerMiddleEastSecurityShareRoutes(app);
    const response = await app.inject({
      method: "GET",
      url: `/api/share/jobs/middle-east-security/${"invalid".padEnd(64, "x")}/applications`,
    });
    expect(response.statusCode).toBe(404);
    expect(listMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns only the safe read-only projection for a valid token", async () => {
    const app = Fastify();
    await registerMiddleEastSecurityShareRoutes(app);
    const response = await app.inject({
      method: "GET",
      url: `/api/share/jobs/middle-east-security/${token}/applications`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as typeof listResult;
    expect(body.items[0]).toMatchObject({ id: item.id, full_name: item.full_name, status: item.status });
    expect(body.items[0]).not.toHaveProperty("adminNotes");
    expect(body.items[0]).not.toHaveProperty("userId");
    expect(body.items[0]).not.toHaveProperty("version");
    await app.close();
  });

  it("exports the represented result set as a valid xlsx", async () => {
    const app = Fastify();
    await registerMiddleEastSecurityShareRoutes(app);
    const response = await app.inject({
      method: "GET",
      url: `/api/share/jobs/middle-east-security/${token}/export.xlsx?status=pending`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers["content-disposition"]).toContain(".xlsx");
    const workbook = XLSX.read(response.rawPayload, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Applications);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Full name"]).toBe(item.full_name);
    expect(rows[0]).not.toHaveProperty("adminNotes");
    await app.close();
  });

  it("supports later list pages and exports all filtered rows", async () => {
    const second = { ...item, id: "MES-share-2", full_name: "مستخدم مشاركة 2" };
    listMock.mockImplementation(async (filters: { page?: string }) => ({
      ...listResult,
      items: filters.page === "2" ? [second] : [item],
      total: 2,
      totalPages: 2,
      page: Number(filters.page || 1),
      pageSize: 1,
    }));
    listAllMock.mockResolvedValue({ items: [item, second], total: 2 });
    const app = Fastify();
    await registerMiddleEastSecurityShareRoutes(app);
    const pageTwo = await app.inject({
      method: "GET",
      url: `/api/share/jobs/middle-east-security/${token}/applications?page=2&page_size=1`,
    });
    expect(pageTwo.statusCode).toBe(200);
    expect(pageTwo.json().page).toBe(2);
    expect(pageTwo.json().items[0].id).toBe(second.id);
    const exportResponse = await app.inject({
      method: "GET",
      url: `/api/share/jobs/middle-east-security/${token}/export.xlsx?status=pending`,
    });
    const workbook = XLSX.read(exportResponse.rawPayload, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Applications);
    expect(rows).toHaveLength(2);
    expect(listAllMock).toHaveBeenCalledWith({ q: undefined, status: "pending", followUpStatus: undefined });
    await app.close();
  });

  it("keeps the existing admin mutation endpoint denied without authentication", async () => {
    const app = Fastify();
    await registerMiddleEastSecurityRoutes(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/superadmin/middle-east-security/applications/MES-share-1",
      payload: { status: "approved", expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("sets no-store and no-referrer headers on share responses", async () => {
    const app = Fastify();
    await registerMiddleEastSecurityShareRoutes(app);
    const response = await app.inject({
      method: "GET",
      url: `/api/share/jobs/middle-east-security/${token}/applications`,
    });
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    await app.close();
  });
});
