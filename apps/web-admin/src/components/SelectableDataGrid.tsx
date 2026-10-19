import type { ReactNode } from "react";

type SelectableDataGridProps = Readonly<{
  rowIds: readonly string[];
  selectedIds: readonly string[];
  allVisibleSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  renderRow: (id: string) => ReactNode;
  columnLabels?: readonly string[];
  selectionEnabled?: boolean;
}>;

export function SelectableDataGrid({ rowIds, selectedIds, allVisibleSelected, onToggle, onToggleAll, renderRow, columnLabels = ["المعرف", "العنوان", "الحالة", "الإصدار", "الإجراء"], selectionEnabled = true }: SelectableDataGridProps) {
  return <table><thead><tr>{selectionEnabled ? <th><input aria-label="اختيار كل النتائج" type="checkbox" checked={allVisibleSelected} onChange={onToggleAll} /></th> : null}{columnLabels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rowIds.map((id) => <tr key={id}>{selectionEnabled ? <td><input aria-label={`اختيار ${id}`} type="checkbox" checked={selectedIds.includes(id)} onChange={() => onToggle(id)} /></td> : null}{renderRow(id)}</tr>)}</tbody></table>;
}