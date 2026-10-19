import { describe, expect, it } from "vitest";
import { DALEEL_APRIL_2026_TOPICS, findAcceptedGreenDaleelTopic, getDaleelTopic, searchDaleelTopics } from "./daleelApril2026Topics";

describe("April 2026 Daleel topic URL repair", () => {
  it("has the complete 84-topic, unique guide-number index", () => {
    expect(DALEEL_APRIL_2026_TOPICS).toHaveLength(84);
    expect(new Set(DALEEL_APRIL_2026_TOPICS.map((topic) => topic.guideNo)).size).toBe(84);
    expect(DALEEL_APRIL_2026_TOPICS.every((topic) => topic.pdfPage >= 1 && topic.pdfPage <= 96 && Boolean(topic.title))).toBe(true);
  });

  it("does not replace the 9 accepted green catalogue topics", () => {
    const accepted = DALEEL_APRIL_2026_TOPICS.filter((topic) => topic.acceptedGreen);
    expect(accepted).toHaveLength(9);
    for (const topic of accepted) {
      expect(searchDaleelTopics(topic.title).some((entry) => entry.guideNo === topic.guideNo)).toBe(false);
      expect(getDaleelTopic(topic.guideNo)?.title).toBe(topic.title);
    }
  });

  it("resolves all 75 previously yellow/red topic titles without a no-result fallback", () => {
    const needingRepair = DALEEL_APRIL_2026_TOPICS.filter((topic) => !topic.acceptedGreen);
    expect(needingRepair).toHaveLength(75);
    for (const topic of needingRepair) {
      expect(searchDaleelTopics(topic.title).some((item) => item.guideNo === topic.guideNo),
        `Missing topic #${topic.guideNo}: ${topic.title}`).toBe(true);
      expect(getDaleelTopic(topic.guideNo)).toBe(topic);
    }
  });

  it("preserves the exact nine accepted green checklist search URLs", () => {
    const originalGreenQueries = [
      "اجراءات الانتساب الى رابطة قدماء القوى المسلحة",
      "شروط الحصول على خط هاتف عسكري من Alfa وmtc",
      "اجراءات تنظيم بطاقة للابن المعوق",
      "التعويض العائلي للابن فوق ١٨ ويتابع الدراسة",
      "قواعد منح البطاقة الصحية لرجال قوى الأمن الداخلي",
      "طلبات المساعدات المرضية لمتقاعدي الأمن الداخلي",
      "المساعدات المرضية لمتقاعدي الأمن الداخلي",
      "اجراءات تفعيل الايصال الزهري عند تجديد بطاقات الخدمات في الجيش",
      "تجديد رخصة مسدس اميري",
    ];
    const expectedGuideNumbers = [38, 40, 13, 2, 36, 23, 57, 43, 33];
    for (const [index, query] of originalGreenQueries.entries()) {
      expect(searchDaleelTopics(query)).toEqual([]);
      expect(findAcceptedGreenDaleelTopic(query)?.guideNo).toBe(expectedGuideNumbers[index]);
    }
    expect(findAcceptedGreenDaleelTopic("مدينة طرابلس")).toBeNull();
  });

  it("handles Arabic spelling variations from original checklist search URLs", () => {
    expect(searchDaleelTopics("تجديد بطاقات الخدمات االجتماعية لدى الجيش").some((t) => t.guideNo === 1)).toBe(true);
    expect(searchDaleelTopics("نظام التقاعد والصرف من الخدمة (الفصل الرابع :حقوق أفراد العائلة.)").some((t) => t.guideNo === 64)).toBe(true);
    expect(searchDaleelTopics("إجراءات نقل المعامالت اإلدارية الى قطعة أخرى").some((t) => t.guideNo === 25)).toBe(true);
    expect(searchDaleelTopics("دليل تصديق الإفادات المدرسية والجامعية").some((t) => t.guideNo === 54)).toBe(true);
  });

  it("does not present unrelated generic queries as a matched guide topic", () => {
    expect(searchDaleelTopics("")).toEqual([]);
    expect(searchDaleelTopics("xy")).toEqual([]);
    expect(searchDaleelTopics("مدينة طرابلس")).toEqual([]);
  });
});
