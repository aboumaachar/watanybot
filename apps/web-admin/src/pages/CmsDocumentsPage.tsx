import { useEffect, useMemo, useState } from "react";
import {
  createCmsDocument,
  getAdminErrorMessage,
  getCmsDocument,
  getCmsDocuments,
  runCmsDocumentAction,
  updateCmsDocument,
  type CmsDocumentItem,
  type CmsDocumentKind,
  type CmsDocumentRecord,
  type CmsDocumentStorageStatus,
  type CmsStatus,
} from "../lib/api";
import { AdminFluentIcon } from "../components/AdminFluentIcon";

type EditorState = {
  name: string;
  kind: CmsDocumentKind;
  tags: string;
  file_path: string;
};

const KINDS: CmsDocumentKind[] = ["file", "pdf", "doc", "image"];
const STORAGE_STATUSES: CmsDocumentStorageStatus[] = ["pending", "verified", "rejected"];
const CMS_STATUSES: Array<Extract<CmsStatus, "DRAFT" | "PUBLISHED" | "ARCHIVED">> = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const STATUS_LABELS: Record<CmsDocumentStorageStatus, string> = {
  pending: "مسودة",
  verified: "منشور",
  rejected: "مرفوض",
};
const KIND_LABELS: Record<CmsDocumentKind, string> = {
  file: "ملف",
  pdf: "PDF",
  doc: "مستند",
  image: "صورة",
};

function emptyEditor(): EditorState {
  return { name: "", kind: "file", tags: "", file_path: "" };
}

function editorFromDocument(document: CmsDocumentRecord): EditorState {
  return {
    name: document.name,
    kind: document.kind,
    tags: document.tags.join(", "),
    file_path: document.filePath || "",
  };
}

function tagsFromEditor(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-LB");
}

export default function CmsDocumentsPage({ onBack }: Readonly<{ onBack?: () => void }> = {}) {
  const [items, setItems] = useState<CmsDocumentItem[]>([]);
  const [selected, setSelected] = useState<CmsDocumentItem | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CmsDocumentKind | "">("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<CmsStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Partial<Record<CmsStatus, number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<{ supported: boolean; url?: string; reason?: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const response = await getCmsDocuments({ q: query, kind: kind || undefined, tag: tag || undefined, status: status || undefined, page, pageSize });
      setItems(response.items);
      setTotal(response.total);
      setStatusCounts(response.statusCounts);
      if (selected && !response.items.some((item) => item.id === selected.id)) {
        setSelected(null);
        setEditor(emptyEditor());
        setDirty(false);
      }
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل مكتبة الوثائق."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, [query, kind, tag, status, page]);

  useEffect(() => {
    function protectDirtyNavigation(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    globalThis.addEventListener("beforeunload", protectDirtyNavigation);
    return () => globalThis.removeEventListener("beforeunload", protectDirtyNavigation);
  }, [dirty]);

  function chooseDocument(item: CmsDocumentItem) {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد المتابعة؟")) return;
    setSelected(item);
    setEditor(editorFromDocument(item.document));
    setPreview(null);
    setDirty(false);
    setCreating(false);
    setNotice("");
  }

  function beginCreate() {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد إنشاء وثيقة جديدة؟")) return;
    setSelected(null);
    setEditor(emptyEditor());
    setPreview(null);
    setCreating(true);
    setDirty(false);
    setNotice("");
    setError("");
  }

  function goBack() {
    if (!onBack) return;
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد العودة؟")) return;
    onBack();
  }

  function updateEditor(field: keyof EditorState, value: string) {
    setEditor((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setNotice("");
  }

  async function save() {
    if (!editor.name.trim()) {
      setError("اسم الوثيقة مطلوب.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      name: editor.name.trim(),
      kind: editor.kind,
      tags: tagsFromEditor(editor.tags),
      file_path: editor.file_path.trim() || null,
    };
    try {
      const saved = creating
        ? await createCmsDocument(payload)
        : selected
          ? await updateCmsDocument(selected.id, payload)
          : null;
      if (!saved) throw new Error("لم يتم تحديد وثيقة للحفظ.");
      setSelected(saved);
      setEditor(editorFromDocument(saved.document));
      setCreating(false);
      setDirty(false);
      setNotice("تم حفظ الوثيقة.");
      await loadDocuments();
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر حفظ الوثيقة."));
    } finally {
      setSaving(false);
    }
  }

  async function transition(action: "publish" | "unpublish" | "archive") {
    if (!selected) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await runCmsDocumentAction(selected.id, action);
      setSelected(updated);
      setEditor(editorFromDocument(updated.document));
      setDirty(false);
      setNotice("تم تحديث حالة الوثيقة.");
      await loadDocuments();
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحديث حالة الوثيقة."));
    } finally {
      setSaving(false);
    }
  }

  async function showPreview() {
    if (!selected) return;
    try {
      const response = await getCmsDocument(selected.id);
      setPreview(response.preview);
      setError("");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل معاينة الوثيقة."));
    }
  }

  const selectedStatus = selected?.document.status;
  const canPublish = selectedStatus === "pending";
  const canUnpublish = selectedStatus === "verified";
  const canArchive = selectedStatus !== "rejected";
  const resultLabel = useMemo(() => `${total} وثيقة`, [total]);

  return (
    <section className="cms-documents-page" dir="rtl">
      <header className="cms-documents-header">
        <div>
          <span className="eyebrow">CMS / KB Studio</span>
          <h2>مكتبة الوثائق</h2>
          <p className="muted">إدارة الوثائق الحالية المرتبطة بعقد public.documents.</p>
        </div>
        <div className="cms-document-header-actions">
          {onBack && <button type="button" className="ghost" onClick={goBack}>العودة إلى CMS</button>}
          <button type="button" className="accent" onClick={beginCreate}>
            <AdminFluentIcon name="add" /> وثيقة جديدة
          </button>
        </div>
      </header>

      <div className="cms-document-metrics" aria-label="Document library status">
        {CMS_STATUSES.map((value) => (
          <div className="cms-document-metric" key={value}>
            <span>{value === "DRAFT" ? "مسودات" : value === "PUBLISHED" ? "منشورة" : "مرفوضة"}</span>
            <strong>{statusCounts[value] ?? 0}</strong>
          </div>
        ))}
        <div className="cms-document-metric cms-document-metric-total"><span>النتائج</span><strong>{resultLabel}</strong></div>
      </div>

      <div className="cms-document-toolbar" role="search">
        <label className="cms-document-search">
          <span>بحث في الاسم أو النوع أو الوسوم</span>
          <div className="cms-input-with-icon"><AdminFluentIcon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ابحث في الوثائق" /></div>
        </label>
        <label>
          <span>النوع</span>
          <select value={kind} onChange={(event) => { setKind(event.target.value as CmsDocumentKind | ""); setPage(1); }}>
            <option value="">كل الأنواع</option>
            {KINDS.map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
          </select>
        </label>
        <label>
          <span>الحالة</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}>
            <option value="">كل الحالات</option>
            <option value="DRAFT">مسودة</option>
            <option value="PUBLISHED">منشور</option>
            <option value="ARCHIVED">مرفوض</option>
          </select>
        </label>
        <label>
          <span>وسم</span>
          <input value={tag} onChange={(event) => { setTag(event.target.value); setPage(1); }} placeholder="اختياري" />
        </label>
      </div>

      {error && <div className="cms-document-alert" role="alert">{error}</div>}
      {notice && <div className="cms-document-notice" role="status">{notice}</div>}

      <div className="cms-document-workspace">
        <div className="cms-document-list-panel">
          <div className="cms-document-panel-heading"><strong>الوثائق</strong><button type="button" className="ghost" onClick={() => void loadDocuments()} disabled={loading} aria-label="تحديث القائمة" title="تحديث القائمة"><AdminFluentIcon name="refresh" /></button></div>
          {loading && <div className="cms-document-state"><AdminFluentIcon name="clock" /> جار التحميل...</div>}
          {!loading && items.length === 0 && <div className="cms-document-state"><AdminFluentIcon name="document" /><strong>لا توجد وثائق</strong><span>غيّر معايير البحث أو أنشئ وثيقة جديدة.</span></div>}
          {!loading && items.length > 0 && <div className="cms-document-list">{items.map((item) => <button type="button" className={`cms-document-row${selected?.id === item.id ? " selected" : ""}`} key={item.id} onClick={() => chooseDocument(item)}><span className="cms-document-row-icon"><AdminFluentIcon name="document" /></span><span className="cms-document-row-copy"><strong>{item.document.name}</strong><small>{KIND_LABELS[item.document.kind]} · {formatUpdatedAt(item.document.updatedAt)}</small><span className="cms-document-tags">{item.document.tags.slice(0, 3).map((itemTag) => <em key={itemTag}>{itemTag}</em>)}</span></span><span className={`cms-document-status cms-document-status-${item.document.status}`}>{STATUS_LABELS[item.document.status]}</span></button>)}</div>}
          <div className="cms-document-pagination"><button type="button" className="ghost" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" className="ghost" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>التالي</button></div>
        </div>

        <div className="cms-document-editor-panel">
          {!selected && !creating && <div className="cms-document-state cms-document-editor-empty"><AdminFluentIcon name="edit" /><strong>اختر وثيقة لمراجعتها</strong><span>حدّد وثيقة من المكتبة لفتح التفاصيل والتحرير.</span></div>}
          {(selected || creating) && <>
            <div className="cms-document-panel-heading"><div><span className="eyebrow">{creating ? "إنشاء" : "تفاصيل الوثيقة"}</span><h3>{creating ? "وثيقة جديدة" : selected?.document.name}</h3></div>{dirty && <span className="cms-document-dirty">تغييرات غير محفوظة</span>}</div>
            <div className="cms-document-form">
              <label><span>الاسم</span><input value={editor.name} onChange={(event) => updateEditor("name", event.target.value)} /></label>
              <label><span>النوع</span><select value={editor.kind} onChange={(event) => updateEditor("kind", event.target.value)}>{KINDS.map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}</select></label>
              <label><span>الوسوم</span><input value={editor.tags} onChange={(event) => updateEditor("tags", event.target.value)} placeholder="افصل الوسوم بفاصلة" /></label>
              <label><span>مسار الملف</span><input value={editor.file_path} onChange={(event) => updateEditor("file_path", event.target.value)} placeholder="اختياري" /></label>
            </div>
            <div className="cms-document-contract-note"><AdminFluentIcon name="shield" /><span>الحقول المحفوظة: الاسم، النوع، الحالة، الوسوم، مسار الملف. الحقول الإضافية مؤجلة إلى بوابة الترحيل.</span></div>
            <div className="cms-document-actions"><button type="button" className="accent" onClick={() => void save()} disabled={saving}>{saving ? "جار الحفظ..." : "حفظ"}</button>{selected && <><button type="button" className="ghost" onClick={() => void showPreview()} disabled={saving}><AdminFluentIcon name="document" /> معاينة</button>{canPublish && <button type="button" className="ghost" onClick={() => void transition("publish")} disabled={saving}>نشر</button>}{canUnpublish && <button type="button" className="ghost" onClick={() => void transition("unpublish")} disabled={saving}>إلغاء النشر</button>}{canArchive && <button type="button" className="ghost danger" onClick={() => void transition("archive")} disabled={saving}>رفض</button>}</>}</div>
            {preview && <div className="cms-document-preview" role="status">{preview.supported && preview.url ? <a href={preview.url} target="_blank" rel="noreferrer">فتح المعاينة</a> : <span>المعاينة غير متاحة: {preview.reason}</span>}</div>}
          </>}
        </div>
      </div>
    </section>
  );
}
