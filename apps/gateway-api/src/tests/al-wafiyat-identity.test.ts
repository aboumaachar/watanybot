import { describe, expect, it } from "vitest";
import {
  buildOfficialDeathNoticeIdentity,
  classifyOfficialDeathNotice,
  extractExplicitEventDate,
  normalizeArabicIdentity,
  normalizeOfficialDate,
  reconcileOfficialDeathNotice,
} from "../routes/al-wafiyat-identity";

const example = {
  source: "isf_official",
  noticeDate: "١٢/١٠/٢٠٢٦",
  title: "إستشهاد المؤهل إدغار جلو",
  originalUrl: "https://isf.gov.lb/ar/deaths/",
  rawText: "بتاريخ 2026/10/12 استشهد المؤهل إدغار جلو. يقام المأتم بتاريخ 2026/10/13",
};

describe("al-wafiyat identity and evidence-only dates", () => {
  it("normalizes Arabic spellings and digits without changing identity", () => {
    expect(normalizeArabicIdentity("إستشهاد المؤهل إدغار جلو")).toBe(
      normalizeArabicIdentity("استشهاد المؤهل ادغار جلو"),
    );
    expect(normalizeOfficialDate("١٢/١٠/٢٠٢٦")).toBe("2026-10-12");
    expect(normalizeOfficialDate("2026/10/12")).toBe("2026-10-12");
    expect(normalizeOfficialDate("2026-02-30")).toBeNull();
    expect(normalizeOfficialDate("2026-13-10")).toBeNull();
    expect(normalizeOfficialDate("tomorrow")).toBeNull();
  });

  it("uses stable identity regardless of crawl position or title diacritics", () => {
    const first = buildOfficialDeathNoticeIdentity(example);
    const alternate = buildOfficialDeathNoticeIdentity({
      ...example,
      noticeDate: "2026-10-12",
      title: "استشهاد المؤهل ادغار جلو",
    });
    expect(first).not.toBeNull();
    expect(first?.stableId).toBe(alternate?.stableId);
    expect(first?.identityKey).toBe(alternate?.identityKey);
  });

  it("only trusts official distinct detail URLs and rejects unrelated hosts", () => {
    const good = buildOfficialDeathNoticeIdentity({
      ...example, source: "gsf_official", originalUrl: "https://www.general-security.gov.lb/ar/deaths/details/1195/551",
    });
    const spoof = buildOfficialDeathNoticeIdentity({
      ...example, source: "gsf_official", originalUrl: "https://general-security.gov.lb.evil.test/ar/deaths/details/1195/551",
    });
    expect(good?.detailUrl).toBe("https://www.general-security.gov.lb/ar/deaths/details/1195/551");
    expect(spoof?.detailUrl).toBeNull();
    expect(good?.identityKey).not.toBe(spoof?.identityKey);
  });

  it("does not hallucinate death date from notice date or an undated text", () => {
    const record = buildOfficialDeathNoticeIdentity({
      ...example, rawText: "وفاة والد الرقيب. يقام المأتم غداً.",
    });
    expect(record?.notice_date).toBe("2026-10-12");
    expect(record?.death_date).toBeNull();
    expect(record?.funeral_date).toBeNull();
    expect(record?.date_evidence.death).toBe("unknown");
  });

  it("extracts only explicitly labeled event dates", () => {
    const candidate = buildOfficialDeathNoticeIdentity(example);
    expect(candidate?.death_date).toBe("2026-10-12");
    expect(candidate?.funeral_date).toBe("2026-10-13");
    expect(extractExplicitEventDate("بتاريخ 18/10/2026 توفيت السيدة", "death")).toBe("2026-10-18");
    expect(extractExplicitEventDate("يقام المأتم بتاريخ 20/10/2026", "funeral")).toBe("2026-10-20");
  });

  it("distinguishes follow-up and memorial notices from new deaths", () => {
    expect(classifyOfficialDeathNotice("الحاقا لوفاة والدة العميد")).toBe("FOLLOW_UP");
    expect(classifyOfficialDeathNotice("إضافة يوم على التعازي بالسيد")).toBe("FOLLOW_UP");
    expect(classifyOfficialDeathNotice("إحياء الذكرى السنوية الأولى على استشهاد المؤهل")).toBe("MEMORIAL");
    expect(classifyOfficialDeathNotice("وفاة والد المعاون")).toBe("DEATH_NOTICE");
  });

  it("retains legacy identity even when the old crawl ID changed", () => {
    const candidate = buildOfficialDeathNoticeIdentity(example)!;
    const existing = [{ id: "al-wafiyat-isf-2026-10-12-استشهاد-المؤهل-3", name: "استشهاد المؤهل ادغار جلو", date_of_death: "2026-10-12", source: "isf_official", import_mode: "official_source_crawl" }];
    expect(reconcileOfficialDeathNotice(candidate, existing, "isf_official")).toEqual({
      disposition: "DUPLICATE", existingId: existing[0].id, reason: "EXISTING_NOTICE_IDENTITY",
    });
  });

  it("quarantines an ambiguous historical duplicate instead of creating another record", () => {
    const candidate = buildOfficialDeathNoticeIdentity(example)!;
    const existing = [
      { id: "al-wafiyat-isf-a", title: "استشهاد المؤهل ادغار جلو", source: "isf_official", date_of_death: "2026-10-12" },
      { id: "al-wafiyat-isf-b", title: "إستشهاد المؤهل إدغار جلو", source: "isf_official", date_of_death: "2026-10-12" },
    ];
    expect(reconcileOfficialDeathNotice(candidate, existing, "isf_official").disposition).toBe("REVIEW_REQUIRED");
  });

  it("does not merge notices from different official authorities", () => {
    const candidate = buildOfficialDeathNoticeIdentity(example)!;
    const existing = [{ id: "al-wafiyat-army-existing", name: example.title, source: "army_official", date_of_death: "2026-10-12" }];
    expect(reconcileOfficialDeathNotice(candidate, existing, "isf_official").disposition).toBe("NEW");
  });

  it("quarantines same-date names assigned different official detail URLs", () => {
    const original = "https://www.general-security.gov.lb/ar/deaths/details/1195/551";
    const conflicting = "https://www.general-security.gov.lb/ar/deaths/details/1196/551";
    const candidate = buildOfficialDeathNoticeIdentity({
      ...example, source: "gsf_official", originalUrl: original,
    })!;
    const existing = [{
      id: "al-wafiyat-gsf-old", source: "gsf_official", title: example.title,
      originalUrl: conflicting, date_of_death: "2026-10-12", import_mode: "official_source_crawl",
    }];
    expect(reconcileOfficialDeathNotice(candidate, existing, "gsf_official")).toMatchObject({
      disposition: "REVIEW_REQUIRED", reason: "CONFLICTING_OFFICIAL_DETAIL_URL",
    });
  });

  it("quarantines content drift on an otherwise unchanged official detail URL", () => {
    const detailUrl = "https://www.general-security.gov.lb/ar/deaths/details/1195/551";
    const candidate = buildOfficialDeathNoticeIdentity({
      ...example, source: "gsf_official", originalUrl: detailUrl,
    })!;
    const existing = [{
      id: "al-wafiyat-gsf-old", source: "gsf_official", title: "وفاة أخرى مختلفة",
      originalUrl: detailUrl, date_of_death: "2026-10-12", import_mode: "official_source_crawl",
    }];
    expect(reconcileOfficialDeathNotice(candidate, existing, "gsf_official")).toMatchObject({
      disposition: "REVIEW_REQUIRED", reason: "OFFICIAL_DETAIL_CONTENT_DRIFT",
    });
  });

  it("keeps invalid source and dates out of the new model", () => {
    expect(buildOfficialDeathNoticeIdentity({ ...example, source: "attacker" })).toBeNull();
    expect(buildOfficialDeathNoticeIdentity({ ...example, noticeDate: "2026-02-31" })).toBeNull();
  });
});
