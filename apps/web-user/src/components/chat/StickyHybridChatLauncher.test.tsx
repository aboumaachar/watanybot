// Use happy-dom for DOM coverage in this repo; jsdom is currently not the stable path here.
/** @vitest-environment happy-dom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import StickyHybridChatLauncher, { shouldHideLauncher } from "./StickyHybridChatLauncher";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../store/app", () => ({
  useConfig: () => ({ apiBaseUrl: "" }),
  useApp: () => ({ profile: { isAuthed: false }, dictationEnabled: true }),
}));

vi.mock("../../hooks/useLiveKbSearch", () => ({
  useLiveKbSearch: () => ({
    query: "اختبار",
    visibleLength: 4,
    minChars: 3,
    tags: [],
    documents: [],
    suggestedQuestions: [],
    isSearching: false,
    error: null,
  }),
}));

vi.mock("../../features/chat/contextualChatRuntime", () => ({
  resolveContextualChat: () => ({
    pageContext: "default",
    chatMode: "hybrid",
    useHybrid: true,
    searchScope: ["kb-records"],
    pageKeywords: ["test"],
  }),
}));

vi.mock("./LiveKbResultPanel", () => ({
  LiveKbResultPanel: () => <div data-sticky-test-live-kb-panel="true">Live Panel</div>,
}));

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function RouteMarker() {
  const location = useLocation();
  return <div data-route-marker>{`${location.pathname}${location.search}`}</div>;
}

describe("StickyHybridChatLauncher", () => {
  let container: HTMLDivElement;
  let root: Root;

  async function renderLauncher(initialEntry = "/") {
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[initialEntry]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <StickyHybridChatLauncher />
        </MemoryRouter>,
      );
    });
  }

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container.isConnected) {
      container.remove();
    }
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("dispatches install event from avatar and opens popup when typing", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await renderLauncher();
    await flushEffects();

    const launcherShell = document.querySelector("[data-sticky-hybrid-chat-launcher='true']");
    const input = document.querySelector("[data-sticky-hybrid-chat-launcher='true'] input") as HTMLInputElement | null;
    const avatarButton = document.querySelector("[data-sticky-hybrid-chat-launcher='true'] .sticky-hybrid-chat-launcher__avatar") as HTMLButtonElement | null;
    const utilityRail = document.querySelector("[data-sticky-hybrid-utility-rail='true']");
    const installButton = Array.from(document.querySelectorAll("[data-sticky-hybrid-utility-rail='true'] button")).find((button) => button.textContent?.includes("التثبيت")) as HTMLButtonElement | undefined;
    expect(launcherShell).not.toBeNull();
    expect(input).not.toBeNull();
    expect(avatarButton).not.toBeNull();
    expect(utilityRail).not.toBeNull();
    expect(installButton).toBeTruthy();
    expect(utilityRail?.textContent).toContain("تسجيل الدخول");
    expect(utilityRail?.textContent).toContain("الإشعارات");
    expect(utilityRail?.textContent).toContain("المجتمع");
    expect(utilityRail?.textContent).toContain("التثبيت");
    expect(utilityRail?.textContent).toContain("السوق");

    const installListener = vi.fn();
    globalThis.addEventListener("watany-open-install-prompt", installListener);

    await act(async () => {
      installButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(installListener).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-sticky-hybrid-chat-popup='true']")).toBeNull();
    expect((launcherShell?.querySelector("form") as HTMLFormElement | null)?.dataset.expanded).toBe("false");

    await act(async () => {
      if (input) {
        input.focus();
        const setter = Object.getOwnPropertyDescriptor(globalThis.HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, "س");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    await flushEffects();

    expect(document.querySelector("[data-sticky-hybrid-chat-popup='true']")).not.toBeNull();
    expect((launcherShell?.querySelector("form") as HTMLFormElement | null)?.dataset.expanded).toBe("true");

    globalThis.removeEventListener("watany-open-install-prompt", installListener);
  });

  it("hides the launcher form on the fake-news and news routes while keeping the utility rail", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    expect(shouldHideLauncher("/fake-news")).toBe(true);
    expect(shouldHideLauncher("/news")).toBe(true);

    await renderLauncher("/fake-news");
    await flushEffects();

    expect(document.querySelector("[data-sticky-hybrid-chat-form='true']")).toBeNull();
    expect(document.querySelector("[data-sticky-hybrid-utility-rail='true']")).not.toBeNull();

    await renderLauncher("/news");
    await flushEffects();

    expect(document.querySelector("[data-sticky-hybrid-chat-form='true']")).toBeNull();
    expect(document.querySelector("[data-sticky-hybrid-utility-rail='true']")).not.toBeNull();
  });

  it("opens the dedicated voice route from the homepage mic", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <StickyHybridChatLauncher />
          <RouteMarker />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    const avatarButton = document.querySelector("[data-sticky-hybrid-chat-launcher='true'] .sticky-hybrid-chat-launcher__avatar") as HTMLButtonElement | null;
    expect(avatarButton).not.toBeNull();

    await act(async () => {
      avatarButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(document.querySelector("[data-route-marker]")?.textContent).toBe("/media?voice=1");
  });

  it("falls back to the dedicated voice route when inline speech recognition cannot start", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const speechWindow = globalThis as typeof globalThis & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const previousSpeechRecognition = speechWindow.SpeechRecognition;
    const previousWebkitSpeechRecognition = speechWindow.webkitSpeechRecognition;

    class ThrowingSpeechRecognition {
      lang = "ar-LB";
      interimResults = true;
      continuous = false;
      onstart = null;
      onresult = null;
      onerror = null;
      onend = null;

      start() {
        throw new Error("speech start failed");
      }

      stop() {
        return undefined;
      }

      abort() {
        return undefined;
      }
    }

    speechWindow.SpeechRecognition = ThrowingSpeechRecognition;
    delete speechWindow.webkitSpeechRecognition;

    try {
      await act(async () => {
        root.render(
          <MemoryRouter
            initialEntries={["/"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <StickyHybridChatLauncher />
            <RouteMarker />
          </MemoryRouter>,
        );
      });
      await flushEffects();

      const avatarButton = document.querySelector("[data-sticky-hybrid-chat-launcher='true'] .sticky-hybrid-chat-launcher__avatar") as HTMLButtonElement | null;
      expect(avatarButton).not.toBeNull();

      await act(async () => {
        avatarButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
      });
      await flushEffects();

      expect(document.querySelector("[data-route-marker]")?.textContent).toBe("/media?voice=1");
    } finally {
      if (previousSpeechRecognition === undefined) {
        delete speechWindow.SpeechRecognition;
      } else {
        speechWindow.SpeechRecognition = previousSpeechRecognition;
      }

      if (previousWebkitSpeechRecognition === undefined) {
        delete speechWindow.webkitSpeechRecognition;
      } else {
        speechWindow.webkitSpeechRecognition = previousWebkitSpeechRecognition;
      }
    }
  });
});
