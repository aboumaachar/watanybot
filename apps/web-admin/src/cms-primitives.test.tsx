/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsImportWizard, type CmsImportMutationResult, type CmsImportValidationResult } from "./components/cms/CmsPrimitives";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node: React.ReactNode): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(node); await Promise.resolve(); });
  return { container, root };
}

const validationResult: CmsImportValidationResult = {
  planId: "plan-test",
  summary: { valid_count: 2, warning_count: 1, invalid_count: 0, new_count: 1, update_count: 1, conflict_count: 0 },
};
const mutationResult: CmsImportMutationResult = {
  state: "APPLIED",
  summary: { ...validationResult.summary, requested_count: 2, validated_count: 2, success_count: 2, failed_count: 0, skipped_count: 0, errors: [] },
};

afterEach(() => document.body.replaceChildren());

describe("shared CMS import wizard", () => {
  it("requires validation preview before apply and renders result counts", async () => {
    const validate = vi.fn(async () => validationResult);
    const apply = vi.fn(async () => mutationResult);
    const view = await mount(<CmsImportWizard open title="استيراد الإجراءات" onClose={vi.fn()} onValidate={validate} onApply={apply} />);
    const file = new File(["{}"], "procedures.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => JSON.stringify({ schemaVersion: "ud3-procedure-v1", records: [] }) });
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await Promise.resolve(); await Promise.resolve(); });
    expect(apply).not.toHaveBeenCalled();
    const validateButton = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("تحقق ومعاينة"));
    expect(validateButton).toBeDefined();
    await act(async () => { validateButton?.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(validate).toHaveBeenCalledOnce();
    expect(apply).not.toHaveBeenCalled();
    const applyButton = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("تطبيق كمسودة"));
    expect(applyButton).toBeDefined();
    await act(async () => { applyButton?.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(apply).toHaveBeenCalledWith("plan-test");
    expect(view.container.textContent).toContain("ناجح");
    expect(view.container.textContent).toContain("2");
    act(() => view.root.unmount());
  });
});
