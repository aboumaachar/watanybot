import { useEffect, useMemo, useState } from "react";

export function useRowSelection(rowIds: readonly string[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const rowIdsSignature = JSON.stringify(rowIds);
  const visibleIds = useMemo(() => new Set(rowIds), [rowIdsSignature]);
  const selectedVisibleIds = useMemo(() => selectedIds.filter((id) => visibleIds.has(id)), [selectedIds, visibleIds]);
  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [visibleIds]);

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelectedIds((current) => selectedVisibleIds.length === rowIds.length ? current.filter((id) => !visibleIds.has(id)) : [...new Set([...current, ...rowIds])]);
  }

  function clear() {
    setSelectedIds([]);
  }

  return { selectedIds, selectedVisibleIds, allVisibleSelected: rowIds.length > 0 && selectedVisibleIds.length === rowIds.length, toggle, toggleAll, clear };
}