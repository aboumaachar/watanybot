import { describe, expect, it } from "vitest";
import { runHybridKbChat } from "./hybrid-chat.service";

const topics = [
  ["pension eligibility", "ما هي شروط استحقاق معاش التقاعد؟", "شروط الاستحقاق"],
  ["school grants", "ما هي مستندات المساعدات المدرسية؟", "المساعدات المدرسية المتأخرة"],
  ["medical benefits", "كيف استفيد من الطبابة والاستشفاء؟", "تصريح الاستفادة من الطبابة"],
  ["unspecified procedure", "ما هي المستندات اللازمة للمعاملة؟", "أي معاملة تقصد؟"],
] as const;

describe("WB-KB-003: genuine local-index Arabic evidence-gap clarification", () => {
  it.each(topics)("asks a relevant follow-up for %s without inventing a source", async (_, message, expected) => {
    const response = await runHybridKbChat({ message });
    expect(response.mode).toBe("clarification-required");
    expect(response.confidence).toBe(0);
    expect(response.sources).toEqual([]);
    expect(response.answer).toContain("لم أجد نتيجة كافية");
    expect(response.answer).toContain(expected);
    expect(response.answer).not.toContain("أفضل مصدر مبدئي");
  });
});
