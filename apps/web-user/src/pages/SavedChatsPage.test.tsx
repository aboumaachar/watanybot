/** @vitest-environment happy-dom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SavedChatsPage from "./SavedChatsPage";
import type { SavedChatItem } from "../types/domain";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { appState, getSavedChatsMock, updateSavedChatMock } = vi.hoisted(() => ({
  appState: {
    apiBaseUrl: "http://api.test",
    profile: {
      id: "saved-viewer-1",
      isAuthed: true,
    },
  },
  getSavedChatsMock: vi.fn(),
  updateSavedChatMock: vi.fn(),
}));

vi.mock("../store/app", () => ({
  useApp: () => ({
    apiBaseUrl: appState.apiBaseUrl,
    profile: appState.profile,
  }),
}));

vi.mock("../lib/api", () => ({
  api: {
    getSavedChats: getSavedChatsMock,
    updateSavedChat: updateSavedChatMock,
  },
}));

vi.mock("../components/chat/MainHybridChatSurface", () => ({
  MainHybridChatSurface: () => <div data-main-hybrid-chat-surface="true" />,
}));

function ChatRouteMarker() {
  const location = useLocation();
  const state = (location.state as { draft?: string } | null) ?? null;

  return (
    <div data-chat-route="true">
      <div>{location.pathname}</div>
      <div>{state?.draft ?? ""}</div>
    </div>
  );
}

async function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((entry) => entry.textContent?.includes(label));
  expect(button).toBeTruthy();

  await act(async () => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushEffects(6);
}

async function renderPage(root: Root) {
  await act(async () => {
    root.render(
      <MemoryRouter
        initialEntries={["/saved"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/saved" element={<SavedChatsPage />} />
          <Route path="/chat" element={<ChatRouteMarker />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

async function flushEffects(times = 4) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      await Promise.resolve();
    }
  });
}

describe("SavedChatsPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getSavedChatsMock.mockReset();
    updateSavedChatMock.mockReset();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }

    if (container?.isConnected) {
      container.remove();
    }
  });

  it("loads saved chats from the authenticated api contract", async () => {
    const rows: SavedChatItem[] = [
      {
        id: "saved-1",
        text: "متابعة وضع معاملة التقاعد بعد آخر تحديث.",
        ts: Date.parse("2026-06-20T09:30:00.000Z"),
        status: "active",
        updatedAt: Date.parse("2026-06-20T09:31:00.000Z"),
      },
      {
        id: "saved-2",
        text: "هذه المحادثة لا يجب أن تظهر بعد حذفها من العرض.",
        ts: Date.parse("2026-06-19T09:30:00.000Z"),
        status: "deleted_for_me",
        updatedAt: Date.parse("2026-06-19T09:31:00.000Z"),
      },
    ];
    getSavedChatsMock.mockResolvedValue(rows);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await renderPage(root);
    await flushEffects(6);

    expect(getSavedChatsMock).toHaveBeenCalledWith("http://api.test");
    expect(container.textContent).toContain("المحادثات المحفوظة");
    expect(container.textContent).toContain("متابعة وضع معاملة التقاعد بعد آخر تحديث.");
    expect(container.textContent).toContain("محفوظة");
    expect(container.textContent).toContain("الإجمالي");
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("فتح المحادثة");
    expect(container.textContent).toContain("إزالة من المحفوظات");
    expect(container.textContent).not.toContain("هذه المحادثة لا يجب أن تظهر بعد حذفها من العرض.");
  });

  it("opens a saved chat in the hybrid chat route", async () => {
    const rows: SavedChatItem[] = [
      {
        id: "saved-1",
        text: "متابعة وضع معاملة التقاعد.",
        ts: Date.parse("2026-06-20T09:30:00.000Z"),
        status: "active",
        updatedAt: Date.parse("2026-06-20T09:31:00.000Z"),
      },
    ];
    getSavedChatsMock.mockResolvedValue(rows);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await renderPage(root);
    await flushEffects(6);
    await clickButton(container, "فتح المحادثة");

    expect(container.textContent).toContain("/chat");
    expect(container.textContent).toContain("متابعة وضع معاملة التقاعد.");
  });

  it("removes a saved chat from the current user view", async () => {
    const row: SavedChatItem = {
      id: "saved-1",
      text: "متابعة وضع معاملة التقاعد.",
      ts: Date.parse("2026-06-20T09:30:00.000Z"),
      status: "active",
      updatedAt: Date.parse("2026-06-20T09:31:00.000Z"),
    };
    getSavedChatsMock.mockResolvedValue([row]);
    updateSavedChatMock.mockResolvedValue({
      ...row,
      status: "deleted_for_me",
      deletedForMeAt: Date.parse("2026-06-20T09:32:00.000Z"),
      updatedAt: Date.parse("2026-06-20T09:32:00.000Z"),
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await renderPage(root);
    await flushEffects(6);
    await clickButton(container, "إزالة من المحفوظات");

    expect(updateSavedChatMock).toHaveBeenCalledWith("saved-1", { status: "deleted_for_me" }, "http://api.test");
    expect(container.textContent).toContain("لا توجد محادثات محفوظة حالياً.");
    expect(container.textContent).toContain("0");
    expect(container.textContent).not.toContain("متابعة وضع معاملة التقاعد.");
  });

  it("shows an error state when loading saved chats fails", async () => {
    getSavedChatsMock.mockRejectedValue(new Error("تعذر الوصول إلى المحفوظات"));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await renderPage(root);
    await flushEffects(6);

    expect(container.textContent).toContain("تعذر الوصول إلى المحفوظات");
    expect(container.textContent).toContain("لا توجد محادثات محفوظة حالياً.");
  });
});