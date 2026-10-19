/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import { WatanyHybridDefaultChat } from "./WatanyHybridDefaultChat";

vi.mock("../../lib/api", () => ({
  api: { chatV2Stream: vi.fn(), chatGatewayV2: vi.fn() },
}));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("WB-CHAT-002: grounded-source presentation on a rendered chat", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });
  async function submitPensionChoice() {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={["/chat"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <WatanyHybridDefaultChat />
      </MemoryRouter>);
    });
    const choice = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === "معاشي وتعويضاتي");
    expect(choice).toBeTruthy();
    await act(async () => {
      choice!.click();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("shows only returned source titles/excerpts and inspectable links with an explicit verification limitation", async () => {
    vi.mocked(api.chatV2Stream).mockResolvedValue({
      answer_lb: "إجابة تجريبية عن التقاعد",
      kb_hits: [{ id: "p-01", title: "شرح أحكام التقاعد", body: "مقطع تجريبي", sourceUrl: "https://example.org/pension" }],
    } as never);
    await submitPensionChoice();
    const section = host.querySelector('[data-chat-source-status="attached"]');
    expect(section).not.toBeNull();
    expect(section!.textContent).toContain("شرح أحكام التقاعد");
    expect(section!.textContent).toContain("ليست تحققاً مستقلاً");
    const link = section!.querySelector<HTMLAnchorElement>("a");
    expect(link?.getAttribute("href")).toBe("https://example.org/pension");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(host.textContent).toContain("إجابة تجريبية عن التقاعد");
  });

  it("warns when the answer has no source metadata instead of fabricating citations", async () => {
    vi.mocked(api.chatV2Stream).mockResolvedValue({ answer: "جواب بلا مراجع" } as never);
    await submitPensionChoice();
    const section = host.querySelector('[data-chat-source-status="unavailable"]');
    expect(section).not.toBeNull();
    expect(section!.textContent).toContain("لم تُرفق مراجع");
    expect(section!.querySelector("a")).toBeNull();
  });

  it("renders a reviewed-source expiry warning without claiming current legal approval", async () => {
    const src = { id: "wbkb-army-retirement-paper-copy", title: "نسخة التسريح", sourceUrl: "https://www.lebarmy.gov.lb/ar/node/91654" };
    vi.mocked(api.chatV2Stream).mockResolvedValue({
      answer: "المعلومة إجرائية فقط",
      sources: [src],
      sourceReviews: [{ sourceId: src.id, sourceUrl: src.sourceUrl, reviewState: "expired", snapshotState: "not_checked" }],
    } as never);
    await submitPensionChoice();
    const warnings = host.querySelector('[data-chat-review-warnings="true"]');
    expect(warnings).not.toBeNull();
    expect(warnings!.textContent).toContain("انتهت مراجعة المصدر");
    expect(warnings?.getAttribute("role")).toBe("alert");
    expect(host.textContent).toContain("ليست تحققاً مستقلاً");
  });

  it("keeps the request usable through gateway fallback while flagging missing references", async () => {
    vi.mocked(api.chatV2Stream).mockRejectedValue(new Error("Synthetic Python unavailable"));
    vi.mocked(api.chatGatewayV2).mockResolvedValue({ answer: "نتيجة بديلة" } as never);
    await submitPensionChoice();
    expect(vi.mocked(api.chatGatewayV2)).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("نتيجة بديلة");
    expect(host.querySelector('[data-chat-source-status="unavailable"]')).not.toBeNull();
  });
});
