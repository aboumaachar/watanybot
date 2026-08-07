import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../server";

describe("MOF pension attestation proxy", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns structured external-only details for the MOF attestation route", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/pension/attestation",
      payload: { fullName: "احمد", fatherName: "محمود", surname: "حسن", pensionNumber: "123456" },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.source).toBe("mof");
    expect(body.sourceUrl).toContain("RetiredInfo.aspx");
    expect(body.reason).toBe("external_only");
    expect(body.error).toContain("وزارة المالية الرسمية");
  });

  it("does not call the MOF upstream while external-only mode is enforced", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.inject({
      method: "POST",
      url: "/api/pension/attestation",
      payload: {
        fullName: "احمد",
        fatherName: "محمود",
        surname: "حسن",
        pensionNumber: "123456",
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("external_only");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});