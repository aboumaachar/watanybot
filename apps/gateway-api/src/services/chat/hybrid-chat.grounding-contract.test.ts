import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchKbLive } from "../kb/kb-search.service";
import { runHybridKbChat } from "./hybrid-chat.service";

vi.mock("../kb/kb-search.service", () => ({ searchKbLive: vi.fn() }));

const topics = [
  { query: "ما هي شروط معاش التقاعد؟", title: "دليل شروط التقاعد", category: "salary" },
  { query: "كيف أراجع الطبابة العسكرية؟", title: "دليل خدمات الطبابة", category: "procedure" },
  { query: "كيف أقدّم للمساعدة المدرسية؟", title: "دليل المساعدات المدرسية", category: "procedure" },
  { query: "ما المستندات اللازمة للمعاملة؟", title: "دليل المستندات والمعاملات", category: "document" },
] as const;

beforeEach(() => vi.resetAllMocks());

describe("WB-CHAT-002: local source-contract acceptance (fixtures, not factual certification)", () => {
  it.each(topics)("attaches the returned KB record for $query instead of a fabricated reference", async ({ query, title, category }) => {
    vi.mocked(searchKbLive).mockResolvedValue({
      documents: [{
        id: "synthetic-domain-record", title, sourceType: category,
        sourceUrl: "/procedures", excerpt: "مقتطف مصدر اصطناعي", score: 88, tags: ["acceptance-test"],
      }],
      suggestedQuestions: [],
    } as never);

    const response = await runHybridKbChat({ message: query });
    expect(searchKbLive).toHaveBeenCalledOnce();
    expect(response.mode).toBe("retrieval-context-ready");
    expect(response.sources).toHaveLength(1);
    expect(response.sources[0].title).toBe(title);
    expect(response.sources[0].sourceUrl).toBe("/procedures");
    expect(response.answer).toContain(title);
  });

  it("asks for more detail when the KB search returns no records", async () => {
    vi.mocked(searchKbLive).mockResolvedValue({
      documents: [], suggestedQuestions: [],
    } as never);
    const response = await runHybridKbChat({ message: "موضوع غير موجود في الفهرس التجريبي" });
    expect(response.mode).toBe("clarification-required");
    expect(response.confidence).toBe(0);
    expect(response.sources).toEqual([]);
    expect(response.answer).toContain("لم أجد نتيجة كافية");
  });
});
