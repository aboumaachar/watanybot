import { useEffect, useState, type ReactNode } from "react";

export type CmsToolbarStatusOption<Value extends string> = Readonly<{ value: Value; label: string }>;

export type CmsCollectionToolbarProps<Value extends string> = Readonly<{
  query: string;
  onQueryChange: (value: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  status?: Value | "";
  statusLabel?: string;
  statusOptions?: readonly CmsToolbarStatusOption<Value>[];
  onStatusChange?: (value: Value | "") => void;
  actions?: ReactNode;
}>;

export function CmsCollectionToolbar<Value extends string>({ query, onQueryChange, searchLabel, searchPlaceholder, status = "", statusLabel = "الحالة", statusOptions = [], onStatusChange, actions }: CmsCollectionToolbarProps<Value>) {
  return (
    <div className="superadmin-shortcuts procedures-toolbar cms-collection-toolbar">
      <label>
        <span>{searchLabel}</span>
        <input aria-label={searchLabel} placeholder={searchPlaceholder} value={query} onChange={(event) => onQueryChange(event.target.value)} />
      </label>
      {statusOptions.length > 0 && onStatusChange ? (
        <label>
          <span>{statusLabel}</span>
          <select aria-label={statusLabel} value={status} onChange={(event) => onStatusChange(event.target.value as Value | "")}>
            <option value="">كل الحالات</option>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ) : null}
      {actions}
    </div>
  );
}

export type CmsDataTableProps<Row> = Readonly<{
  rows: readonly Row[];
  columns: readonly string[];
  rowKey: (row: Row) => string;
  renderCells: (row: Row) => ReactNode;
  selectedIds?: readonly string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  selectionLabel?: string;
}>;

export function CmsDataTable<Row>({ rows, columns, rowKey, renderCells, selectedIds = [], onToggle, onToggleAll, selectionLabel = "تحديد الصفحة" }: CmsDataTableProps<Row>) {
  const selectionEnabled = Boolean(onToggle && onToggleAll);
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(rowKey(row)));
  return (
    <div className="table-wrap cms-data-table">
      <table className="admin-table">
        <thead>
          <tr>
            {selectionEnabled ? <th><input type="checkbox" aria-label={selectionLabel} checked={allSelected} onChange={onToggleAll} /></th> : null}
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rowKey(row);
            return <tr key={id}>
              {selectionEnabled ? <td><input type="checkbox" aria-label={`تحديد ${id}`} checked={selectedIds.includes(id)} onChange={() => onToggle?.(id)} /></td> : null}
              {renderCells(row)}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

export type CmsPaginationProps = Readonly<{
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}>;

export function CmsPagination({ page, totalPages, onPageChange }: CmsPaginationProps) {
  return <div className="superadmin-shortcuts cms-pagination"><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>التالي</button></div>;
}

export type CmsRowAction = Readonly<{ id: string; label: string; disabled?: boolean; onClick: () => void }>;

export function CmsRowActionMenu({ actions }: Readonly<{ actions: readonly CmsRowAction[] }>) {
  if (actions.length === 0) return null;
  return <div className="cms-row-actions">{actions.map((action) => <button key={action.id} type="button" className="ghost" disabled={action.disabled} onClick={action.onClick}>{action.label}</button>)}</div>;
}

export type CmsBulkAction = Readonly<{ id: string; label: string; destructive?: boolean; disabled?: boolean; onClick: () => void }>;

export function CmsBulkActionBar({ selectedCount, actions }: Readonly<{ selectedCount: number; actions: readonly CmsBulkAction[] }>) {
  if (selectedCount === 0 || actions.length === 0) return null;
  return <div className="superadmin-shortcuts cms-bulk-action-bar" aria-live="polite"><span>تم تحديد {selectedCount}</span>{actions.map((action) => <button key={action.id} type="button" className={action.destructive ? "danger" : "ghost"} disabled={action.disabled} onClick={action.onClick}>{action.label}</button>)}</div>;
}

export function CmsExportDialog({ label = "تصدير", busy = false, onExport }: Readonly<{ label?: string; busy?: boolean; onExport: () => void }>) {
  return <button type="button" className="ghost" disabled={busy} onClick={onExport}>{busy ? "جارٍ التصدير..." : label}</button>;
}

export type CmsImportSummary = Readonly<{
  valid_count: number | null;
  warning_count: number | null;
  invalid_count: number | null;
  new_count: number | null;
  update_count: number | null;
  conflict_count: number | null;
  requested_count?: number | null;
  validated_count?: number | null;
  success_count?: number | null;
  failed_count?: number | null;
  skipped_count?: number | null;
  errors?: readonly string[];
}>;

export type CmsImportValidationResult = Readonly<{ planId: string; summary: CmsImportSummary }>;
export type CmsImportMutationResult = Readonly<{ state: string; summary: CmsImportSummary }>;

function summaryValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "غير متاح" : String(value);
}

function SummaryGrid({ summary }: Readonly<{ summary: CmsImportSummary }>) {
  const fields: readonly [keyof CmsImportSummary, string][] = [
    ["valid_count", "صالح"], ["warning_count", "تحذيرات"], ["invalid_count", "غير صالح"],
    ["new_count", "جديد"], ["update_count", "تحديث"], ["conflict_count", "تعارض"],
    ["requested_count", "مطلوب"], ["validated_count", "تم التحقق منه"], ["success_count", "ناجح"],
    ["failed_count", "فاشل"], ["skipped_count", "متجاوز"],
  ];
  return <div className="cms-import-summary">{fields.map(([key, label]) => <div className="superadmin-kpi card" key={key}><span className="eyebrow">{label}</span><strong>{summaryValue(summary[key] as number | null | undefined)}</strong></div>)}</div>;
}

export type CmsImportWizardProps = Readonly<{
  open: boolean;
  title: string;
  onClose: () => void;
  onValidate: (payload: unknown) => Promise<CmsImportValidationResult>;
  onApply: (planId: string) => Promise<CmsImportMutationResult>;
  onPublish?: (planId: string) => Promise<CmsImportMutationResult>;
}>;

export function CmsImportWizard({ open, title, onClose, onValidate, onApply, onPublish }: CmsImportWizardProps) {
  const [stage, setStage] = useState<"UPLOAD" | "MAP" | "PREVIEW" | "RESULT">("UPLOAD");
  const [fileName, setFileName] = useState("");
  const [payload, setPayload] = useState<unknown>(null);
  const [planId, setPlanId] = useState("");
  const [summary, setSummary] = useState<CmsImportSummary | null>(null);
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStage("UPLOAD");
    setFileName("");
    setPayload(null);
    setPlanId("");
    setSummary(null);
    setState("");
    setBusy(false);
    setError("");
  }, [open]);

  if (!open) return null;

  async function readFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setPayload(JSON.parse(await file.text()));
      setFileName(file.name);
      setStage("MAP");
    } catch {
      setError("تعذر قراءة JSON. حمّل ملفاً بصيغة JSON صحيحة.");
    } finally {
      setBusy(false);
    }
  }

  async function validate() {
    if (payload === null) return;
    setBusy(true);
    setError("");
    try {
      const result = await onValidate(payload);
      setPlanId(result.planId);
      setSummary(result.summary);
      setStage("PREVIEW");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "تعذر التحقق من ملف الاستيراد.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!planId) return;
    setBusy(true);
    setError("");
    try {
      const result = await onApply(planId);
      setSummary(result.summary);
      setState(result.state);
      setStage("RESULT");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "تعذر تطبيق خطة الاستيراد.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!planId || !onPublish) return;
    setBusy(true);
    setError("");
    try {
      const result = await onPublish(planId);
      setSummary(result.summary);
      setState(result.state);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "تعذر نشر خطة الاستيراد.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="cms-import-wizard" role="dialog" aria-modal="true" aria-label={title}>
    <div className="cms-import-wizard-header"><div><span className="eyebrow">استيراد CMS staged</span><h3>{title}</h3></div><button type="button" className="ghost" onClick={onClose}>إغلاق</button></div>
    {stage === "UPLOAD" ? <div className="cms-import-step"><p>ارفع ملف JSON للتحقق منه دون كتابة.</p><input type="file" accept="application/json,.json" aria-label="ملف الاستيراد" disabled={busy} onChange={(event) => void readFile(event.target.files?.[0])} /></div> : null}
    {stage === "MAP" ? <div className="cms-import-step"><p>الملف: <span dir="ltr">{fileName}</span></p><p>تمت قراءة البنية. ستتم مطابقة الحقول وفق مخطط Procedures قبل أي كتابة.</p><button type="button" className="accent" disabled={busy} onClick={() => void validate()}>تحقق ومعاينة</button></div> : null}
    {stage === "PREVIEW" && summary ? <div className="cms-import-step"><p>تم إنشاء خطة تحقق. لا توجد كتابة قبل التأكيد.</p><SummaryGrid summary={summary} /><button type="button" className="accent" disabled={busy || summary.invalid_count !== 0 || !planId} onClick={() => void apply()}>تطبيق كمسودة</button></div> : null}
    {stage === "RESULT" && summary ? <div className="cms-import-step"><p>الحالة: <strong>{state}</strong></p><SummaryGrid summary={summary} />{onPublish && state === "APPLIED" ? <button type="button" className="accent" disabled={busy} onClick={() => void publish()}>نشر بعد المراجعة</button> : null}</div> : null}
    {error ? <p role="alert" className="error-text">{error}</p> : null}
  </div>;
}

export function CmsRecordDrawer({ open, title, onClose, children }: Readonly<{ open: boolean; title: string; onClose: () => void; children: ReactNode }>) {
  if (!open) return null;
  return <aside className="cms-record-drawer" role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button type="button" className="ghost" onClick={onClose}>إغلاق</button></header>{children}</aside>;
}

export function CmsEditorForm({ children, onSubmit }: Readonly<{ children: ReactNode; onSubmit: () => void }>) {
  return <form className="cms-editor-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>{children}</form>;
}

export function CmsPreviewPanel({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return <section className="cms-preview-panel" aria-label={title}><h3>{title}</h3>{children}</section>;
}

export function CmsDeleteConfirmation({ open, count, onCancel, onConfirm }: Readonly<{ open: boolean; count: number; onCancel: () => void; onConfirm: () => void }>) {
  if (!open) return null;
  return <div className="cms-delete-confirmation" role="alertdialog" aria-modal="true"><p>سيتم حذف {count} سجلاً نهائياً.</p><button type="button" className="ghost" onClick={onCancel}>إلغاء</button><button type="button" className="danger" onClick={onConfirm}>تأكيد الحذف</button></div>;
}
