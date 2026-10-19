export type BulkExecutionResult = "ALL_SUCCEEDED" | "PARTIAL_FAILURE" | "ALL_FAILED";

export type BulkActionDescriptor<Payload> = Readonly<{
  id: string;
  label: string;
  requiredPermission: string;
  confirmation?: string;
  executionMode: "perItem" | "batch";
  payload: Payload;
  executeOne?: (id: string, payload: Payload) => Promise<void>;
  executeBatch?: (ids: readonly string[], payload: Payload) => Promise<void>;
  pending: boolean;
  successes: readonly string[];
  failures: readonly { id: string; reason: string }[];
  partialFailure: boolean;
  refresh: () => Promise<void>;
  auditContext: string;
}>;

export type BulkActionOutcome = Readonly<{
  status: BulkExecutionResult;
  successes: readonly string[];
  failures: readonly { id: string; reason: string }[];
}>;

export function validateBulkAction<Payload>(action: BulkActionDescriptor<Payload>): void {
  const hasOne = typeof action.executeOne === "function";
  const hasBatch = typeof action.executeBatch === "function";
  if (action.executionMode === "perItem" ? hasOne === false || hasBatch : hasBatch === false || hasOne) {
    throw new Error("INVALID_BULK_ACTION_EXECUTOR");
  }
}

export async function executeBulkAction<Payload>(action: BulkActionDescriptor<Payload>, selectedIds: readonly string[]): Promise<BulkActionOutcome> {
  validateBulkAction(action);
  const ids = [...new Set(selectedIds)].filter(Boolean);
  if (ids.length === 0) return { status: "ALL_SUCCEEDED", successes: [], failures: [] };
  if (action.executionMode === "batch") {
    try {
      await action.executeBatch!(ids, action.payload);
      await action.refresh();
      return { status: "ALL_SUCCEEDED", successes: ids, failures: [] };
    } catch (reason) {
      return { status: "ALL_FAILED", successes: [], failures: ids.map((id) => ({ id, reason: reason instanceof Error ? reason.message : String(reason) })) };
    }
  }
  const successes: string[] = [];
  const failures: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try { await action.executeOne!(id, action.payload); successes.push(id); }
    catch (reason) { failures.push({ id, reason: reason instanceof Error ? reason.message : String(reason) }); }
  }
  await action.refresh();
  let status: BulkExecutionResult = "PARTIAL_FAILURE";
  if (failures.length === 0) status = "ALL_SUCCEEDED";
  else if (successes.length === 0) status = "ALL_FAILED";
  return { status, successes, failures };
}
