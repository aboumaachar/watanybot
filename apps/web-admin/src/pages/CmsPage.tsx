import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { applyCmsProceduresImport, dryRunCmsProceduresImport, exportCmsProcedures, getAdminCanonicalEditor, getAdminErrorCode, getAdminErrorMessage, getCmsProcedure, getCmsProcedureAudit, getCmsProcedureVersions, getCmsProcedures, getPayloadSyncStatus, openPayloadContentStudio, previewCmsProceduresExport, publishCmsProceduresImport, triggerPayloadSync, type CmsAuditEvent, type CmsEntityVersion, type CmsItem, type CmsStatus, type PayloadSyncStatus } from "../lib/api";
import { CmsCollectionToolbar, CmsDataTable, CmsExportDialog, CmsImportWizard, CmsPagination, CmsPreviewPanel, CmsRecordDrawer, CmsRowActionMenu, type CmsImportMutationResult, type CmsImportValidationResult } from "../components/cms/CmsPrimitives";
import CmsEditorialDocumentsPage from "./CmsEditorialDocumentsPage";
import CmsManagedContentPage from "./CmsManagedContentPage";
import { AdminPageHeader } from "../components/admin/AdminPrimitives";

type CmsDomain = "procedures" | "editorial-documents" | "forms" | "announcements";

function parseCmsDomain(value: string | null): CmsDomain {
  return value === "editorial-documents" || value === "forms" || value === "announcements" ? value : "procedures";
}

const statuses: CmsStatus[] = ["DRAFT", "REVIEW_READY", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];
const labels: Record<CmsStatus, string> = { DRAFT: "مسودة", REVIEW_READY: "جاهز للمراجعة", PUBLISHED: "منشور", UNPUBLISHED: "غير منشور", ARCHIVED: "مؤرشف" };
const statusOptions = statuses.map((value) => ({ value, label: labels[value] }));
const syncStateLabels: Record<PayloadSyncStatus["state"], string> = { NOT_CONFIGURED: "غير مهيأ", UNREACHABLE: "غير قابل للوصول", AUTH_FAILED: "فشل المصادقة", SCHEMA_INVALID: "مخطط غير صالح", READY: "جاهز", SYNC_FAILED: "فشل المزامنة", ACTIVE: "نشط", OUT_OF_SYNC: "تغييرات Payload غير متزامنة" };

function cmsErrorMessage(reason: unknown, fallback: string): string {
  const message = getAdminErrorMessage(reason, fallback);
  const code = getAdminErrorCode(reason);
  const owner = getAdminCanonicalEditor(reason);
  return [message, code ? `رمز الخطأ: ${code}` : "", owner ? `المحرر الأساسي: ${owner}` : ""].filter(Boolean).join(" · ");
}

export default function CmsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [domain, setDomainState] = useState<CmsDomain>(() => parseCmsDomain(searchParams.get("domain")));
  const setDomain = (next: CmsDomain) => {
    setDomainState(next);
    const updated = new URLSearchParams(searchParams);
    if (next === "procedures") updated.delete("domain");
    else updated.set("domain", next);
    setSearchParams(updated, { replace: true });
  };
  const [items, setItems] = useState<CmsItem[]>([]);
  const [counts, setCounts] = useState<Partial<Record<CmsStatus, number>>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CmsStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<PayloadSyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState(false);
  const [openingPayload, setOpeningPayload] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<CmsItem | null>(null);
  const [detailVersions, setDetailVersions] = useState<CmsEntityVersion[]>([]);
  const [detailAudit, setDetailAudit] = useState<CmsAuditEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / 20));

  useEffect(() => {
    const fromUrl = parseCmsDomain(searchParams.get("domain"));
    setDomainState((current) => current === fromUrl ? current : fromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (domain !== "procedures") return;
    let active = true;
    setLoading(true);
    void getCmsProcedures({ q: query, status: status || undefined, page, pageSize: 20 })
      .then((data) => { if (active) { setItems(data.items); setTotal(data.total); setCounts(data.statusCounts); setSelectedIds([]); setError(null); } })
      .catch((reason: unknown) => { if (active) setError(getAdminErrorMessage(reason, "تعذر تحميل محتوى الإجراءات.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, status, page, domain, refreshToken]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function togglePageSelection() {
    const pageIds = items.map((item) => item.id);
    setSelectedIds((current) => pageIds.every((id) => current.includes(id)) ? current.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...current, ...pageIds])));
  }

  async function exportProcedures() {
    setBusyAction(true);
    try {
      const payload = await exportCmsProcedures({ q: query, status: status || undefined });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "procedures-export.json";
      link.click();
      URL.revokeObjectURL(link.href);
      setNotice("تم تصدير الإجراءات المطابقة للفلاتر الحالية.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تصدير الإجراءات."));
    } finally {
      setBusyAction(false);
    }
  }

  async function previewProcedures() {
    setBusyAction(true);
    try {
      const html = await previewCmsProceduresExport();
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      globalThis.open(url, "_blank", "noopener,noreferrer");
      setNotice("تم فتح معاينة HTML الخاصة بمراجعة إجراءات Payload.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر فتح معاينة الإجراءات."));
    } finally {
      setBusyAction(false);
    }
  }

  async function openDetail(item: CmsItem) {
    setDetailItem(item);
    setDetailLoading(true);
    setError(null);
    try {
      const [detail, versions, audit] = await Promise.all([getCmsProcedure(item.id), getCmsProcedureVersions(item.id), getCmsProcedureAudit(item.id)]);
      setDetailItem(detail);
      setDetailVersions(versions);
      setDetailAudit(audit);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل تفاصيل الإجراء."));
    } finally {
      setDetailLoading(false);
    }
  }

  async function validateProceduresImport(payload: unknown): Promise<CmsImportValidationResult> {
    return dryRunCmsProceduresImport(payload);
  }

  async function applyProceduresImport(planId: string): Promise<CmsImportMutationResult> {
    const result = await applyCmsProceduresImport(planId);
    setNotice("تم تطبيق خطة الإجراءات كمسودة Payload.");
    setRefreshToken((value) => value + 1);
    return result;
  }

  async function publishProceduresImport(planId: string): Promise<CmsImportMutationResult> {
    const result = await publishCmsProceduresImport(planId);
    setNotice("تم نشر خطة الإجراءات. شغّل مزامنة Payload لعكسها في Gateway.");
    setRefreshToken((value) => value + 1);
    return result;
  }

  useEffect(() => {
    if (domain !== "procedures") return;
    let active = true;
    void getPayloadSyncStatus()
      .then((data) => { if (active) setSyncStatus(data); })
      .catch((reason: unknown) => { if (active) setError(getAdminErrorMessage(reason, "تعذر تحميل حالة مزامنة Payload.")); });
    return () => { active = false; };
  }, [domain, refreshToken]);

  async function openPayloadEditor() {
    setOpeningPayload(true);
    setError(null);
    try {
      await openPayloadContentStudio();
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر فتح محرر Payload المعتمد."));
      setOpeningPayload(false);
    }
  }

  async function syncPayload() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      await triggerPayloadSync();
      const refreshed = await getPayloadSyncStatus();
      setSyncStatus(refreshed);
      setRefreshToken((value) => value + 1);
      setNotice("تم نشر نسخة Payload المنشورة إلى Gateway.");
    } catch (reason: unknown) {
      setError(cmsErrorMessage(reason, "تعذر مزامنة محتوى Payload."));
    } finally {
      setSyncing(false);
    }
  }

  if (domain === "editorial-documents") return <CmsEditorialDocumentsPage onBack={() => setDomain("procedures")} />;
  if (domain === "forms" || domain === "announcements") return <CmsManagedContentPage domain={domain} onDomainChange={(nextDomain) => {
    setDomain(nextDomain);
  }} />;

  let content: JSX.Element;
  if (loading) {
    content = <p className="page-loading">جار تحميل المحتوى...</p>;
  } else if (items.length === 0) {
    content = <p className="muted">لا توجد إجراءات مطابقة.</p>;
  } else {
    content = <CmsDataTable rows={items} columns={["المعرف", "العنوان", "الحالة", "الإصدار", "الملكية", "الإجراءات"]} rowKey={(item) => item.id} selectedIds={selectedIds} onToggle={toggleSelected} onToggleAll={togglePageSelection} renderCells={(item) => <><td className="mono" dir="ltr">{item.id}</td><td>{item.title}</td><td><span className={`status-badge ${item.status.toLowerCase()}`}>{labels[item.status]}</span></td><td>{item.version}</td><td><span className="cms-readonly-badge">Payload · قراءة فقط</span></td><td><CmsRowActionMenu actions={[{ id: "view", label: "عرض", onClick: () => void openDetail(item) }]} /></td></>} />;
  }

  const syncState = syncStatus?.state || "READY";
  const syncStateClass = syncState.toLowerCase();
  const syncStateLabel = syncing ? "جارٍ العمل" : syncStateLabels[syncState];

  return <section className="superadmin-surface card procedures-page" dir="rtl">
    <AdminPageHeader eyebrow="المحتوى والمعرفة" title="إدارة الإجراءات" description="الإجراءات المنشورة مملوكة لـ Payload وتظهر هنا للقراءة فقط." />
    <div className="superadmin-shortcuts"><button type="button" className="accent">الإجراءات</button><button type="button" className="ghost" onClick={() => { setDomain("editorial-documents"); setPage(1); }}>وثائق Payload</button><button type="button" className="ghost" onClick={() => { setDomain("forms"); setPage(1); }}>النماذج</button><button type="button" className="ghost" onClick={() => { setDomain("announcements"); setPage(1); }}>التعاميم</button></div>
    <section className="cms-payload-sync-panel" aria-label="Payload sync status">
      <div><span className="eyebrow">المحرر الأساسي</span><strong>Payload CMS</strong><span className="muted">Gateway يعرض النسخة المنشورة فقط.</span></div>
      <div className="cms-payload-sync-state"><span className={`status-badge ${syncStateClass}`}>{syncStateLabel}</span>{syncStatus?.active && <small dir="ltr">{syncStatus.active.counts.proceduresPublished} إجراءات · {syncStatus.active.counts.documentsPublished} وثائق</small>}</div>
      <div className="ops-form-actions"><button type="button" className="ghost" onClick={() => void openPayloadEditor()} disabled={openingPayload}>{openingPayload ? "جارٍ فتح المحرر..." : "فتح محرر Payload"}</button><button type="button" className="accent" onClick={() => void syncPayload()} disabled={syncing || syncStatus?.running || syncStatus?.configured === false}>{syncing || syncStatus?.running ? "جارٍ النشر..." : "مزامنة Payload"}</button></div>
    </section>
    <div className="superadmin-kpis procedures-summary">{statuses.map((value) => <div className="superadmin-kpi card procedures-summary-card" key={value}><span className="eyebrow">{labels[value]}</span><strong>{counts[value] ?? 0}</strong></div>)}</div>
    <CmsCollectionToolbar query={query} onQueryChange={(value) => { setQuery(value); setPage(1); }} searchLabel="بحث في الإجراءات" searchPlaceholder="اكتب اسم الإجراء أو الوسم" status={status} statusOptions={statusOptions} onStatusChange={(value) => { setStatus(value); setPage(1); }} actions={<><CmsExportDialog label="تصدير JSON" busy={busyAction} onExport={() => void exportProcedures()} /><CmsExportDialog label="معاينة HTML" busy={busyAction} onExport={() => void previewProcedures()} /><button type="button" className="ghost" onClick={() => setImportOpen(true)}>استيراد JSON</button></>} />
      {selectedIds.length > 0 && <div className="superadmin-shortcuts" aria-live="polite"><span>تم تحديد {selectedIds.length} إجراء في الصفحة الحالية</span></div>}
    {error && <p role="alert" className="error-text">{error}</p>}
    {notice && <output className="cms-sync-notice">{notice}</output>}
    {content}
    <CmsPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    <CmsImportWizard open={importOpen} title="استيراد الإجراءات" onClose={() => setImportOpen(false)} onValidate={validateProceduresImport} onApply={applyProceduresImport} onPublish={publishProceduresImport} />
    <CmsRecordDrawer open={detailItem !== null} title={detailItem ? `تفاصيل ${detailItem.id}` : "تفاصيل الإجراء"} onClose={() => setDetailItem(null)}>
      {detailLoading ? <p className="muted">جارٍ تحميل التفاصيل...</p> : detailItem ? <><CmsPreviewPanel title="بيانات الإجراء"><p><strong>{detailItem.title}</strong></p><p>الحالة: {labels[detailItem.status]}</p><pre dir="ltr">{JSON.stringify(detailItem.record, null, 2)}</pre></CmsPreviewPanel><CmsPreviewPanel title="الإصدارات"><ul>{detailVersions.map((version) => <li key={version.id}>v{version.version} · {version.createdBy} · {new Date(version.createdAt).toLocaleString("ar-LB")}</li>)}</ul></CmsPreviewPanel><CmsPreviewPanel title="التدقيق"><ul>{detailAudit.map((event) => <li key={event.id}>{event.eventType} · {event.actorId} · {new Date(event.createdAt).toLocaleString("ar-LB")}</li>)}</ul></CmsPreviewPanel></> : null}
    </CmsRecordDrawer>
  </section>;
}