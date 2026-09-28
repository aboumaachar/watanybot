import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { NavLink } from "react-router-dom";

export function AdminPageHeader({ eyebrow = "إدارة موطني", title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="admin-page-header"><div><span className="admin-eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{actions && <div className="admin-page-actions">{actions}</div>}</header>;
}

export function AdminPageSection({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="admin-section"><div className="admin-section-header"><div><h2>{title}</h2>{description && <p className="muted">{description}</p>}</div>{action}</div>{children}</section>;
}

export function AdminStatCard({ label, value, detail, state = "ready", to }: { label: string; value: ReactNode; detail?: string; state?: "ready" | "loading" | "unavailable" | "error"; to?: string }) {
  const content = <div className={`admin-stat-card state-${state}`}><span className="admin-stat-label">{label}</span><strong>{value}</strong>{detail && <span className="admin-stat-detail">{detail}</span>}</div>;
  return to ? <NavLink className="admin-stat-link" to={to}>{content}</NavLink> : content;
}

export function AdminStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const labels: Record<string, string> = {
    healthy: "سليم", available: "متاح", degraded: "متدهور", unavailable: "غير متاح", enabled: "مفعّل", disabled: "معطّل",
    active: "نشط", suspended: "موقوف", banned: "محظور", pending: "قيد الانتظار", approved: "مقبول", rejected: "مرفوض", published: "منشور", draft: "مسودة",
    not_configured: "غير مهيأ", ready: "جاهز", connecting: "جارٍ الاتصال", connected: "متصل", gateway: "البوابة", "gateway index": "فهرس البوابة",
  };
  return <span className={`admin-status-badge status-${normalized}`}><span aria-hidden="true" className="status-dot" />{labels[normalized] ?? status}</span>;
}

export function AdminNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "error" }) {
  return <div className={`admin-notice notice-${tone}`} role={tone === "error" ? "alert" : undefined}>{children}</div>;
}

export function AdminTabs({ items, value, onChange }: { items: Array<{ value: string; label: string; count?: number }>; value: string; onChange: (value: string) => void }) {
  return <div className="admin-tabs" role="tablist">{items.map((item) => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} className={value === item.value ? "active" : ""} onClick={() => onChange(item.value)}>{item.label}{item.count !== undefined && <span>{item.count}</span>}</button>)}</div>;
}

export function AdminSearchInput({ value, onChange, placeholder = "بحث" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="admin-search"><span className="sr-only">{placeholder}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" /></label>;
}

export function AdminTableToolbar({ children, resultCount, onClear }: { children?: ReactNode; resultCount?: number; onClear?: () => void }) {
  return <div className="admin-table-toolbar"><div className="admin-toolbar-controls">{children}</div>{resultCount !== undefined && <span className="admin-result-count">{resultCount} نتيجة</span>}{onClear && <button type="button" className="ghost sm" onClick={onClear}>مسح التصفية</button>}</div>;
}

export function AdminDataTable<T extends { id: string }>({ rows, columns, renderRow, loading, error, empty }: { rows: T[]; columns: string[]; renderRow: (row: T) => ReactNode; loading?: boolean; error?: string; empty?: string }) {
  return <div className="admin-data-table-wrap"><table className="admin-data-table"><caption className="sr-only">Management data</caption><thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={columns.length}><AdminLoadingState /></td></tr> : error ? <tr><td colSpan={columns.length}><AdminErrorState message={error} /></td></tr> : rows.length === 0 ? <tr><td colSpan={columns.length}><AdminEmptyState message={empty} /></td></tr> : rows.map((row) => <tr key={row.id}>{renderRow(row)}</tr>)}</tbody></table></div>;
}

export function AdminLoadingState({ message = "جارٍ التحميل..." }: { message?: string }) { return <div className="admin-state" aria-live="polite">{message}</div>; }
export function AdminEmptyState({ message = "لا توجد نتائج." }: { message?: string }) { return <div className="admin-state">{message}</div>; }
export function AdminErrorState({ message = "تعذر تحميل البيانات." }: { message?: string }) { return <div className="admin-state admin-state-error" role="alert">{message}</div>; }
export function AdminActionCard({ title, description, to, icon }: { title: string; description: string; to: string; icon: string }) { return <NavLink className="admin-action-card" to={to}><span className="admin-action-icon" aria-hidden="true">{icon}</span><span><strong>{title}</strong><small>{description}</small></span><span aria-hidden="true">→</span></NavLink>; }

export function AdminPagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return <div className="pagination" aria-label="التنقل بين الصفحات"><button type="button" className="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>السابق</button><span className="muted">صفحة {page} من {pageCount} ({total} إجمالي)</span><button type="button" className="ghost" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>التالي</button></div>;
}

export function AdminConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }: { title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return <div className="admin-dialog-backdrop" role="presentation"><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title"><h2 id="admin-dialog-title">{title}</h2><p>{message}</p><div className="admin-dialog-actions"><button type="button" className="ghost" onClick={onCancel}>إلغاء</button><button type="button" className={danger ? "admin-danger-button" : "accent"} onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

export function AdminDetailDrawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="admin-drawer-backdrop" role="presentation"><aside className="admin-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-drawer-title"><div className="admin-drawer-header"><h2 id="admin-drawer-title">{title}</h2><button type="button" className="ghost" aria-label="إغلاق التفاصيل" onClick={onClose}>إغلاق</button></div>{children}</aside></div>;
}

export function OpsCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ops-card ${className}`.trim()}>{children}</div>;
}

export function OpsToolbar({ children }: { children: ReactNode }) {
  return <div className="ops-toolbar">{children}</div>;
}

export function OpsFilterSelect({ label, ...props }: Readonly<{ label: string } & SelectHTMLAttributes<HTMLSelectElement>>) {
  return <label className="ops-filter"><span>{label}</span><select {...props} /></label>;
}

export function OpsButton({ variant = "ghost", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ghost" | "primary" | "danger" }) {
  return <button {...props} className={`ops-button ${variant} ${props.className ?? ""}`.trim()} />;
}

export function OpsFormGrid({ children }: { children: ReactNode }) {
  return <div className="ops-form-grid">{children}</div>;
}

export function OpsField({ label, children, help, className = "" }: { label: string; children: ReactNode; help?: string; className?: string }) {
  return <label className={`ops-field ${className}`.trim()}><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}

export function OpsHealthIndicator({ label, status, detail }: { label: string; status: "healthy" | "degraded" | "unavailable" | "checking"; detail?: string }) {
  const statusLabels = { healthy: "سليم", degraded: "متدهور", unavailable: "غير متاح", checking: "جارٍ التحقق" } as const;
  const statusLabel = statusLabels[status];
  return <div className="ops-health-indicator"><span className={`ops-health-dot ${status}`} /><span><strong>{label}</strong>{detail && <small>{detail}</small>}</span><AdminStatusBadge status={statusLabel} /></div>;
}

export const OpsPageHeader = AdminPageHeader;
export const OpsSection = AdminPageSection;
export const OpsMetricCard = AdminStatCard;
export const OpsSearchField = AdminSearchInput;
export const OpsDataTable = AdminDataTable;
export const OpsEmptyState = AdminEmptyState;
export const OpsErrorState = AdminErrorState;
export const OpsLoadingState = AdminLoadingState;
export const OpsDrawer = AdminDetailDrawer;
export const OpsModal = AdminConfirmDialog;
export const OpsConfirmDialog = AdminConfirmDialog;
export const OpsTabs = AdminTabs;
export const OpsInlineNotice = AdminNotice;
export const OpsStatusBadge = AdminStatusBadge;
export const OpsCardMetric = AdminStatCard;
