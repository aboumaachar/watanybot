import { useEffect, useState } from "react";
import { getAdminErrorMessage, getCmsEditorialDocuments, type PayloadEditorialDocumentItem, type PayloadSyncStatus } from "../lib/api";
import { AdminFluentIcon } from "../components/AdminFluentIcon";

function recordString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

function recordStringList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string" || typeof item === "number") return String(item).trim();
    if (item && typeof item === "object") return recordString(item as Record<string, unknown>, ["title", "name", "businessIdentifier", "id"]);
    return "";
  }).filter(Boolean);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-LB");
}

export default function CmsEditorialDocumentsPage({ onBack }: Readonly<{ onBack?: () => void }> = {}) {
  const [items, setItems] = useState<PayloadEditorialDocumentItem[]>([]);
  const [selected, setSelected] = useState<PayloadEditorialDocumentItem | null>(null);
  const [sync, setSync] = useState<PayloadSyncStatus | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const response = await getCmsEditorialDocuments({ q: query, page, pageSize: 20 });
      setItems(response.items);
      setTotal(response.total);
      setSync(response.sync);
      if (selected && !response.items.some((item) => item.id === selected.id)) setSelected(null);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل وثائق Payload."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, [query, page]);

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const activeRun = sync?.active;

  return (
    <section className="cms-editorial-documents-page" dir="rtl">
      <header className="cms-documents-header">
        <div>
          <span className="eyebrow">CMS / Payload</span>
          <h2>وثائق Payload التحريرية</h2>
          <p className="muted">عرض للوثائق المنشورة من السجل التحريري، دون أدوات تعديل أو رفع.</p>
        </div>
        <div className="cms-document-header-actions">
          {onBack && <button type="button" className="ghost" onClick={onBack}>العودة إلى CMS</button>}
          <button type="button" className="ghost" onClick={() => void loadDocuments()} disabled={loading} aria-label="تحديث القائمة" title="تحديث القائمة"><AdminFluentIcon name="refresh" /></button>
        </div>
      </header>

      <div className="cms-editorial-document-banner">
        <div><span className="eyebrow">المالك القانوني</span><strong>Payload CMS</strong><span className="muted">هذه الوثائق للقراءة فقط داخل Gateway.</span></div>
        <div className="cms-payload-sync-state"><span className={`status-badge ${activeRun ? "published" : "draft"}`}>{activeRun ? "نسخة منشورة" : "لا توجد نسخة نشطة"}</span>{activeRun && <small dir="ltr">{activeRun.counts.documentsPublished} وثائق · {formatDate(activeRun.activatedAt)}</small>}</div>
      </div>

      <label className="cms-editorial-document-search"><span>بحث في وثائق Payload</span><div className="cms-input-with-icon"><AdminFluentIcon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ابحث في الوثائق" /></div></label>
      {error && <div className="cms-document-alert" role="alert">{error}</div>}

      <div className="cms-editorial-document-workspace">
        <div className="cms-document-list-panel">
          <div className="cms-document-panel-heading"><strong>{total} وثيقة تحريرية</strong></div>
          {loading && <div className="cms-document-state"><AdminFluentIcon name="clock" /> جار التحميل...</div>}
          {!loading && items.length === 0 && <div className="cms-document-state"><AdminFluentIcon name="document" /><strong>لا توجد وثائق منشورة</strong><span>شغّل مزامنة Payload بعد نشر الوثائق في Payload CMS.</span></div>}
          {!loading && items.length > 0 && <div className="cms-document-list">{items.map((item) => { const document = item.document; const title = recordString(document, ["title", "titleAr", "name"]) || item.title; const kind = recordString(document, ["asset_type", "assetType", "documentType", "file_format", "fileFormat"]); return <button type="button" className={`cms-document-row${selected?.id === item.id ? " selected" : ""}`} key={item.id} onClick={() => setSelected(item)}><span className="cms-document-row-icon"><AdminFluentIcon name="document" /></span><span className="cms-document-row-copy"><strong>{title}</strong><small>{kind || "وثيقة"} · {item.id}</small><span className="cms-document-tags">{recordStringList(document, "tags").slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}</span></span><span className="cms-document-status cms-document-status-verified">منشور</span></button>; })}</div>}
          <div className="cms-document-pagination"><button type="button" className="ghost" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" className="ghost" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>التالي</button></div>
        </div>

        <div className="cms-document-editor-panel">
          {!selected && <div className="cms-document-state cms-document-editor-empty"><AdminFluentIcon name="document" /><strong>اختر وثيقة لمراجعة بياناتها</strong><span>المحتوى التحريري يبقى مملوكاً لـ Payload.</span></div>}
          {selected && <div className="cms-editorial-document-detail"><div className="cms-document-panel-heading"><div><span className="eyebrow">Payload / قراءة فقط</span><h3>{selected.title}</h3></div><span className="cms-readonly-badge">لا تعديل</span></div><dl><div><dt>المعرّف القانوني</dt><dd dir="ltr">{selected.id}</dd></div><div><dt>آخر نسخة Gateway</dt><dd>{activeRun ? formatDate(activeRun.activatedAt) : "غير متاحة"}</dd></div><div><dt>الإجراءات المرتبطة</dt><dd dir="ltr">{recordStringList(selected.document, "linked_procedures").join(", ") || "لا توجد"}</dd></div><div><dt>الوسوم</dt><dd>{recordStringList(selected.document, "tags").join("، ") || "لا توجد"}</dd></div></dl></div>}
        </div>
      </div>
    </section>
  );
}