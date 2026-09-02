import { useEffect, useState } from "react";
import { getAdminCanonicalEditor, getAdminErrorCode, getAdminErrorMessage, getCmsProcedures, getPayloadSyncStatus, triggerPayloadSync, type CmsItem, type CmsStatus, type PayloadSyncStatus } from "../lib/api";
import CmsDocumentsPage from "./CmsDocumentsPage";
import CmsEditorialDocumentsPage from "./CmsEditorialDocumentsPage";
import CmsManagedContentPage from "./CmsManagedContentPage";

const statuses: CmsStatus[] = ["DRAFT", "REVIEW_READY", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];
const labels: Record<CmsStatus, string> = { DRAFT: "مسودة", REVIEW_READY: "جاهز للمراجعة", PUBLISHED: "منشور", UNPUBLISHED: "غير منشور", ARCHIVED: "مؤرشف" };

function cmsErrorMessage(reason: unknown, fallback: string): string {
  const message = getAdminErrorMessage(reason, fallback);
  const code = getAdminErrorCode(reason);
  const owner = getAdminCanonicalEditor(reason);
  return [message, code ? `رمز الخطأ: ${code}` : "", owner ? `المحرر الأساسي: ${owner}` : ""].filter(Boolean).join(" · ");
}

export default function CmsPage() {
  const [domain, setDomain] = useState<"procedures" | "documents" | "editorial-documents" | "forms" | "announcements">("procedures");
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
  const totalPages = Math.max(1, Math.ceil(total / 20));

  useEffect(() => {
    if (domain !== "procedures") return;
    let active = true;
    setLoading(true);
    void getCmsProcedures({ q: query, status: status || undefined, page, pageSize: 20 })
      .then((data) => { if (active) { setItems(data.items); setTotal(data.total); setCounts(data.statusCounts); setError(null); } })
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

  if (domain === "documents") return <CmsDocumentsPage onBack={() => setDomain("procedures")} />;
  if (domain === "editorial-documents") return <CmsEditorialDocumentsPage onBack={() => setDomain("procedures")} />;
  if (domain === "forms" || domain === "announcements") return <CmsManagedContentPage domain={domain} onDomainChange={setDomain} />;

  let content: JSX.Element;
  if (loading) {
    content = <p className="page-loading">جار تحميل المحتوى...</p>;
  } else if (items.length === 0) {
    content = <p className="muted">لا توجد إجراءات مطابقة.</p>;
  } else {
    content = <div className="table-wrap"><table className="admin-table"><thead><tr><th>المعرف</th><th>العنوان</th><th>الحالة</th><th>الإصدار</th><th>الملكية</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="mono" dir="ltr">{item.id}</td><td>{item.title}</td><td><span className={`status-badge ${item.status.toLowerCase()}`}>{labels[item.status]}</span></td><td>{item.version}</td><td><span className="cms-readonly-badge">Payload · قراءة فقط</span></td></tr>)}</tbody></table></div>;
  }

  return <section className="superadmin-surface card">
    <div className="page-header"><span className="eyebrow">CMS Core / Procedures</span><h2>إدارة الإجراءات</h2><p className="muted">الإجراءات المنشورة مملوكة لـ Payload وتظهر هنا للقراءة فقط.</p></div>
    <div className="superadmin-shortcuts"><button type="button" className="accent">الإجراءات</button><button type="button" className="ghost" onClick={() => { setDomain("documents"); setPage(1); }}>الوثائق التشغيلية</button><button type="button" className="ghost" onClick={() => { setDomain("editorial-documents"); setPage(1); }}>وثائق Payload</button><button type="button" className="ghost" onClick={() => { setDomain("forms"); setPage(1); }}>النماذج</button><button type="button" className="ghost" onClick={() => { setDomain("announcements"); setPage(1); }}>التعاميم</button></div>
    <section className="cms-payload-sync-panel" aria-label="Payload sync status">
      <div><span className="eyebrow">المحرر الأساسي</span><strong>Payload CMS</strong><span className="muted">Gateway يعرض النسخة المنشورة فقط.</span></div>
      <div className="cms-payload-sync-state"><span className={`status-badge ${syncStatus?.active ? "published" : "draft"}`}>{syncStatus?.running || syncing ? "جارٍ العمل" : syncStatus?.active ? "متصل" : "لم تتم المزامنة"}</span>{syncStatus?.active && <small dir="ltr">{syncStatus.active.counts.proceduresPublished} إجراءات · {syncStatus.active.counts.documentsPublished} وثائق</small>}</div>
      <button type="button" className="accent" onClick={() => void syncPayload()} disabled={syncing || syncStatus?.running || syncStatus?.configured === false}>{syncing || syncStatus?.running ? "جارٍ النشر..." : "مزامنة Payload"}</button>
    </section>
    <div className="superadmin-kpis">{statuses.map((value) => <div className="superadmin-kpi card" key={value}><span className="eyebrow">{labels[value]}</span><strong>{counts[value] ?? 0}</strong></div>)}</div>
    <div className="superadmin-shortcuts"><input aria-label="بحث في الإجراءات" placeholder="بحث..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><select aria-label="تصفية حسب الحالة" value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}><option value="">كل الحالات</option>{statuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></div>
    {error && <p role="alert" className="error-text">{error}</p>}
    {notice && <output className="cms-sync-notice">{notice}</output>}
    {content}
    <div className="superadmin-shortcuts"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>التالي</button></div>
  </section>;
}