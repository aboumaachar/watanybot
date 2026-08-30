import { describe, expect, it, vi } from "vitest";
import { executeBulkAction, type BulkActionDescriptor } from "./components/BulkActionFramework";

type Payload = { status: string };
const action = (executeOne: (id: string, payload: Payload) => Promise<void>): BulkActionDescriptor<Payload> => ({
  id: "cms.user.status", label: "Set status", requiredPermission: "admin.users", executionMode: "perItem",
  payload: { status: "active" }, executeOne, pending: false, successes: [], failures: [], partialFailure: false,
  refresh: vi.fn(async () => undefined), auditContext: "cms.user",
});

describe("bulk action framework", () => {
  it("deduplicates IDs and aggregates partial failures before refresh", async () => {
    const refresh = vi.fn(async () => undefined);
    const run = vi.fn(async (id: string) => { if (id === "b") throw new Error("guard"); });
    const result = await executeBulkAction({ ...action(run), refresh }, ["a", "b", "a"]);
    expect(run).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ status: "PARTIAL_FAILURE", successes: ["a"], failures: [{ id: "b", reason: "guard" }] });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not execute an empty selection", async () => {
    const run = vi.fn(async () => undefined);
    const result = await executeBulkAction(action(run), []);
    expect(run).not.toHaveBeenCalled();
    expect(result.status).toBe("ALL_SUCCEEDED");
  });

  it("rejects an invalid executor shape", async () => {
    const invalid = { ...action(async () => undefined), executeBatch: async () => undefined };
    await expect(executeBulkAction(invalid, ["a"])).rejects.toThrow("INVALID_BULK_ACTION_EXECUTOR");
  });
});
