import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function AdminPageSection({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="admin-section"><div className="admin-section-header"><div><h2>{title}</h2>{description && <p className="muted">{description}</p>}</div>{action}</div>{children}</section>;
}

export function AdminStatCard({ label, value, detail, state = "ready", to }: { label: string; value: ReactNode; detail?: string; state?: "ready" | "loading" | "unavailable" | "error"; to?: string }) {
  const content = <div className={`admin-stat-card state-${state}`}><span className="admin-stat-label">{label}</span><strong>{value}</strong>{detail && <span className="admin-stat-detail">{detail}</span>}</div>;
  return to ? <NavLink className="admin-stat-link" to={to}>{content}</NavLink> : content;
}

export function AdminStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return <span className={`admin-status-badge status-${normalized}`}><span aria-hidden="true" className="status-dot" />{status}</span>;
}

export function AdminSearchInput({ value, onChange, placeholder = "Search" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="admin-search"><span className="sr-only">{placeholder}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" /></label>;
}

export function AdminTableToolbar({ children, resultCount, onClear }: { children?: ReactNode; resultCount?: number; onClear?: () => void }) {
  return <div className="admin-table-toolbar"><div className="admin-toolbar-controls">{children}</div>{resultCount !== undefined && <span className="admin-result-count">{resultCount} results</span>}{onClear && <button type="button" className="ghost sm" onClick={onClear}>Clear filters</button>}</div>;
}

export function AdminDataTable<T extends { id: string }>({ rows, columns, renderRow, loading, error, empty }: { rows: T[]; columns: string[]; renderRow: (row: T) => ReactNode; loading?: boolean; error?: string; empty?: string }) {
  return <div className="admin-data-table-wrap"><table className="admin-data-table"><caption className="sr-only">Management data</caption><thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={columns.length}><AdminLoadingState /></td></tr> : error ? <tr><td colSpan={columns.length}><AdminErrorState message={error} /></td></tr> : rows.length === 0 ? <tr><td colSpan={columns.length}><AdminEmptyState message={empty} /></td></tr> : rows.map((row) => <tr key={row.id}>{renderRow(row)}</tr>)}</tbody></table></div>;
}

export function AdminLoadingState({ message = "Loading..." }: { message?: string }) { return <div className="admin-state" aria-live="polite">{message}</div>; }
export function AdminEmptyState({ message = "No results found." }: { message?: string }) { return <div className="admin-state">{message}</div>; }
export function AdminErrorState({ message = "Unable to load this data." }: { message?: string }) { return <div className="admin-state admin-state-error" role="alert">{message}</div>; }
export function AdminActionCard({ title, description, to, icon }: { title: string; description: string; to: string; icon: string }) { return <NavLink className="admin-action-card" to={to}><span className="admin-action-icon" aria-hidden="true">{icon}</span><span><strong>{title}</strong><small>{description}</small></span><span aria-hidden="true">→</span></NavLink>; }

export function AdminPagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return <div className="pagination" aria-label="Pagination"><button type="button" className="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button><span className="muted">Page {page} of {pageCount} ({total} total)</span><button type="button" className="ghost" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Next</button></div>;
}

export function AdminConfirmDialog({ title, message, confirmLabel = "Confirm", onConfirm, onCancel }: { title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  return <div className="admin-dialog-backdrop" role="presentation"><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title"><h2 id="admin-dialog-title">{title}</h2><p>{message}</p><div className="admin-dialog-actions"><button type="button" className="ghost" onClick={onCancel}>Cancel</button><button type="button" className="accent" onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

export function AdminDetailDrawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="admin-drawer-backdrop" role="presentation"><aside className="admin-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-drawer-title"><div className="admin-drawer-header"><h2 id="admin-drawer-title">{title}</h2><button type="button" className="ghost" aria-label="Close details" onClick={onClose}>Close</button></div>{children}</aside></div>;
}
