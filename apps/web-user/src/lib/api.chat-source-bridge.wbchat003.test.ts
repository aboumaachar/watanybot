import { describe, expect, it } from "vitest";
import { sanitizeChatKbHits } from "./api";
import { getChatProvenance } from "../features/hybrid-chat/chatProvenance";

describe("Production-first WB-CHAT-002 adapter source links — isolated local contract", () => {
  it("preserves official sourceUrl metadata through actual chat API mapper", () => {
    const mapped = sanitizeChatKbHits([{
      source: "kb", id: "wbkb-army", title: "دليل الإجراءات", body: "خطوات موثقة",
      sourceUrl: " https://www.lebarmy.gov.lb/ar/node/91654 ", score: 82,
    }]);
    const refs = getChatProvenance({ kb_hits: mapped });
    expect(refs.status).toBe("attached");
    expect(refs.references[0]).toMatchObject({
      title: "دليل الإجراءات", href: "https://www.lebarmy.gov.lb/ar/node/91654", excerpt: "خطوات موثقة",
    });
  });

  it("accepts an existing relative source URL alias without manufacturing a link", () => {
    const mapped = sanitizeChatKbHits([{ source: "kb", id: "school", title: "المساعدات المدرسية", url: "/school-grants" }]);
    expect(getChatProvenance({ kb_hits: mapped }).references[0].href).toBe("/school-grants");
    expect(getChatProvenance({ kb_hits: sanitizeChatKbHits([{ source: "kb", id: "none", title: "مستند" }]) }).references[0].href)
      .toBeUndefined();
  });

  it("still blocks unsafe or credentialed destinations at display", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "http://insecure.invalid", "https://user:pass@example.org"]) {
      const mapped = sanitizeChatKbHits([{ source: "kb", id: "a", title: "مصدر رسمي", sourceUrl: url }]);
      const provenance = getChatProvenance({ kb_hits: mapped });
      expect(provenance.references).toHaveLength(1);
      expect(provenance.references[0].href).toBeUndefined();
    }
  });

  it("keeps raw technical placeholders hidden from the user-facing reference panel", () => {
    const mapped = sanitizeChatKbHits([{ id: "rag_abcd1234", title: "rag_abcd1234", body: "", sourceUrl: "https://example.org/x" }]);
    expect(getChatProvenance({ kb_hits: mapped }).status).toBe("unavailable");
  });
});
