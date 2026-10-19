/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import { mainTree } from "../../data/trees/main";
import { WatanyHybridDefaultChat } from "./WatanyHybridDefaultChat";

vi.mock("../../lib/api", () => ({
  api: {
    chatV2Stream: vi.fn(),
    chatGatewayV2: vi.fn(),
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("WB-UX-001: Arabic other-question choice", () => {
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

  async function renderChat() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/chat"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WatanyHybridDefaultChat />
        </MemoryRouter>,
      );
    });
  }

  it("includes the mandated entry in the main guided decision tree", () => {
    const rootNode = mainTree.nodes[mainTree.rootNodeId];
    expect(rootNode?.buttons).toContainEqual(
      expect.objectContaining({ label: "او شي تاني", nextNodeId: "freeform" }),
    );
  });

  it("focuses free-text input without sending an API request when other is selected", async () => {
    await renderChat();
    const button = Array.from(host.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "او شي تاني",
    );
    const input = host.querySelector<HTMLInputElement>('[data-hybrid-default-input="true"]');
    expect(button).toBeTruthy();
    expect(input).toBeTruthy();
    await act(async () => button!.click());
    expect(document.activeElement).toBe(input);
    expect(vi.mocked(api.chatV2Stream)).not.toHaveBeenCalled();
    expect(vi.mocked(api.chatGatewayV2)).not.toHaveBeenCalled();
    expect(host.textContent).toContain("مساعد وطني");
  });

  it("keeps ordinary guided questions connected to the chat request", async () => {
    vi.mocked(api.chatV2Stream).mockResolvedValue({ answer: "رد تجريبي موثّق" } as never);
    await renderChat();
    const button = Array.from(host.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "معاشي وتعويضاتي",
    );
    expect(button).toBeTruthy();
    await act(async () => {
      button!.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(vi.mocked(api.chatV2Stream)).toHaveBeenCalledWith("معاشي وتعويضاتي");
    expect(host.textContent).toContain("رد تجريبي موثّق");
  });
});
