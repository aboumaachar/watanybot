import { useEffect, useRef, useState } from "react";
import { AdminFluentIcon } from "../components/AdminFluentIcon";
import { BulkMutationToolbar, type BulkMutation } from "../components/BulkMutationToolbar";
import { useRowSelection } from "../hooks/useRowSelection";
import {
  addCmsGenericRelationship,
  createCmsGenericEntity,
  deleteCmsGenericRelationship,
  getAdminErrorMessage,
  getCmsFormPublicUrl,
  getCmsGenericAudit,
  getCmsGenericEntities,
  getCmsGenericEntity,
  getCmsGenericVersions,
  rollbackCmsGenericEntity,
  runCmsGenericAction,
  runCmsGenericBulkArchive,
  runCmsGenericBulkEdit,
  updateCmsGenericEntity,
  type CmsAuditEvent,
  type CmsFormItem,
  type CmsGenericItem,
  type CmsGenericPatch,
  type CmsRelationship,
  type CmsGenericWrite,
  type CmsEntityVersion,
  type CmsStatus,
  type ManagedCmsDomain,
} from "../lib/api";

type CmsWorkspaceDomain = "procedures" | "documents" | "editorial-documents" | ManagedCmsDomain;

type CmsManagedContentPageProps = Readonly<{
  domain: ManagedCmsDomain;
  onDomainChange: (domain: CmsWorkspaceDomain) => void;
}>;

type EditorState = {
  publicId: string;
  title: string;
  publicCode: string;
  sourceId: string;
  locale: string;
  status: CmsStatus;
  payloadText: string;
  sourceMetaText: string;
};

type RelationshipForm = {
  relationType: string;
  targetDomain: string;
  targetPublicId: string;
};

const PAGE_SIZE = 20;
const STATUSES: CmsStatus[] = ["DRAFT", "REVIEW_READY", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];
const STATUS_LABELS: Record<CmsStatus, string> = {
  DRAFT: "مسودة",
  REVIEW_READY: "جاهز للمراجعة",
  PUBLISHED: "منشور",
  UNPUBLISHED: "غير منشور",
  ARCHIVED: "مؤرشف",
};

const DOMAIN_COPY: Record<ManagedCmsDomain, { label: string; title: string; icon: string }> = {
  forms: { label: "النماذج", title: "إدارة النماذج", icon: "form" },
  announcements: { label: "التعاميم", title: "إدارة التعاميم", icon: "news" },
};

function emptyEditor(): EditorState {
  return {
    publicId: "",
    title: "",
    publicCode: "",
    sourceId: "",
    locale: "ar",
    status: "DRAFT",
    payloadText: "{}",
    sourceMetaText: "{}",
  };
}

function jsonText(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function editorFromItem(item: CmsGenericItem): EditorState {
  return {
    publicId: item.publicId,
    title: item.title,
    publicCode: item.publicCode || "",
    sourceId: item.sourceId || "",
    locale: stringValue(item.record.locale, "ar"),
    status: item.status,
    payloadText: jsonText(item.payload),
    sourceMetaText: jsonText(item.sourceMeta),
  };
}

function parseJsonObject(value: string, field: string): Record<string, unknown> {
  if (!value.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${field} يجب أن يكون JSON صالحاً.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${field} يجب أن يكون كائناً.`);
  }
  return parsed as Record<string, unknown>;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "غير متاح";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-LB");
}

function itemSummary(item: CmsGenericItem): string {
  return `${item.publicId} · v${item.version} · ${formatDateTime(item.updatedAt)}`;
}

function toWritePayload(editor: EditorState): CmsGenericWrite {
  const publicId = editor.publicId.trim();
  const title = editor.title.trim();
  if (!publicId) throw new Error("المعرف العام مطلوب.");
  if (!title) throw new Error("العنوان مطلوب.");
  return {
    publicId,
    title,
    publicCode: editor.publicCode.trim() || null,
    sourceId: editor.sourceId.trim() || null,
    locale: editor.locale.trim() || null,
    status: editor.status,
    payload: parseJsonObject(editor.payloadText, "البيانات"),
    sourceMeta: parseJsonObject(editor.sourceMetaText, "بيانات المصدر"),
  };
}

function isTransitionAction(action: "publish" | "unpublish" | "archive" | "restore"): boolean {
  return action === "publish" || action === "unpublish" || action === "archive" || action === "restore";
}

export default function CmsManagedContentPage({ domain, onDomainChange }: CmsManagedContentPageProps) {
  const copy = DOMAIN_COPY[domain];
  const [items, setItems] = useState<CmsGenericItem[]>([]);
  const [selected, setSelected] = useState<CmsGenericItem | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [versions, setVersions] = useState<CmsEntityVersion[]>([]);
  const [audit, setAudit] = useState<CmsAuditEvent[]>([]);
  const [relationshipForm, setRelationshipForm] = useState<RelationshipForm>({ relationType: "related", targetDomain: "", targetPublicId: "" });
  const [bulkTitle, setBulkTitle] = useState("");
  const [bulkPayloadText, setBulkPayloadText] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CmsStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Partial<Record<CmsStatus, number>>>({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [relationshipBusy, setRelationshipBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [historyTab, setHistoryTab] = useState<"versions" | "audit">("versions");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const detailRequestRef = useRef(0);
  const selection = useRowSelection(items.map((item) => item.id));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getCmsGenericEntities(domain, { q: query, status: status || undefined, page, pageSize: PAGE_SIZE })
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setTotal(response.total);
        setStatusCounts(response.statusCounts);
        setError("");
      })
      .catch((reason: unknown) => {
        if (active) setError(getAdminErrorMessage(reason, "تعذر تحميل محتوى CMS."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [domain, page, query, refreshToken, status]);

  useEffect(() => {
    detailRequestRef.current += 1;
    setSelected(null);
    setEditor(emptyEditor());
    setVersions([]);
    setAudit([]);
    setCreating(false);
    setDirty(false);
    selection.clear();
  }, [domain]);

  async function loadDetail(id: string): Promise<void> {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailLoading(true);
    try {
      const [detail, nextVersions, nextAudit] = await Promise.all([
        getCmsGenericEntity(domain, id),
        getCmsGenericVersions(domain, id),
        getCmsGenericAudit(domain, id),
      ]);
      if (requestId !== detailRequestRef.current) return;
      setSelected(detail);
      setEditor(editorFromItem(detail));
      setVersions(nextVersions);
      setAudit(nextAudit);
      setDirty(false);
    } catch (reason: unknown) {
      if (requestId === detailRequestRef.current) setError(getAdminErrorMessage(reason, "تعذر تحميل تفاصيل المحتوى."));
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }

  function navigateTo(nextDomain: CmsWorkspaceDomain) {
    if (nextDomain === domain) return;
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد المتابعة؟")) return;
    onDomainChange(nextDomain);
  }

  function chooseItem(item: CmsGenericItem) {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد فتح محتوى آخر؟")) return;
    setCreating(false);
    setSelected(item);
    setEditor(editorFromItem(item));
    setVersions([]);
    setAudit([]);
    setNotice("");
    setError("");
    void loadDetail(item.id);
  }

  function beginCreate() {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد إنشاء محتوى جديد؟")) return;
    detailRequestRef.current += 1;
    setSelected(null);
    setEditor(emptyEditor());
    setVersions([]);
    setAudit([]);
    setCreating(true);
    setDirty(false);
    setNotice("");
    setError("");
  }

  function updateEditor(field: keyof EditorState, value: string) {
    setEditor((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setNotice("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = toWritePayload(editor);
      const patch: CmsGenericPatch = {
        title: payload.title,
        publicCode: payload.publicCode,
        sourceId: payload.sourceId,
        locale: payload.locale,
        status: payload.status,
        payload: payload.payload,
        sourceMeta: payload.sourceMeta,
      };
      const saved = creating
        ? await createCmsGenericEntity(domain, payload)
        : selected
          ? await updateCmsGenericEntity(domain, selected.id, patch)
          : null;
      if (!saved) throw new Error("لم يتم تحديد محتوى للحفظ.");
      setCreating(false);
      setDirty(false);
      setNotice("تم حفظ المحتوى.");
      await loadDetail(saved.id);
      setRefreshToken((value) => value + 1);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, reason instanceof Error ? reason.message : "تعذر حفظ المحتوى."));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: "publish" | "unpublish" | "archive" | "restore") {
    if (!selected || !isTransitionAction(action)) return;
    if (action === "archive" && !globalThis.confirm("هل تريد أرشفة هذا المحتوى؟")) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await runCmsGenericAction(domain, selected.id, action);
      setNotice(action === "restore" ? "تمت استعادة المحتوى." : "تم تحديث دورة حياة المحتوى.");
      setDirty(false);
      await loadDetail(updated.id);
      setRefreshToken((value) => value + 1);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تنفيذ دورة حياة المحتوى."));
    } finally {
      setSaving(false);
    }
  }

  async function rollback(version: CmsEntityVersion) {
    if (!selected || !globalThis.confirm(`استعادة الإصدار ${version.version} ستنشئ نسخة جديدة من المحتوى الحالي. هل تريد المتابعة؟`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await rollbackCmsGenericEntity(domain, selected.id, version.id);
      setNotice(`تمت استعادة الإصدار ${version.version}.`);
      await loadDetail(updated.id);
      setRefreshToken((value) => value + 1);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر استعادة الإصدار."));
    } finally {
      setSaving(false);
    }
  }

  async function dispatchBulk(mutation: BulkMutation, ids: readonly string[]) {
    if (mutation === "bulk_delete") throw new Error("الحذف غير متاح لهذا السطح.");
    if (mutation === "bulk_archive") {
      const updated = await runCmsGenericBulkArchive(domain, ids);
      setItems((current) => current.map((item) => updated.find((next) => next.id === item.id) || item));
      setNotice(`تمت أرشفة ${updated.length} عناصر.`);
      selection.clear();
      setRefreshToken((value) => value + 1);
      return;
    }
    if (domain !== "announcements") throw new Error("التعديل الجماعي متاح للتعاميم فقط.");
    const patch: CmsGenericPatch = {};
    if (bulkTitle.trim()) patch.title = bulkTitle.trim();
    if (bulkPayloadText.trim()) patch.payload = parseJsonObject(bulkPayloadText, "بيانات التعديل الجماعي");
    if (Object.keys(patch).length === 0) throw new Error("أدخل عنواناً أو بيانات لتطبيق التعديل الجماعي.");
    const updated = await runCmsGenericBulkEdit(domain, ids, patch);
    setItems((current) => current.map((item) => updated.find((next) => next.id === item.id) || item));
    setNotice(`تم تعديل ${updated.length} عناصر.`);
    selection.clear();
    setRefreshToken((value) => value + 1);
    if (selected && ids.includes(selected.id)) await loadDetail(selected.id);
  }

  async function addRelationship() {
    if (!selected) return;
    if (!relationshipForm.relationType.trim() || !relationshipForm.targetDomain.trim() || !relationshipForm.targetPublicId.trim()) {
      setError("نوع العلاقة ونطاق الهدف ومعرف الهدف مطلوبة.");
      return;
    }
    setRelationshipBusy(true);
    setError("");
    setNotice("");
    try {
      await addCmsGenericRelationship(domain, selected.id, {
        relationType: relationshipForm.relationType.trim(),
        targetDomain: relationshipForm.targetDomain.trim(),
        targetPublicId: relationshipForm.targetPublicId.trim(),
      });
      setRelationshipForm((current) => ({ ...current, targetPublicId: "" }));
      setNotice("تمت إضافة العلاقة.");
      await loadDetail(selected.id);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر إضافة العلاقة."));
    } finally {
      setRelationshipBusy(false);
    }
  }

  async function removeRelationship(relationship: CmsRelationship) {
    if (!selected || !globalThis.confirm("هل تريد حذف هذه العلاقة؟")) return;
    setRelationshipBusy(true);
    setError("");
    setNotice("");
    try {
      await deleteCmsGenericRelationship(domain, selected.id, relationship);
      setNotice("تم حذف العلاقة.");
      await loadDetail(selected.id);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر حذف العلاقة."));
    } finally {
      setRelationshipBusy(false);
    }
  }

  function openFormPreview() {
    if (!selected || domain !== "forms") return;
    globalThis.open(getCmsFormPublicUrl(selected as CmsFormItem), "_blank", "noopener,noreferrer");
  }

  function downloadForm() {
    if (!selected || domain !== "forms") return;
    const link = document.createElement("a");
    link.href = getCmsFormPublicUrl(selected as CmsFormItem);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.download = selected.publicCode || selected.publicId || "form";
    link.click();
  }

  const selectedRelationships = selected?.relationships || [];
  const canPublish = selected && ["DRAFT", "REVIEW_READY", "UNPUBLISHED"].includes(selected.status);
  const canUnpublish = selected?.status === "PUBLISHED";
  const canArchive = selected && selected.status !== "ARCHIVED";
  const canRestore = selected?.status === "ARCHIVED";

  return (
    <section className="cms-managed-page" dir="rtl">
      <header className="cms-managed-header">
        <div>
          <span className="eyebrow">CMS Core / Gateway-owned</span>
          <h2>{copy.title}</h2>
          <p className="muted">إدارة المحتوى المحفوظ في Gateway مع سجل إصدارات وتدقيق قابل للمراجعة.</p>
        </div>
        <button type="button" className="accent" onClick={beginCreate}><AdminFluentIcon name="add" /> عنصر جديد</button>
      </header>

      <div className="cms-managed-tabs" role="tablist" aria-label="أقسام CMS">
        <button type="button" className="ghost" onClick={() => navigateTo("procedures")}><AdminFluentIcon name="document" /> الإجراءات · Payload</button>
        <button type="button" className="ghost" onClick={() => navigateTo("documents")}><AdminFluentIcon name="folder" /> الوثائق التشغيلية</button>
        <button type="button" className="ghost" onClick={() => navigateTo("editorial-documents")}><AdminFluentIcon name="document" /> وثائق Payload</button>
        <button type="button" className={domain === "forms" ? "accent" : "ghost"} onClick={() => navigateTo("forms")}><AdminFluentIcon name="form" /> النماذج</button>
        <button type="button" className={domain === "announcements" ? "accent" : "ghost"} onClick={() => navigateTo("announcements")}><AdminFluentIcon name="news" /> التعاميم</button>
      </div>

      <div className="cms-managed-metrics" aria-label="حالات المحتوى">
        {STATUSES.map((value) => <div className="cms-managed-metric" key={value}><span>{STATUS_LABELS[value]}</span><strong>{statusCounts[value] ?? 0}</strong></div>)}
        <div className="cms-managed-metric cms-managed-metric-total"><span>إجمالي النتائج</span><strong>{total}</strong></div>
      </div>

      <div className="cms-managed-toolbar" role="search">
        <label className="cms-managed-search"><span>بحث في المعرف أو العنوان أو المصدر</span><div className="cms-input-with-icon"><AdminFluentIcon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ابحث في المحتوى" /></div></label>
        <label><span>الحالة</span><select value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}><option value="">كل الحالات</option>{STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
        <button type="button" className="ghost cms-managed-refresh" onClick={() => setRefreshToken((value) => value + 1)} disabled={loading} aria-label="تحديث القائمة" title="تحديث القائمة"><AdminFluentIcon name="refresh" /></button>
      </div>

      {error && <div className="cms-document-alert" role="alert">{error}</div>}
      {notice && <output className="cms-document-notice">{notice}</output>}

      {domain === "announcements" && selection.selectedVisibleIds.length > 0 && <div className="cms-managed-bulk-editor">
        <div><strong>تعديل جماعي للتعاميم</strong><span>اترك الحقل فارغاً للحفاظ على قيمته الحالية.</span></div>
        <label><span>عنوان مشترك</span><input value={bulkTitle} onChange={(event) => setBulkTitle(event.target.value)} placeholder="اختياري" /></label>
        <label><span>بيانات JSON مشتركة</span><textarea dir="ltr" value={bulkPayloadText} onChange={(event) => setBulkPayloadText(event.target.value)} placeholder={'{"summary":"..."}'} /></label>
      </div>}

      <div className="cms-managed-workspace">
        <div className="cms-managed-list-panel">
          <div className="cms-document-panel-heading"><div><strong>{copy.label}</strong><small>{total} نتيجة</small></div><label className="cms-managed-select-all"><input type="checkbox" checked={selection.allVisibleSelected} onChange={selection.toggleAll} aria-label="اختيار كل النتائج" /> اختيار الصفحة</label></div>
          {selection.selectedVisibleIds.length > 0 && <BulkMutationToolbar selectedIds={selection.selectedVisibleIds} capabilities={{ bulk_archive: "SUPPORTED", bulk_delete: "MISSING", bulk_edit: domain === "announcements" ? "SUPPORTED" : "MISSING" }} dispatch={dispatchBulk} editLabel="تعديل المحدد" />}
          {loading && <div className="cms-document-state"><AdminFluentIcon name="clock" /> جار التحميل...</div>}
          {!loading && items.length === 0 && <div className="cms-document-state"><AdminFluentIcon name={copy.icon} /><strong>لا توجد نتائج</strong><span>غيّر المرشحات أو أنشئ عنصراً جديداً.</span></div>}
          {!loading && items.length > 0 && <div className="cms-managed-list">{items.map((item) => <div className={`cms-managed-row${selected?.id === item.id ? " selected" : ""}`} key={item.id}>
            <input type="checkbox" checked={selection.selectedVisibleIds.includes(item.id)} onChange={() => selection.toggle(item.id)} aria-label={`اختيار ${item.publicId}`} />
            <button type="button" className="cms-managed-row-button" onClick={() => chooseItem(item)}>
              <span className="cms-document-row-icon"><AdminFluentIcon name={copy.icon} /></span>
              <span className="cms-document-row-copy"><strong>{item.title}</strong><small dir="ltr">{itemSummary(item)}</small><span className="cms-document-tags"><em>{item.publicCode || "بدون رمز"}</em>{item.sourceId && <em>{item.sourceId}</em>}</span></span>
              <span className={`status-badge ${item.status.toLowerCase()}`}>{STATUS_LABELS[item.status]}</span>
            </button>
          </div>)}</div>}
          <div className="cms-document-pagination"><button type="button" className="ghost" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" className="ghost" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>التالي</button></div>
        </div>

        <div className="cms-managed-detail-panel">
          {!selected && !creating && <div className="cms-document-state cms-document-editor-empty"><AdminFluentIcon name="edit" /><strong>اختر عنصراً لمراجعته</strong><span>حدّد عنصراً من القائمة لفتح التفاصيل والتحرير وسجل الحوكمة.</span></div>}
          {(selected || creating) && <>
            <div className="cms-document-panel-heading"><div><span className="eyebrow">{creating ? "إنشاء" : "تفاصيل العنصر"}</span><h3>{creating ? `عنصر جديد في ${copy.label}` : selected?.title}</h3></div>{dirty && <span className="cms-document-dirty">تغييرات غير محفوظة</span>}</div>
            {detailLoading && !creating && <div className="cms-managed-detail-loading"><AdminFluentIcon name="clock" /> جار تحميل سجل العنصر...</div>}
            <div className="cms-managed-form">
              <div className="cms-managed-form-grid">
                <label><span>المعرف العام</span><input dir="ltr" value={editor.publicId} onChange={(event) => updateEditor("publicId", event.target.value)} disabled={!creating} /></label>
                <label><span>العنوان</span><input value={editor.title} onChange={(event) => updateEditor("title", event.target.value)} /></label>
                <label><span>الرمز العام</span><input dir="ltr" value={editor.publicCode} onChange={(event) => updateEditor("publicCode", event.target.value)} placeholder="اختياري" /></label>
                <label><span>معرف المصدر</span><input dir="ltr" value={editor.sourceId} onChange={(event) => updateEditor("sourceId", event.target.value)} placeholder="اختياري" /></label>
                <label><span>اللغة</span><input dir="ltr" value={editor.locale} onChange={(event) => updateEditor("locale", event.target.value)} /></label>
                <label><span>الحالة</span><select value={editor.status} onChange={(event) => updateEditor("status", event.target.value as CmsStatus)}>{STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
              </div>
              <label><span>البيانات</span><textarea className="cms-managed-json" dir="ltr" value={editor.payloadText} onChange={(event) => updateEditor("payloadText", event.target.value)} spellCheck={false} /></label>
              <label><span>بيانات المصدر</span><textarea className="cms-managed-json" dir="ltr" value={editor.sourceMetaText} onChange={(event) => updateEditor("sourceMetaText", event.target.value)} spellCheck={false} /></label>
            </div>
            <div className="cms-document-contract-note"><AdminFluentIcon name="shield" /><span>هذا السطح يكتب إلى Gateway فقط. إجراءات Payload ووثائق Payload تبقى للقراءة فقط عبر محررها الأساسي.</span></div>
            <div className="cms-document-actions">
              <button type="button" className="accent" onClick={() => void save()} disabled={saving}><AdminFluentIcon name="check" /> {saving ? "جار الحفظ..." : "حفظ"}</button>
              {selected && <>
                {domain === "forms" && <><button type="button" className="ghost" onClick={openFormPreview} disabled={saving}><AdminFluentIcon name="document" /> معاينة</button><button type="button" className="ghost" onClick={downloadForm} disabled={saving}><AdminFluentIcon name="download" /> تنزيل</button></>}
                {canPublish && <button type="button" className="ghost" onClick={() => void runAction("publish")} disabled={saving}><AdminFluentIcon name="check" /> نشر</button>}
                {canUnpublish && <button type="button" className="ghost" onClick={() => void runAction("unpublish")} disabled={saving}><AdminFluentIcon name="refresh" /> إلغاء النشر</button>}
                {canArchive && <button type="button" className="ghost danger" onClick={() => void runAction("archive")} disabled={saving}><AdminFluentIcon name="folder" /> أرشفة</button>}
                {canRestore && <button type="button" className="ghost" onClick={() => void runAction("restore")} disabled={saving}><AdminFluentIcon name="refresh" /> استعادة</button>}
              </>}
            </div>

            {selected && <>
              <section className="cms-managed-subsection">
                <div className="cms-document-panel-heading"><div><span className="eyebrow">Relationships</span><h3>العلاقات</h3></div><span className="muted">{selectedRelationships.length} علاقة</span></div>
                <div className="cms-managed-relationship-form"><label><span>النوع</span><input value={relationshipForm.relationType} onChange={(event) => setRelationshipForm((current) => ({ ...current, relationType: event.target.value }))} /></label><label><span>نطاق الهدف</span><input dir="ltr" value={relationshipForm.targetDomain} onChange={(event) => setRelationshipForm((current) => ({ ...current, targetDomain: event.target.value }))} placeholder="documents" /></label><label><span>معرف الهدف</span><input dir="ltr" value={relationshipForm.targetPublicId} onChange={(event) => setRelationshipForm((current) => ({ ...current, targetPublicId: event.target.value }))} /></label><button type="button" className="ghost" onClick={() => void addRelationship()} disabled={relationshipBusy}><AdminFluentIcon name="add" /> إضافة</button></div>
                {selectedRelationships.length === 0 ? <p className="muted">لا توجد علاقات مسجلة.</p> : <div className="cms-managed-relationship-list">{selectedRelationships.map((relationship) => <div className="cms-managed-relationship" key={`${relationship.relationType}:${relationship.targetDomain}:${relationship.targetPublicId}`}><span><strong>{relationship.relationType}</strong><small dir="ltr">{relationship.targetDomain} / {relationship.targetPublicId}</small></span><button type="button" className="ghost sm danger" onClick={() => void removeRelationship(relationship)} disabled={relationshipBusy} aria-label={`حذف العلاقة ${relationship.targetPublicId}`} title="حذف العلاقة"><AdminFluentIcon name="delete" /></button></div>)}</div>}
              </section>

              <section className="cms-managed-subsection">
                <div className="cms-managed-history-heading"><div><span className="eyebrow">Authority trail</span><h3>الإصدارات والتدقيق</h3></div><div className="cms-managed-history-tabs" role="tablist"><button type="button" className={historyTab === "versions" ? "active" : ""} onClick={() => setHistoryTab("versions")}>الإصدارات ({versions.length})</button><button type="button" className={historyTab === "audit" ? "active" : ""} onClick={() => setHistoryTab("audit")}>التدقيق ({audit.length})</button></div></div>
                {historyTab === "versions" && <div className="cms-managed-history-list">{versions.length === 0 ? <p className="muted">لا توجد إصدارات بعد.</p> : versions.map((version) => <div className="cms-managed-history-row" key={version.id}><span><strong>الإصدار {version.version}</strong><small>{version.reason || "تغيير"} · {version.createdBy} · {formatDateTime(version.createdAt)}</small></span><button type="button" className="ghost sm" onClick={() => void rollback(version)} disabled={saving}>استعادة</button></div>)}</div>}
                {historyTab === "audit" && <div className="cms-managed-history-list">{audit.length === 0 ? <p className="muted">لا توجد أحداث تدقيق بعد.</p> : audit.map((event) => <div className="cms-managed-history-row" key={event.id}><span><strong dir="ltr">{event.eventType}</strong><small>{event.actorId} · {formatDateTime(event.createdAt)}{event.reason ? ` · ${event.reason}` : ""}</small></span><span className="cms-managed-audit-hash" dir="ltr">{event.immutableHash?.slice(0, 12) || ""}</span></div>)}</div>}
              </section>
            </>}
          </>}
        </div>
      </div>
    </section>
  );
}