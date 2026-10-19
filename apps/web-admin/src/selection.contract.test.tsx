/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkMutationToolbar } from "./components/BulkMutationToolbar";
import { SelectableDataGrid } from "./components/SelectableDataGrid";
import { useRowSelection } from "./hooks/useRowSelection";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function SelectionProbe({ rowIds, onChange }: { rowIds: string[]; onChange: (ids: readonly string[]) => void }) {
  const selection = useRowSelection(rowIds);
  onChange(selection.selectedVisibleIds);
  return <><button data-testid="one" onClick={() => selection.toggle(rowIds[0])}>one</button><button data-testid="all" onClick={selection.toggleAll}>all</button><button data-testid="clear" onClick={selection.clear}>clear</button></>;
}

function mount(node: React.ReactNode): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, root };
}

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe("universal row selection contract", () => {
  it("selects, deselects, selects visible rows, clears, deduplicates, and reconciles stale IDs", () => {
    let ids: readonly string[] = [];
    const view = mount(<SelectionProbe rowIds={["a", "a", "b"]} onChange={(next) => { ids = next; }} />);
    act(() => (view.container.querySelector("[data-testid=one]") as HTMLButtonElement).click());
    expect(ids).toEqual(["a"]);
    act(() => (view.container.querySelector("[data-testid=one]") as HTMLButtonElement).click());
    expect(ids).toEqual([]);
    act(() => (view.container.querySelector("[data-testid=all]") as HTMLButtonElement).click());
    expect(ids).toEqual(["a", "b"]);
    act(() => view.root.render(<SelectionProbe rowIds={["b"]} onChange={(next) => { ids = next; }} />));
    expect(ids).toEqual(["b"]);
    act(() => (view.container.querySelector("[data-testid=clear]") as HTMLButtonElement).click());
    expect(ids).toEqual([]);
    act(() => view.root.unmount());
  });

  it("passes exact selected IDs to the toolbar and does not expose unsupported actions", () => {
    const dispatch = vi.fn(async () => undefined);
    const view = mount(<BulkMutationToolbar selectedIds={["community-1", "community-2"]} capabilities={{ bulk_archive: "NOT_APPLICABLE", bulk_delete: "MISSING", bulk_edit: "SUPPORTED" }} dispatch={dispatch} />);
    expect(view.container.textContent).toContain("2 selected");
    expect(view.container.textContent).toContain("Edit selected");
    expect(view.container.textContent).not.toContain("Archive");
    expect(view.container.textContent).not.toContain("Delete");
    act(() => (view.container.querySelector("button") as HTMLButtonElement).click());
    expect(dispatch).toHaveBeenCalledWith("bulk_edit", ["community-1", "community-2"]);
    act(() => view.root.unmount());
  });

  it("renders stable Community IDs through the shared grid", () => {
    const toggled: string[] = [];
    const view = mount(<SelectableDataGrid rowIds={["community-1", "community-2"]} selectedIds={[]} allVisibleSelected={false} onToggle={(id) => toggled.push(id)} onToggleAll={vi.fn()} columnLabels={["المعرف", "الاسم"]} renderRow={(id) => <><td>{id}</td><td>{id === "community-1" ? "General" : "Residents"}</td></>} />);
    expect(view.container.textContent).toContain("community-1");
    act(() => (view.container.querySelector("input[aria-label='اختيار community-1']") as HTMLInputElement).click());
    expect(toggled).toEqual(["community-1"]);
    act(() => view.root.unmount());
  });
});