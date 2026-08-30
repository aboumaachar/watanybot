import { useEffect, useMemo, type ReactNode } from "react";
import { SelectableDataGrid } from "./SelectableDataGrid";
import { useRowSelection } from "../hooks/useRowSelection";

export type ManageableListAdapter<Row> = Readonly<{
  featureId: string;
  domain: string;
  title: string;
  loadRows: () => Promise<readonly Row[]>;
  getRowId: (row: Row) => string;
  columns: readonly string[];
  renderRow: (row: Row) => ReactNode;
  selectionEnabled?: boolean;
  onSelectionChange?: (selectedIds: readonly string[]) => void;
}>;

type ManageableListProps<Row> = Readonly<{ adapter: ManageableListAdapter<Row>; rows: readonly Row[]; onSelectionChange?: (selectedIds: readonly string[]) => void }>;

export function ManageableList<Row>({ adapter, rows, onSelectionChange }: ManageableListProps<Row>) {
  const rowIds = useMemo(() => rows.map(adapter.getRowId), [rows, adapter.getRowId]);
  const selection = useRowSelection(rowIds);
  useEffect(() => {
    onSelectionChange?.(selection.selectedVisibleIds);
  }, [onSelectionChange, selection.selectedVisibleIds]);
  return <SelectableDataGrid rowIds={rowIds} selectedIds={adapter.selectionEnabled === false ? [] : selection.selectedVisibleIds} allVisibleSelected={adapter.selectionEnabled !== false && selection.allVisibleSelected} onToggle={selection.toggle} onToggleAll={selection.toggleAll} selectionEnabled={adapter.selectionEnabled !== false} columnLabels={adapter.columns} renderRow={(id) => { const row = rows.find((candidate) => adapter.getRowId(candidate) === id); return row ? adapter.renderRow(row) : null; }} />;
}
