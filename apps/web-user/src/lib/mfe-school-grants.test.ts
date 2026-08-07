import { describe, expect, it } from "vitest";

import {
  buildAidHtmlReport,
  buildAidPrintReport,
  calculateAlshoonAid,
  calculateMfeAid,
  getAidDatasetSummary,
  loadAlshoonAidData,
  loadMfeAidData,
} from "./mfe-school-grants";

describe("mfe school grants mapping", () => {
  it("loads the attached official editor datasets", () => {
    const alshoon = loadAlshoonAidData();
    const mfe = loadMfeAidData();
    const summary = getAidDatasetSummary();

    expect(alshoon.grantLevels.map((entry) => entry.baseAmount)).toEqual([
      350000,
      550000,
      600000,
      700000,
    ]);
    expect(alshoon.multipliers.map((entry) => entry.value)).toEqual([1.5, 1.3, 1.2]);
    expect(mfe.sections).toHaveLength(3);
    expect(mfe.sections[0]?.rates[0]?.amount).toBe(119000000);
    expect(mfe.sections[1]?.rates[6]?.amount).toBe(317000000);
    expect(mfe.sections[2]?.rates[3]?.amount).toBe(395000000);
    expect(summary.decreeNumber).toBe("2026/40");
    expect(summary.title).toBe("تعرفة تعاونية موظفي الدولة");
  });

  it("calculates ALSHOON grants using the official level and multiplier model", () => {
    const result = calculateAlshoonAid([
      {
        name: "سارة",
        levelId: 1,
        multiplierIds: [1],
      },
      {
        name: "علي",
        levelId: 4,
        multiplierIds: [2, 3],
      },
    ]);

    expect(result.system).toBe("alshoon");
    expect(result.students[0]?.finalAmount).toBe(525000);
    expect(result.students[1]?.finalAmount).toBe(1092000);
    expect(result.familyTotal).toBe(result.students[0]!.finalAmount + result.students[1]!.finalAmount);
    expect(result.monthlyAverage).toBe(Math.round(result.familyTotal / 12));
  });

  it("calculates MFE cooperation tariffs directly from the official tariff", () => {
    const result = calculateMfeAid([
      {
        name: "ليان",
        sectionId: "A",
        rateIndex: 0,
      },
      {
        name: "جواد",
        sectionId: "B",
        rateIndex: 5,
      },
    ]);

    expect(result.system).toBe("mfe");
    expect(result.students[0]?.finalAmount).toBe(119000000);
    expect(result.students[1]?.finalAmount).toBe(80000000);
    expect(result.familyTotal).toBe(199000000);
  });

  it("builds a decree-citing export report for the official tariff", () => {
    const summary = getAidDatasetSummary();
    const result = calculateMfeAid([
      {
        name: "ليان",
        sectionId: "A",
        rateIndex: 0,
      },
    ]);

    const report = buildAidPrintReport({
      summary,
      familyName: "عائلة حداد",
      fileNumber: "SG-204",
      result,
    });

    expect(report).toContain("القرار: 2026/40");
    expect(report).toContain("التعرفة الرسمية: 119,000,000 ل.ل.");
    expect(report).toContain("المبلغ النهائي: 119,000,000 ل.ل.");
  });

  it("builds an HTML decree report with comparison columns", () => {
    const summary = getAidDatasetSummary();
    const result = calculateMfeAid([
      {
        name: "ليان",
        sectionId: "A",
        rateIndex: 0,
      },
    ]);

    const report = buildAidHtmlReport({
      summary,
      familyName: "عائلة حداد",
      fileNumber: "SG-204",
      result,
    });

    expect(report).toContain("<!doctype html>");
    expect(report).toContain("قرار رقم: 2026/40");
    expect(report).toContain("تعرفة تعاونية موظفي الدولة");
    expect(report).toContain("المبلغ النهائي");
  });
});