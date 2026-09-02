import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, getClientMock } = vi.hoisted(() => ({ queryMock: vi.fn(), getClientMock: vi.fn() }));
vi.mock("../lib/db.js", () => ({ query: queryMock, getClient: getClientMock }));

import { registerAinMreissehBuildingAssistantRoutes } from "../koudama/surveys/ain-mreisseh-building-assistant/ainMreissehBuildingAssistant.routes.js";
import { createAinMreissehBuildingAssistantApplication } from "../koudama/surveys/ain-mreisseh-building-assistant/ainMreissehBuildingAssistant.repository.js";

const validInput = {
  name: "مستخدم تجريبي",
  phone: "+96170123456",
  age: "35",
  email: "candidate@example.com",
  governorate: "عكار",
  governorateAr: "عكار",
  caza: "عكار",
  cazaAr: "عكار",
  village: "العبودية",
  villageAr: "العبودية",
  villageId: "LB-LOC-35249",
  canWorkFullTime: "نعم",
  acceptsSalary600: "نعم",
  wantsHousing: "لا",
  availableStartDate: "2026-07-01",
};

const row = {
  ...validInput,
  id: "AMBA-test",
  campaign_id: "ain-mreisseh-building-assistant",
  governorate_ar: "عكار",
  caza_ar: "عكار",
  village_ar: "العبودية",
  village_id: "LB-LOC-35249",
  can_work_full_time: true,
  accepts_salary_600: true,
  wants_housing: false,
  available_start_date: "2026-07-01",
  status: "pending",
  follow_up_status: "not_contacted",
  admin_notes: "",
  created_at: "2026-06-30T12:00:00.000Z",
  updated_at: "2026-06-30T12:00:00.000Z",
};

describe("Ain Mreisseh building assistant application contract", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
    getClientMock.mockReset();
    getClientMock.mockResolvedValue({
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("FROM ain_mreisseh_building_assistant_applications")) return Promise.resolve({ rows: [row] });
        if (sql.includes("UPDATE ain_mreisseh_building_assistant_applications")) return Promise.resolve({ rows: [row] });
        if (sql.includes("COALESCE(MAX(version)")) return Promise.resolve({ rows: [{ next_version: 1 }] });
        if (sql.includes("RETURNING created_at")) return Promise.resolve({ rows: [{ created_at: "2026-06-30T12:00:00.000Z" }] });
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    });
  });

  it("rejects missing required values before database access", async () => {
    await expect(createAinMreissehBuildingAssistantApplication({ ...validInput, phone: "" })).rejects.toThrow("MISSING_REQUIRED_FIELD");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("rejects invalid phone values", async () => {
    await expect(createAinMreissehBuildingAssistantApplication({ ...validInput, phone: "123" })).rejects.toThrow("INVALID_PHONE");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("rejects invalid optional email values", async () => {
    await expect(createAinMreissehBuildingAssistantApplication({ ...validInput, email: "not-an-email" })).rejects.toThrow("INVALID_EMAIL");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("preserves the canonical location identity and campaign on create", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ok: 1 }] }).mockResolvedValueOnce({ rows: [row] });
    const result = await createAinMreissehBuildingAssistantApplication(validInput);
    expect(result.campaignId).toBe("ain-mreisseh-building-assistant");
    expect(result.villageId).toBe("LB-LOC-35249");
    expect(result.villageAr).toBe("العبودية");
    expect(result.email).toBe("candidate@example.com");
    expect(queryMock.mock.calls[1][0]).toContain("ain_mreisseh_building_assistant_applications");
    expect(queryMock.mock.calls[1][1]).toContain("ain-mreisseh-building-assistant");
  });

  it("rejects unauthenticated admin requests and scopes authorized reads to the campaign", async () => {
    const unauthenticatedApp = Fastify();
    await registerAinMreissehBuildingAssistantRoutes(unauthenticatedApp);
    const denied = await unauthenticatedApp.inject({ method: "GET", url: "/api/superadmin/ain-mreisseh-building-assistant/applications" });
    expect(denied.statusCode).toBe(403);
    await unauthenticatedApp.close();

    const adminApp = Fastify();
    adminApp.addHook("onRequest", async (request) => { (request as any).user = { role: "ADMIN" }; });
    await registerAinMreissehBuildingAssistantRoutes(adminApp);
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [row] });
    const response = await adminApp.inject({ method: "GET", url: "/api/superadmin/ain-mreisseh-building-assistant/applications" });
    expect(response.statusCode).toBe(200);
    expect(response.json().total).toBe(1);
    expect(queryMock.mock.calls[0][0]).toContain("campaign_id = $1");
    await adminApp.close();

    const superadminApp = Fastify();
    superadminApp.addHook("onRequest", async (request) => { (request as any).user = { role: "SUPERADMIN" }; });
    await registerAinMreissehBuildingAssistantRoutes(superadminApp);
    queryMock.mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] });
    const superadminResponse = await superadminApp.inject({ method: "GET", url: "/api/superadmin/ain-mreisseh-building-assistant/applications" });
    expect(superadminResponse.statusCode).toBe(200);
    await superadminApp.close();
  });

  it("updates only the target campaign row and has no destructive operation", async () => {
    queryMock.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    const { updateAinMreissehBuildingAssistantApplication } = await import("../koudama/surveys/ain-mreisseh-building-assistant/ainMreissehBuildingAssistant.repository.js");
    await updateAinMreissehBuildingAssistantApplication("AMBA-test", { status: "approved", adminNotes: "تم التواصل" });
    const client = getClientMock.mock.results[0].value;
    const sql = (client.query.mock.calls.find((call: [string]) => call[0].includes("UPDATE ain_mreisseh"))?.[0] ?? "") as string;
    expect(sql).toContain("WHERE id = $1 AND campaign_id = $2");
    expect(sql.toLowerCase()).not.toMatch(/\b(drop|delete|truncate)\b/);
  });
});
