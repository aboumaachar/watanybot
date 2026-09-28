import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, getClientMock, locatorMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  getClientMock: vi.fn(),
  locatorMock: vi.fn(),
}));

vi.mock("../lib/db.js", () => ({ query: queryMock, getClient: getClientMock }));
vi.mock("../koudama/surveys/middle-east-security/middleEastSecurity.address.js", () => ({ resolveMiddleEastSecurityAddress: locatorMock }));
vi.mock("../koudama/surveys/middle-east-security/middleEastSecurity.repository.js", () => ({ listMiddleEastSecurityApplicationsForOwner: vi.fn().mockResolvedValue([]) }));
vi.mock("../admin-authority/adminAuthorityAudit.js", () => ({
  appendAdminAuditEventInTransaction: vi.fn().mockResolvedValue(undefined),
  createAdminAuditEvent: vi.fn((input) => input),
}));
vi.mock("../admin-authority/adminAuthorityStore.js", () => ({
  createAdminAuthorityId: vi.fn(() => "authority-test"),
  createAdminEntityVersionRowInTransaction: vi.fn().mockResolvedValue(undefined),
  ensureAdminAuthorityTables: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../admin-authority/adminAuthorityVersioning.js", () => ({ listAdminEntityVersions: vi.fn().mockResolvedValue([]) }));

import {
  canManageUniversalJobTemplate,
  createUniversalJobApplication,
  listUniversalJobApplicationsForOwner,
} from "../civilian-jobs/universal-job-applications.repository.js";

const fields = [
  { key: "full_name", labelAr: "الاسم الثلاثي", type: "text", required: true, reusableFromProfile: true, reusableFromPrevious: true },
  { key: "birth_date", labelAr: "تاريخ الميلاد", type: "date", required: true, reusableFromPrevious: true },
  { key: "age_years", labelAr: "العمر بالسنوات", type: "integer", required: true, min: 1, max: 130, reusableFromPrevious: true },
  { key: "phone", labelAr: "رقم الهاتف", type: "phone", required: true, reusableFromProfile: true, reusableFromPrevious: true },
  { key: "location", labelAr: "مكان السكن", type: "universal_locator", required: true, reusableFromPrevious: true },
  { key: "accredited_driver", labelAr: "هل أنت سائق جرافة معتمد؟", type: "yes_no", required: true },
  { key: "accreditation_type", labelAr: "نوع الاعتماد", type: "text", required: true, condition: { field: "accredited_driver", equals: true } },
  { key: "years_experience", labelAr: "سنوات الخبرة", type: "integer", required: true, min: 0, max: 70 },
] as const;

const templateRow = {
  id: "uat-accredited-bulldozer-driver",
  slug: "accredited-bulldozer-driver",
  employer_id: "private-employer",
  employer_name: "جهة توظيف خاصة",
  owner_user_id: null,
  job_id: "opp-accredited-bulldozer-driver",
  name: "نموذج طلب توظيف – سائق جرافة معتمد",
  title_ar: "فرصة عمل – سائق جرافة معتمد",
  intro_ar: "طلب توظيف",
  employment_type: "FULL_TIME",
  status: "published",
  allow_profile_autofill: true,
  allow_previous_autofill: true,
  allow_blank_start: true,
  current_version: 1,
  draft_fields_json: fields,
  draft_settings_json: { locationMode: "universal_locator" },
  created_at: "2026-09-28T09:00:00.000Z",
  updated_at: "2026-09-28T09:00:00.000Z",
};

const applicationRow = {
  id: "JOBAPP-test",
  reference: "JOB-TEST-001",
  template_id: templateRow.id,
  template_version: 1,
  job_id: templateRow.job_id,
  employer_id: templateRow.employer_id,
  applicant_user_id: "user-a",
  anonymous_tracking_token_hash: null,
  prefill_source: "blank",
  prefill_source_application_id: null,
  applicant_name: "سائق تجريبي",
  phone: "+96170123456",
  age_years: 42,
  address: "قرب البلدية",
  mohafaza: "عكار",
  mohafaza_id: "LB-GOV-0B6790F71D48",
  caza: "عكار",
  caza_id: "LB-DIST-C08378A1F450",
  village: "العبودية",
  village_id: "LB-LOC-35249",
  village_pcode: "35249",
  location_dataset_version: "1.1.1",
  location_approval_status: "approvedCanonical",
  answers_json: { full_name: "سائق تجريبي", birth_date: "1984-01-01", age_years: 42, phone: "+96170123456", accredited_driver: true, accreditation_type: "شهادة تشغيل", years_experience: 8 },
  status: "pending",
  follow_up_status: "not_contacted",
  admin_notes: "",
  version: 1,
  created_at: "2026-09-28T09:00:00.000Z",
  updated_at: "2026-09-28T09:00:00.000Z",
};

const validInput = {
  answers: {
    full_name: "سائق تجريبي",
    birth_date: "1984-01-01",
    age_years: 42,
    phone: "+96170123456",
    accredited_driver: true,
    accreditation_type: "شهادة تشغيل",
    years_experience: 8,
  },
  address: {
    address: "قرب البلدية",
    mohafaza: "عكار",
    mohafaza_id: "LB-GOV-0B6790F71D48",
    caza: "عكار",
    caza_id: "LB-DIST-C08378A1F450",
    village: "العبودية",
    village_id: "LB-LOC-35249",
    village_pcode: "35249",
    location_dataset_version: "1.1.1",
    location_approval_status: "approvedCanonical",
  },
  prefillSource: "blank" as const,
};

function mockPublishedTemplate() {
  queryMock
    .mockResolvedValueOnce({ rows: [templateRow] })
    .mockResolvedValueOnce({ rows: [{ fields_json: fields, settings_json: templateRow.draft_settings_json }] });
}

describe("universal job application engine", () => {
  beforeEach(() => {
    queryMock.mockReset();
    getClientMock.mockReset();
    locatorMock.mockReset();
    locatorMock.mockResolvedValue({
      address: "قرب البلدية",
      mohafaza: "عكار",
      mohafaza_id: "LB-GOV-0B6790F71D48",
      caza: "عكار",
      caza_id: "LB-DIST-C08378A1F450",
      village: "العبودية",
      village_id: "LB-LOC-35249",
      village_pcode: "35249",
      location_dataset_version: "1.1.1",
      location_approval_status: "approvedCanonical",
    });
  });

  it("creates one owner-bound bulldozer application using the universal locator", async () => {
    mockPublishedTemplate();
    queryMock.mockResolvedValueOnce({ rows: [applicationRow] });
    const result = await createUniversalJobApplication("accredited-bulldozer-driver", validInput, { userId: "user-a", idempotencyKey: "submit-a" });
    expect(result.idempotent).toBe(false);
    expect(result.item.reference).toBe("JOB-TEST-001");
    expect(result.item.ageYears).toBe(42);
    expect(result.item.mohafazaId).toBe("LB-GOV-0B6790F71D48");
    expect(locatorMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[2][0]).toContain("ON CONFLICT");
    expect(queryMock.mock.calls[2][1]).toContain("user-a");
  });

  it("rejects missing age and invalid integer values before insert", async () => {
    mockPublishedTemplate();
    const missing = { ...validInput, answers: { ...validInput.answers, age_years: undefined } };
    await expect(createUniversalJobApplication("accredited-bulldozer-driver", missing, { userId: "user-a", idempotencyKey: "missing-age" })).rejects.toThrow("MISSING_REQUIRED_FIELD:age_years");
    expect(queryMock).toHaveBeenCalledTimes(2);

    queryMock.mockReset();
    mockPublishedTemplate();
    const decimal = { ...validInput, answers: { ...validInput.answers, age_years: 42.5 } };
    await expect(createUniversalJobApplication("accredited-bulldozer-driver", decimal, { userId: "user-a", idempotencyKey: "decimal-age" })).rejects.toThrow("INVALID_INTEGER:age_years");
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("enforces accreditation details only when accredited_driver is yes", async () => {
    mockPublishedTemplate();
    const missingCertificate = { ...validInput, answers: { ...validInput.answers, accreditation_type: "" } };
    await expect(createUniversalJobApplication("accredited-bulldozer-driver", missingCertificate, { userId: "user-a", idempotencyKey: "missing-cert" })).rejects.toThrow("MISSING_REQUIRED_FIELD:accreditation_type");

    queryMock.mockReset();
    mockPublishedTemplate();
    queryMock.mockResolvedValueOnce({ rows: [{ ...applicationRow, answers_json: { ...applicationRow.answers_json, accredited_driver: false, accreditation_type: undefined } }] });
    const nonAccredited = { ...validInput, answers: { ...validInput.answers, accredited_driver: false, accreditation_type: undefined } };
    const result = await createUniversalJobApplication("accredited-bulldozer-driver", nonAccredited, { userId: "user-a", idempotencyKey: "review-non-accredited" });
    expect(result.item.status).toBe("pending");
  });

  it("returns the same row on exact idempotent replay and rejects key reuse with changed payload", async () => {
    mockPublishedTemplate();
    let capturedPayloadHash = "";
    queryMock.mockImplementationOnce(async (sql: string, params: unknown[]) => {
      capturedPayloadHash = String(params[26]);
      expect(sql).toContain("ON CONFLICT");
      return { rows: [] };
    });
    queryMock.mockImplementationOnce(async () => ({ rows: [{ ...applicationRow, idempotency_payload_hash: capturedPayloadHash }] }));
    const replay = await createUniversalJobApplication("accredited-bulldozer-driver", validInput, { userId: "user-a", idempotencyKey: "replay-a" });
    expect(replay.idempotent).toBe(true);
    expect(replay.item.id).toBe(applicationRow.id);

    queryMock.mockReset();
    mockPublishedTemplate();
    queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ ...applicationRow, idempotency_payload_hash: "different-hash" }] });
    await expect(createUniversalJobApplication("accredited-bulldozer-driver", validInput, { userId: "user-a", idempotencyKey: "conflict-a" })).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
  });

  it("lists applications only by authenticated owner or secure tracking hash, never phone", async () => {
    queryMock.mockResolvedValueOnce({ rows: [applicationRow] });
    const mine = await listUniversalJobApplicationsForOwner({ userId: "user-a" });
    expect(mine).toHaveLength(1);
    expect(queryMock.mock.calls[0][0]).toContain("s.applicant_user_id=$1");
    expect(queryMock.mock.calls[0][1]).toEqual(["user-a"]);
    expect(queryMock.mock.calls[0][0]).not.toContain("phone=$1");
  });

  it("limits accredited employer managers to their own template while admins manage all", () => {
    const owned = { ...templateRow, owner_user_id: "employer-a" } as any;
    const template = {
      id: owned.id, slug: owned.slug, employerId: owned.employer_id, employerName: owned.employer_name, ownerUserId: owned.owner_user_id,
      jobId: owned.job_id, name: owned.name, titleAr: owned.title_ar, introAr: owned.intro_ar, employmentType: owned.employment_type,
      status: owned.status, allowProfileAutofill: true, allowPreviousAutofill: true, allowBlankStart: true, currentVersion: 1,
      draftFields: [...fields] as any, draftSettings: {}, createdAt: owned.created_at, updatedAt: owned.updated_at,
    };
    expect(canManageUniversalJobTemplate(template, { userId: "employer-a", role: "accredited" })).toBe(true);
    expect(canManageUniversalJobTemplate(template, { userId: "employer-b", role: "accredited" })).toBe(false);
    expect(canManageUniversalJobTemplate(template, { userId: "admin-a", role: "admin" })).toBe(true);
  });
});
