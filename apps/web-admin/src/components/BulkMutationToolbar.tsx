import { useState } from "react";
import { CapabilityAction, type CapabilityState } from "./CapabilityAction";

export type BulkMutation = "bulk_archive" | "bulk_delete" | "bulk_edit";

type BulkMutationToolbarProps = Readonly<{
  selectedIds: readonly string[];
  capabilities: Readonly<Record<BulkMutation, CapabilityState>>;
  dispatch: (mutation: BulkMutation, selectedIds: readonly string[]) => Promise<void>;
  editLabel?: string;
}>;

const destructiveMutations = new Set<BulkMutation>(["bulk_archive", "bulk_delete"]);

export function BulkMutationToolbar({ selectedIds, capabilities, dispatch, editLabel = "Edit selected" }: BulkMutationToolbarProps) {
  const [activeMutation, setActiveMutation] = useState<BulkMutation | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runMutation(mutation: BulkMutation) {
    if (selectedIds.length === 0 || activeMutation) return;
    if (destructiveMutations.has(mutation) && !globalThis.confirm(`Apply ${mutation.replace("bulk_", "")} to ${selectedIds.length} records?`)) return;
    setError(null);
    setActiveMutation(mutation);
    try {
      await dispatch(mutation, selectedIds);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bulk action failed.");
    } finally {
      setActiveMutation(null);
    }
  }

  return (
    <div className="bulk-mutation-toolbar" aria-live="polite">
      <span>{selectedIds.length} selected</span>
      {capabilities.bulk_archive === "SUPPORTED" ? <CapabilityAction capability={capabilities.bulk_archive} onClick={() => void runMutation("bulk_archive")}>
        {activeMutation === "bulk_archive" ? "Archiving..." : "Archive"}
      </CapabilityAction> : null}
      {capabilities.bulk_delete === "SUPPORTED" ? <CapabilityAction capability={capabilities.bulk_delete} onClick={() => void runMutation("bulk_delete")}>
        {activeMutation === "bulk_delete" ? "Deleting..." : "Delete"}
      </CapabilityAction> : null}
      {capabilities.bulk_edit === "SUPPORTED" ? <CapabilityAction capability={capabilities.bulk_edit} onClick={() => void runMutation("bulk_edit")}>
        {activeMutation === "bulk_edit" ? "Editing..." : editLabel}
      </CapabilityAction> : null}
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}