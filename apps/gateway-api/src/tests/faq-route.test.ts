import { describe, expect, it } from "vitest";

import { buildFaqItems } from "../routes/faq";
import type { Procedure } from "../procedures/types";

describe("FAQ route builders", () => {
  it("builds user-facing FAQ entries from substantive procedure content", () => {
    const procedures: Procedure[] = [
      {
        id: "PROC-FAQ-1",
        title_ar: "تجديد بطاقة الخدمات الاجتماعية",
        summary_lb: "(نسخة معدلة بتاريخ ٢٠٢٢/١٠/٩) هذه المعاملة مخصصة لتجديد بطاقة الخدمات الاجتماعية للعسكري المتقاعد وأفراد عائلته وفق  المحددة.",
        requirements: ["إخراج قيد عائلي جديد", "صورة عن بطاقة الهوية"],
        where_to_apply: ["قسم الشؤون في القطعة الإدارية"],
        timelines: ["خلال خمسة أيام عمل"],
        fees: ["من دون رسوم"],
        faq_variants: [
          "شو إجراء تجديد بطاقة الخدمات الاجتماعية",
          "وين بقدّم تجديد بطاقة الخدمات الاجتماعية",
          "شو الوراق لـ تجديد بطاقة الخدمات الاجتماعية",
        ],
        tags: ["خدمات اجتماعية"],
      },
    ];

    const items = buildFaqItems(procedures);

    expect(items.map((item) => item.question)).toEqual([
      "ما هي إجراءات تجديد بطاقة الخدمات الاجتماعية؟",
      "ما هي المستندات المطلوبة لـ تجديد بطاقة الخدمات الاجتماعية؟",
      "أين أقدّم تجديد بطاقة الخدمات الاجتماعية؟",
      "كم تستغرق معاملة تجديد بطاقة الخدمات الاجتماعية؟",
      "ما هي رسوم تجديد بطاقة الخدمات الاجتماعية؟",
    ]);
    expect(items[1]?.answer).toContain("إخراج قيد عائلي جديد");
    expect(items[2]?.answer).toContain("قسم الشؤون");
  });

  it("does not publish raw faq variants when no substantive answer exists", () => {
    const procedures: Procedure[] = [
      {
        id: "PROC-FAQ-2",
        title_ar: "الانتساب إلى رابطة قدماء القوى المسلحة",
        summary_lb: "ملاحظة: لتعبئة الطلب يجب معرفة الرقم العسكري وفئة الدم ورقم الهاتف.",
        faq_variants: ["وين بقدّم الانتساب إلى رابطة قدماء القوى المسلحة"],
        tags: ["رابطة"],
      },
    ];

    expect(buildFaqItems(procedures)).toEqual([]);
  });

  it("cleans duplicated procedure prefixes and filters noisy titles", () => {
    const procedures: Procedure[] = [
      {
        id: "PROC-FAQ-3",
        title_ar: "اجراءات تسليم بطاقة الخدمات للابن فوق 18 ولا يتابع الدراسة.",
        summary_lb: "عند بلوغ الابن سن الثامنة عشرة وعدم متابعته الدراسة يجب تسليم البطاقة إلى قسم الشؤون في القطعة الإدارية.",
        tags: ["خدمات"],
      },
      {
        id: "PROC-FAQ-4",
        title_ar: "٥ GB",
        summary_lb: "يضاف مبلغ إضافي إذا تخطيت الباقة.",
        tags: ["اتصالات"],
      },
      {
        id: "PROC-FAQ-5",
        title_ar: "خدمات خاصة في الجيش10-خدمات خاصة في الجيش2- رابطة قدماء القوى المسلحة1- جهاز الرعاية والشؤونأقسام الكتاباضغط على القسم أدناه",
        summary_lb: "المستندات المطلوبة لهذه المعاملة موضحة في الدليل.",
        requirements: ["نموذج الطلب"],
        tags: ["خدمات"],
      },
      {
        id: "PROC-FAQ-6",
        title_ar: "أرقام هواتف قيادة الجيش",
        summary_lb: "موزع قيادة الجيش 01xxxxxx",
        tags: ["دليل"],
      },
      {
        id: "PROC-FAQ-7",
        title_ar: "أحكام أولية",
        summary_lb: "المادة 1: ...",
        tags: ["قانون"],
      },
    ];

    const items = buildFaqItems(procedures);

    expect(items.map((item) => item.question)).toContain("ما هي إجراءات تسليم بطاقة الخدمات للابن فوق 18 ولا يتابع الدراسة؟");
    expect(items.some((item) => item.procedureId === "PROC-FAQ-4")).toBe(false);
    expect(items.some((item) => item.procedureId === "PROC-FAQ-5")).toBe(false);
    expect(items.some((item) => item.procedureId === "PROC-FAQ-6")).toBe(false);
    expect(items.some((item) => item.procedureId === "PROC-FAQ-7")).toBe(false);
  });
});