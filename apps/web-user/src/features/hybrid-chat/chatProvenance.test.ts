import { describe, expect, it } from "vitest";
import { getChatProvenance } from "./chatProvenance";

const subjects = [
  { query: "معاش التقاعد", title: "دليل معاش التقاعد", url: "/salary" },
  { query: "الطبابة والاستشفاء", title: "دليل الخدمات الطبية", url: "/services/official" },
  { query: "المساعدات المدرسية", title: "المساعدات المدرسية", url: "/school-grants" },
  { query: "معاملة رسمية", title: "خطوات المعاملة", url: "/procedures" },
] as const;

describe("WB-CHAT-002 citation provenance, with synthetic responses only", () => {
  it.each(subjects)("shows a returned reference for $query without creating sources", ({ title, url }) => {
    const result = getChatProvenance({ sources: [{ id: title, title, sourceUrl: url, excerpt: "مقتطف تجريبي" }] });
    expect(result.status).toBe("attached");
    expect(result.references).toEqual([{ id: title, title, href: url, excerpt: "مقتطف تجريبي" }]);
  });

  it("uses kb_hits when a response also contains an empty sources array", () => {
    const result = getChatProvenance({ sources: [], kb_hits: [{ id: "kb2", title: "المرجع الفعلي" }] });
    expect(result.references).toEqual([{ id: "kb2", title: "المرجع الفعلي" }]);
  });

  it("does not present generic technical placeholders as inspectable references", () => {
    const result = getChatProvenance({ kb_hits: [{ id: "rag_99", title: "مرجع من قاعدة المعرفة" }] });
    expect(result.status).toBe("unavailable");
  });

  it("accepts gateway kb_hits as the same source type", () => {
    const result = getChatProvenance({ kb_hits: [{ id: "kb01", title: "الأنظمة والقوانين", body: "مقتطف مستعاد" }] });
    expect(result.references).toEqual([{ id: "kb01", title: "الأنظمة والقوانين", excerpt: "مقتطف مستعاد" }]);
  });

  it("does not create a citation for empty, malformed, or generic source metadata", () => {
    expect(getChatProvenance({ answer: "النص بلا دليل" }).status).toBe("unavailable");
    expect(getChatProvenance({ sources: [{ title: "rag_123abcde" }, null, "untrusted"] }).references).toHaveLength(0);
    expect(getChatProvenance(null).status).toBe("unavailable");
  });

  it.each(["javascript:alert(1)", "data:text/html,test", "//example.invalid/path", "http://insecure.example.org", "/\\external"])("refuses unsafe source URL %s", (url) => {
    const result = getChatProvenance({ sources: [{ id: "x", title: "مصدر معلوم العنوان", sourceUrl: url }] });
    expect(result.references).toHaveLength(1);
    expect(result.references[0].href).toBeUndefined();
  });

  it("permits a safe HTTPS URL but rejects embedded credentials", () => {
    expect(getChatProvenance({ sources: [{ title: "وزارة", sourceUrl: "https://example.org/reference" }] }).references[0].href)
      .toBe("https://example.org/reference");
    expect(getChatProvenance({ sources: [{ title: "وزارة", sourceUrl: "https://user:pass@example.org/" }] }).references[0].href)
      .toBeUndefined();
  });

  it("limits repeated or excessive references without altering the answer", () => {
    const sources = [{ id: "repeat", title: "الأول", sourceUrl: "/salary" }, { id: "repeat", title: "الأول", sourceUrl: "/salary" },
      ...Array.from({ length: 10 }, (_, i) => ({ id: String(i), title: "مرجع " + i }))];
    const refs = getChatProvenance({ sources }).references;
    expect(refs).toHaveLength(3);
    expect(refs[0].title).toBe("الأول");
    expect(new Set(refs.map((s) => s.title)).size).toBe(3);
  });
});
