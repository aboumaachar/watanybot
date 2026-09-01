import { useEffect, useState } from "react";
import { getAdminCanonicalEditor, getAdminErrorCode, getAdminErrorMessage, getCmsAnnouncements, getCmsForms, getCmsProcedures, getCmsFormPublicUrl, getPayloadSyncStatus, runCmsAnnouncementAction, runCmsAnnouncementBulkArchive, runCmsAnnouncementBulkEdit, runCmsFormAction, triggerPayloadSync, type CmsFormItem, type CmsItem, type CmsStatus, type PayloadSyncStatus } from "../lib/api";
import { BulkMutationToolbar } from "../components/BulkMutationToolbar";
import { SelectableDataGrid } from "../components/SelectableDataGrid";
import { useRowSelection } from "../hooks/useRowSelection";
import CmsDocumentsPage from "./CmsDocumentsPage";
import CmsEditorialDocumentsPage from "./CmsEditorialDocumentsPage";

const statuses: CmsStatus[] = ["DRAFT", "REVIEW_READY", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];
const labels: Record<CmsStatus, string> = { DRAFT: "مسودة", REVIEW_READY: "جاهز للمراجعة", PUBLISHED: "منشور", UNPUBLISHED: "غير منشور", ARCHIVED: "مؤرشف" };

export default function CmsPage() {
  const [domain, setDomain] = useState<"procedures" | "documents" | "editorial-documents" | "forms" | "announcements">("procedures");
  const [items, setItems] = useState<CmsItem[]>([]);
  const [counts, setCounts] = useState<Partial<Record<CmsStatus, number>>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CmsStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<PayloadSyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const selection = useRowSelection(items.map((item) => item.id));

  useEffect(() => {
    if (domain === "documents" || domain === "editorial-documents") return;
    let active = true;
    setLoading(true);
    const load = domain === "forms" ? getCmsForms : domain === "announcements" ? getCmsAnnouncements : getCmsProcedures;
    void load({ q: query, status: status || undefined, page, pageSize: 20 })
      .then((data) => { if (active) { setItems(data.items); setCounts(data.statusCounts); setError(null); } })
      .catch((reason: unknown) => { if (active) setError(getAdminErrorMessage(reason, "تعذر تحميل محتوى الإجراءات.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, status, page, domain, refreshToken]);

  useEffect(() => {
    if (domain !== "procedures") return;
    let active = true;
    void getPayloadSyncStatus()
      .then((data) => { if (active) setSyncStatus(data); })
      .catch((reason: unknown) => { if (active) setError(getAdminErrorMessage(reason, "تعذر تحميل حالة مزامنة Payload.")); });
    return () => { active = false; };
  }, [domain, refreshToken]);

  function errorMessage(reason: unknown, fallback: string): string {
    const message = getAdminErrorMessage(reason, fallback);
    const code = getAdminErrorCode(reason);
    const owner = getAdminCanonicalEditor(reason);
    return [message, code ? `رمز الخطأ: ${code}` : "", owner ? `المحرر الأساسي: ${owner}` : ""].filter(Boolean).join(" · ");
  }

  async function dispatchBulk(mutation: "bulk_archive" | "bulk_delete" | "bulk_edit", ids: readonly string[]) {
    if (domain !== "announcements" || mutation !== "bulk_archive") throw new Error("This action is not available for the selected CMS domain.");
    const updated = mutation === "bulk_archive" ? await runCmsAnnouncementBulkArchive(ids) : await runCmsAnnouncementBulkEdit(ids, { payload: { bulkEdited: true } });
    setItems((current) => current.map((item) => updated.find((next) => next.id === item.id) || item));
    selection.clear();
  }

  async function action(item: CmsItem, next: "publish" | "unpublish" | "archive" | "restore") {
    if (domain === "procedures") return;
    try {
      const updated = domain === "forms"
        ? await runCmsFormAction(item.id, next as "publish" | "unpublish" | "archive")
        : await runCmsAnnouncementAction(item.id, next as "publish" | "unpublish" | "archive");
      setItems((current) => current.map((candidate) => candidate.id === updated.id ? updated as CmsItem : candidate));
    } catch (reason) { setError(errorMessage(reason, "تعذر تنفيذ دورة حياة المحتوى.")); }
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
      setError(errorMessage(reason, "تعذر مزامنة محتوى Payload."));
    } finally {
      setSyncing(false);
    }
  }

  if (domain === "documents") {
    return <CmsDocumentsPage onBack={() => setDomain("procedures")} />;
  }
  if (domain === "editorial-documents") {
    return <CmsEditorialDocumentsPage onBack={() => setDomain("procedures")} />;
  }

  function openFormPreview(item: CmsItem) {
    if (domain !== "forms") return;
    const form = item as CmsFormItem;
    globalThis.open(getCmsFormPublicUrl(form), "_blank", "noopener,noreferrer");
  }

  function downloadForm(item: CmsItem) {
    if (domain !== "forms") return;
    const form = item as CmsFormItem;
    const link = document.createElement("a");
    link.href = getCmsFormPublicUrl(form);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.download = form.publicCode || form.publicId || "form";
    link.click();
  }

  let content: JSX.Element;
  if (loading) {
    content = <p className="page-loading">جار تحميل المحتوى...</p>;
  } else if (items.length === 0) {
    content = <p className="muted">لا توجد نتائج.</p>;
  } else {
    content = <><BulkMutationToolbar selectedIds={selection.selectedVisibleIds} capabilities={{ bulk_archive: domain === "announcements" ? "SUPPORTED" : "NOT_APPLICABLE", bulk_delete: "MISSING", bulk_edit: "MISSING" }} dispatch={dispatchBulk} /><div className="table-wrap"><SelectableDataGrid rowIds={items.map((item) => item.id)} selectedIds={selection.selectedVisibleIds} allVisibleSelected={selection.allVisibleSelected} onToggle={selection.toggle} onToggleAll={selection.toggleAll} renderRow={(id) => { const item = items.find((candidate) => candidate.id === id); if (!item) return null; return <><td className="mono" dir="ltr">{item.id}</td><td>{item.title}</td><td><span className={`status-badge ${item.status.toLowerCase()}`}>{labels[item.status]}</span></td><td>{item.version}</td><td>{domain === "procedures" ? <span className="cms-readonly-badge">Payload · قراءة فقط</span> : <>{domain === "forms" ? <><button type="button" onClick={() => openFormPreview(item)}>معاينة / فتح</button><button type="button" onClick={() => downloadForm(item)}>تنزيل</button></> : null}{item.status === "DRAFT" || item.status === "UNPUBLISHED" ? <button type="button" onClick={() => void action(item, "publish")}>نشر</button> : null}{item.status === "PUBLISHED" ? <button type="button" onClick={() => void action(item, "unpublish")}>إلغاء النشر</button> : null}{item.status !== "ARCHIVED" ? <button type="button" onClick={() => void action(item, "archive")}>أرشفة</button> : <button type="button" onClick={() => void action(item, "restore")}>استعادة</button>}</>}</td></>; }} /></div></>;
  }

  return <section className="superadmin-surface card">
    <div className="page-header"><span className="eyebrow">CMS Core / {domain === "forms" ? "Forms" : domain === "announcements" ? "Announcements" : "Procedures"}</span><h2>إدارة {domain === "forms" ? "النماذج" : domain === "announcements" ? "التعاميم" : "الإجراءات"}</h2><p className="muted">الإجراءات المنشورة للعرض من Payload، مع بقاء النماذج والتعاميم ضمن أدواتها الحالية.</p></div>
    <div className="superadmin-shortcuts"><button type="button" className={domain === "procedures" ? "accent" : "ghost"} onClick={() => { setDomain("procedures"); setPage(1); }}>الإجراءات</button><button type="button" className="ghost" onClick={() => { setDomain("documents"); setPage(1); }}>الوثائق التشغيلية</button><button type="button" className="ghost" onClick={() => { setDomain("editorial-documents"); setPage(1); }}>وثائق Payload</button><button type="button" className={domain === "forms" ? "accent" : "ghost"} onClick={() => { setDomain("forms"); setPage(1); }}>النماذج</button><button type="button" className={domain === "announcements" ? "accent" : "ghost"} onClick={() => { setDomain("announcements"); setPage(1); }}>التعاميم</button></div>
    {domain === "procedures" && <section className="cms-payload-sync-panel" aria-label="Payload sync status">
      <div><span className="eyebrow">المحرر الأساسي</span><strong>Payload CMS</strong><span className="muted">Gateway يعرض النسخة المنشورة فقط.</span></div>
      <div className="cms-payload-sync-state"><span className={`status-badge ${syncStatus?.active ? "published" : "draft"}`}>{syncStatus?.running || syncing ? "جارٍ العمل" : syncStatus?.active ? "متصل" : "لم تتم المزامنة"}</span>{syncStatus?.active && <small dir="ltr">{syncStatus.active.counts.proceduresPublished} إجراءات · {syncStatus.active.counts.documentsPublished} وثائق</small>}</div>
      <button type="button" className="accent" onClick={() => void syncPayload()} disabled={syncing || syncStatus?.running || syncStatus?.configured === false}>{syncing || syncStatus?.running ? "جارٍ النشر..." : "مزامنة Payload"}</button>
    </section>}
    <div className="superadmin-kpis">{statuses.map((value) => <div className="superadmin-kpi card" key={value}><span className="eyebrow">{labels[value]}</span><strong>{counts[value] ?? 0}</strong></div>)}</div>
    <div className="superadmin-shortcuts"><input aria-label="بحث في الإجراءات" placeholder="بحث..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><select aria-label="تصفية حسب الحالة" value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}><option value="">كل الحالات</option>{statuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></div>
    {error && <p role="alert" className="error-text">{error}</p>}
    {notice && <p role="status" className="cms-sync-notice">{notice}</p>}
    {content}
    <div className="superadmin-shortcuts"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</button><span>صفحة {page}</span><button type="button" disabled={items.length < 20} onClick={() => setPage((value) => value + 1)}>التالي</button></div>
  </section>;
}