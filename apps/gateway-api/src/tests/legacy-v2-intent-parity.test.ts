import { describe, expect, it } from "vitest";
import { resolveLegacyV2Intent, resolveLegacyV2IntentDataDir } from "../lib/legacy-v2-intent.js";

type Case = {
  name: string;
  text: string;
  context?: { slots_filled?: Record<string, unknown> };
  expected: Record<string, unknown>;
};

const cases: Case[] = [
  {
    name: "pension docs",
    text: "شو لازم ورق للمعاش؟",
    expected: {
      intent: "pension_eligibility", domain: "pension", request_type: "docs", urgency: "normal",
      slots_missing: ["service_branch", "service_years"], confidence: 0.3,
      next_question_lb: "حضرتك متقاعد من أي جهاز؟",
    },
  },
  {
    name: "salary",
    text: "بدي اعرف قديش معاشي",
    expected: {
      intent: "salary_compute", domain: "salary", request_type: "salary", urgency: "normal",
      slots_missing: ["rank", "degree", "category"], confidence: 0.5,
      next_question_lb: "شو رتبتك؟",
      normalized_text: "بدي اعرف كم المعاش",
    },
  },
  {
    name: "medical where",
    text: "وين بقدّم طلب طبابة؟",
    expected: {
      intent: "renew_social_card", domain: "medical", request_type: "where", urgency: "normal",
      slots_missing: ["service_branch", "beneficiary"], confidence: 0.3,
      next_question_lb: "الملف تابع للجيش أو قوى الأمن؟",
    },
  },
  {
    name: "survivor",
    text: "ابن عمي توفه وعندو اولاد وبنات",
    expected: {
      intent: "survivor_pension", domain: "survivors", request_type: "info", urgency: "normal",
      slots_filled: { beneficiary: "أبناء" }, slots_missing: ["heirs"], confidence: 0.95,
      next_question_lb: "مين الورثة الموجودين؟",
    },
  },
  {
    name: "phonebook",
    text: "شو رقم تلفون دائرة التقاعد؟",
    expected: {
      intent: "directory_links", domain: "mof", request_type: "phonebook", urgency: "normal",
      slots_missing: ["need"], confidence: 0.5, next_question_lb: "وين بدك تراجع؟",
    },
  },
  {
    name: "urgent complaint",
    text: "ضروري بدي اعترض على قرار رفض المعاش",
    expected: {
      intent: "complaint_appeal", domain: "pension", request_type: "problem", urgency: "high",
      slots_missing: ["topic", "decision_date"], confidence: 0.3,
      next_question_lb: "شو المشكلة؟ (رفض/تأخير/غلط بالقيمة)",
    },
  },
  {
    name: "school aid",
    text: "بدي مساعدة مدرسية لولادي",
    expected: {
      intent: "aid_request", domain: "school", request_type: "info", urgency: "normal",
      slots_filled: { beneficiary: "أبناء", aid_type: "مدرسية" }, slots_missing: [], confidence: 0.55,
      next_question_lb: "",
    },
  },
  {
    name: "bank payment",
    text: "ليش تأخر المعاش وما نزل عالبنك",
    expected: {
      intent: "pension_eligibility", domain: "payments", request_type: "payment_time", urgency: "normal",
      slots_missing: ["service_branch", "service_years"], confidence: 1,
      normalized_text: "لماذا تأخر المعاش ولم يتم الصرف/التحويل إلى المصرف",
    },
  },
  {
    name: "laf general",
    text: "أنا من الجيش وبدي اعرف شو صار بالملف",
    expected: {
      intent: "other", domain: "laf", request_type: "status", urgency: "normal",
      slots_filled: { service_branch: "الجيش اللبناني", beneficiary: "أنا" },
      slots_missing: [], confidence: 0.45,
    },
  },
  {
    name: "salary context",
    text: "قديش معاشي",
    context: { slots_filled: { rank: "عقيد", degree: "5", category: "ضابط" } },
    expected: {
      intent: "salary_compute", domain: "salary", request_type: "salary", urgency: "normal",
      slots_filled: { rank: "عقيد", degree: "5", category: "ضابط" }, slots_missing: [], confidence: 0.65,
    },
  },
  {
    name: "medical context",
    text: "طبابة",
    context: { slots_filled: { service_branch: "الجيش اللبناني", beneficiary: "أنا" } },
    expected: {
      intent: "renew_social_card", domain: "medical", request_type: "info", urgency: "normal",
      slots_filled: { service_branch: "الجيش اللبناني", beneficiary: "أنا" },
      slots_missing: [], confidence: 0.35,
    },
  },
  {
    name: "plain other",
    text: "مرحبا كيفك",
    expected: {
      intent: "other", domain: "general", request_type: "info", urgency: "normal",
      slots_filled: {}, slots_missing: [], confidence: 0,
    },
  },
];

describe("legacy v2 intent Python parity", () => {
  it("resolves the current canonical KB-v2 intent data directory", () => {
    expect(resolveLegacyV2IntentDataDir()).not.toBeNull();
  });

  it.each(cases)("matches the Python authority: $name", ({ text, context, expected }) => {
    const result = resolveLegacyV2Intent(text, context);
    expect(result).toMatchObject(expected);
    expect(result.menu).toHaveLength(8);
  });
});
