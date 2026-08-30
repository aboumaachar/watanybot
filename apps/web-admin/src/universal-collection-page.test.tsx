/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import UniversalCollectionPage from "./pages/UniversalCollectionPage";

const { adminFetch } = vi.hoisted(() => ({ adminFetch: vi.fn() }));
vi.mock("./lib/api", () => ({ adminFetch }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node: React.ReactNode): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(node); await Promise.resolve(); });
  return { container, root };
}

function response(items: unknown[]) {
  return { json: async () => ({ items }) };
}

async function settleLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => { document.body.replaceChildren(); adminFetch.mockReset(); });

describe("universal collection owner adapters", () => {
  it("loads official services with stable IDs and owner-specific columns", async () => {
    adminFetch.mockResolvedValue(response([{ id: "service-1", name: "Portal", category: "government", sourceUrl: "https://example.test", lastHealthOk: true }]));
    const view = await mount(<UniversalCollectionPage kind="official-services" />);
    await settleLoad();
    expect(adminFetch).toHaveBeenCalledWith("/api/admin/official-services");
    expect(view.container.textContent).toContain("Portal");
    expect(view.container.textContent).toContain("URL");
    expect(view.container.textContent).not.toContain("Priority");
    act(() => view.root.unmount());
  });

  it("loads ticker rows without leaking official-service columns", async () => {
    adminFetch.mockResolvedValue(response([{ id: "ticker-1", title: "Notice", type: "announce", priority: 80 }]));
    const view = await mount(<UniversalCollectionPage kind="ticker" />);
    await settleLoad();
    expect(adminFetch).toHaveBeenCalledWith("/api/admin/ticker/items");
    expect(view.container.textContent).toContain("Notice");
    expect(view.container.textContent).toContain("Priority");
    expect(view.container.textContent).not.toContain("URL");
    act(() => view.root.unmount());
  });

  it("propagates selected ticker IDs to the exact delete executor", async () => {
    adminFetch.mockResolvedValue(response([{ id: "ticker-1", title: "Notice", type: "announce", priority: 80 }]));
    const view = await mount(<UniversalCollectionPage kind="ticker" />);
    await settleLoad();
    const checkbox = view.container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => checkbox.click());
    const deleteButton = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("Delete selected"));
    expect(deleteButton).toBeDefined();
    await act(async () => { deleteButton?.click(); await Promise.resolve(); });
    expect(adminFetch).toHaveBeenCalledWith("/api/admin/ticker/items/ticker-1", { method: "DELETE" });
    act(() => view.root.unmount());
  });

  it("renders empty and error states", async () => {
    adminFetch.mockResolvedValueOnce(response([]));
    const empty = await mount(<UniversalCollectionPage kind="ticker" />);
    await settleLoad();
    expect(empty.container.textContent).toContain("No records found.");
    act(() => empty.root.unmount());

    adminFetch.mockRejectedValueOnce(new Error("gateway unavailable"));
    const failed = await mount(<UniversalCollectionPage kind="official-services" />);
    await settleLoad();
    expect(failed.container.textContent).toContain("gateway unavailable");
    act(() => failed.root.unmount());
  });
});
