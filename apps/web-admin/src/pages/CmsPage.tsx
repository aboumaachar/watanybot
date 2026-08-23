import { useEffect, useState } from "react";
import { getAdminErrorMessage, getCmsAnnouncements, getCmsDocuments, getCmsForms, getCmsProcedures, getCmsFormPublicUrl, runCmsAnnouncementAction, runCmsDocumentAction, runCmsFormAction, runCmsProcedureAction, type CmsFormItem, type CmsItem, type CmsStatus } from "../lib/api";

const statuses: CmsStatus[] = ["DRAFT", "REVIEW_READY", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];
const labels: Record<CmsStatus, string> = { DRAFT: "مسودة", REVIEW_READY: "جاهز للمراجعة", PUBLISHED: "منشور", UNPUBLISHED: "غير منشور", ARCHIVED: "مؤرشف" };

export default function CmsPage() {
  const [domain, setDomain] = useState<"procedures" | "documents" | "forms" | "announcements">("procedures");
  const [items, setItems] = useState<CmsItem[]>([]);
  const [counts, setCounts] = useState<Partial<Record<CmsStatus, number>>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CmsStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = domain === "documents" ? getCmsDocuments : domain === "forms" ? getCmsForms : domain === "announcements" ? getCmsAnnouncements : getCmsProcedures;
    void load({ q: query, status: status || undefined, page, pageSize: 20 })
      .then((data) => { if (active) { setItems(data.items); setCounts(data.statusCounts); setError(null); } })
      .catch((reason: unknown) => { if (active) setError(getAdminErrorMessage(reason, "تعذر تحميل محتوى الإجراءات.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, status, page, domain]);

  async function action(item: CmsItem, next: "publish" | "unpublish" | "archive" | "restore") {
    try {
      const updated = domain === "documents" && next !== "restore"
        ? await runCmsDocumentAction(item.id, next)
        : domain === "forms" ? await runCmsFormAction(item.id, next as "publish" | "unpublish" | "archive") : domain === "announcements" ? await runCmsAnnouncementAction(item.id, next as "publish" | "unpublish" | "archive") : await runCmsProcedureAction(item.id, next);
      setItems((current) => current.map((candidate) => candidate.id === updated.id ? updated as CmsItem : candidate));
    } catch (reason) { setError(getAdminErrorMessage(reason, "تعذر تنفيذ دورة حياة المحتوى.")); }
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
    content = <div className="table-responsive"><table><thead><tr><th>المعرف</th><th>العنوان</th><th>الحالة</th><th>الإصدار</th><th>الإجراء</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.title}</td><td>{labels[item.status]}</td><td>{item.version}</td><td>{domain === "forms" ? <><button type="button" onClick={() => openFormPreview(item)}>معاينة / فتح</button><button type="button" onClick={() => downloadForm(item)}>تنزيل</button></> : null}{item.status === "DRAFT" || item.status === "UNPUBLISHED" ? <button type="button" onClick={() => void action(item, "publish")}>نشر</button> : null}{item.status === "PUBLISHED" ? <button type="button" onClick={() => void action(item, "unpublish")}>إلغاء النشر</button> : null}{item.status !== "ARCHIVED" ? <button type="button" onClick={() => void action(item, "archive")}>أرشفة</button> : <button type="button" onClick={() => void action(item, "restore")}>استعادة</button>}</td></tr>)}</tbody></table></div>;
  }

  return <section className="superadmin-surface card">
    <div className="page-header"><span className="eyebrow">CMS Core / {domain === "documents" ? "Documents" : domain === "forms" ? "Forms" : domain === "announcements" ? "Announcements" : "Procedures"}</span><h2>إدارة {domain === "documents" ? "الوثائق" : domain === "forms" ? "النماذج" : domain === "announcements" ? "التعاميم" : "الإجراءات"}</h2><p className="muted">لوحة فرعية قابلة لإعادة الاستخدام مع دورة حياة وتدقيق مركزيين.</p></div>
    <div className="superadmin-shortcuts"><button type="button" className={domain === "procedures" ? "accent" : "ghost"} onClick={() => { setDomain("procedures"); setPage(1); }}>الإجراءات</button><button type="button" className={domain === "documents" ? "accent" : "ghost"} onClick={() => { setDomain("documents"); setPage(1); }}>الوثائق</button><button type="button" className={domain === "forms" ? "accent" : "ghost"} onClick={() => { setDomain("forms"); setPage(1); }}>النماذج</button><button type="button" className={domain === "announcements" ? "accent" : "ghost"} onClick={() => { setDomain("announcements"); setPage(1); }}>التعاميم</button></div>
    <div className="superadmin-kpis">{statuses.map((value) => <div className="superadmin-kpi card" key={value}><span className="eyebrow">{labels[value]}</span><strong>{counts[value] ?? 0}</strong></div>)}</div>
    <div className="superadmin-shortcuts"><input aria-label="بحث في الإجراءات" placeholder="بحث..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><select aria-label="تصفية حسب الحالة" value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}><option value="">كل الحالات</option>{statuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></div>
    {error && <p role="alert" className="error-text">{error}</p>}
    {content}
    <div className="superadmin-shortcuts"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</button><span>صفحة {page}</span><button type="button" disabled={items.length < 20} onClick={() => setPage((value) => value + 1)}>التالي</button></div>
  </section>;
}