import { useEffect, useRef, useState } from "react";
import { adminFetch, getAdminAuthorityMe, getAdminErrorMessage } from "../lib/api";

type FaqStatus = "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "UNPUBLISHED";
type FaqPayload = {
  answer?: string;
  category?: string;
  tags?: string[];
  sourceReferences?: string[];
  reviewStatus?: "pending" | "submitted" | "approved" | "rejected";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  latestRank?: number | null;
  trendingRank?: number | null;
};
type FaqRecord = {
  id: string;
  publicId: string;
  title: string;
  status: FaqStatus;
  version: string;
  payload: FaqPayload;
  updatedAt: string;
};
type History = { id: string; version?: number; eventType?: string; actorId?: string; createdAt: string };
type HistoryState = { items: History[]; loading: boolean; error: string };
const emptyHistory = (): HistoryState => ({ items: [], loading: false, error: "" });
const labels: Record<FaqStatus, string> = {
  DRAFT: "مسودة", REVIEW_READY: "بانتظار المراجعة",
  PUBLISHED: "منشور", UNPUBLISHED: "أُلغي نشره",
};
const base = "/api/admin/cms/faqs";

async function json<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown): Promise<T> {
  const response = await adminFetch(path, method === "GET" ? undefined : { method, body: JSON.stringify(body ?? {}) });
  return await response.json() as T;
}
const parseList = (text: string): string[] => text.split(/[\n,،]+/u).map((part) => part.trim()).filter(Boolean);
const empty = () => ({ id: "", question: "", answer: "", category: "", tags: "", sources: "" });

export default function FaqEditorialAdminPage() {
  const [records, setRecords] = useState<FaqRecord[]>([]);
  const [selected, setSelected] = useState<FaqRecord | null>(null);
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [historyPermissions, setHistoryPermissions] = useState({ versions: false, audit: false });
  const [detailLoading, setDetailLoading] = useState(false);
  const [authorityError, setAuthorityError] = useState("");
  const selectionRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [latestRank, setLatestRank] = useState("");
  const [trendingRank, setTrendingRank] = useState("");
  const [versions, setVersions] = useState<HistoryState>(emptyHistory);
  const [audit, setAudit] = useState<HistoryState>(emptyHistory);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => () => { selectionRequest.current += 1; }, []);

  useEffect(() => {
    let active = true;
    void getAdminAuthorityMe().then((profile) => {
      if (active) {
        setAllowed(profile.isSuperadmin);
        setHistoryPermissions({ versions: profile.permissions.includes("cms.version.read"), audit: profile.permissions.includes("cms.audit.read") });
      }
    }).catch(() => {
      if (active) {
        setAllowed(false);
        setHistoryPermissions({ versions: false, audit: false });
        setAuthorityError("تعذّر التحقق من صلاحيات السجل. يمكنك قراءة تفاصيل السؤال إذا كانت لديك صلاحية الاطلاع.");
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = new URLSearchParams({ q: query, pageSize: "100" });
    void json<{ items: FaqRecord[] }>(`${base}?${qs.toString()}`).then((data) => {
      if (active) setRecords(data.items ?? []);
    }).catch((cause: unknown) => {
      if (active) setError(getAdminErrorMessage(cause, "تعذر تحميل الأسئلة."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, refresh]);

  useEffect(() => {
    let active = true;
    const requestId = selectionRequest.current;
    const current = () => active && requestId === selectionRequest.current;
    setVersions({ items: [], loading: !!selected && historyPermissions.versions, error: "" });
    setAudit({ items: [], loading: !!selected && historyPermissions.audit, error: "" });
    if (selected) {
      const path = `${base}/${encodeURIComponent(selected.id)}`;
      if (historyPermissions.versions) {
        void json<{ versions: History[] }>(`${path}/versions`).then((data) => {
          if (current()) setVersions({ items: data.versions || [], loading: false, error: "" });
        }).catch((cause: unknown) => {
          if (current()) setVersions({ items: [], loading: false, error: getAdminErrorMessage(cause, "تعذر قراءة سجل الإصدارات.") });
        });
      }
      if (historyPermissions.audit) {
        void json<{ events: History[] }>(`${path}/audit`).then((data) => {
          if (current()) setAudit({ items: data.events || [], loading: false, error: "" });
        }).catch((cause: unknown) => {
          if (current()) setAudit({ items: [], loading: false, error: getAdminErrorMessage(cause, "تعذر قراءة سجل التدقيق.") });
        });
      }
    }
    return () => { active = false; };
  }, [selected, historyPermissions.versions, historyPermissions.audit]);

  async function choose(item: FaqRecord) {
    const requestId = ++selectionRequest.current;
    setError(""); setDetailLoading(true);
    setSelected(null); setForm(empty()); setVersions(emptyHistory()); setAudit(emptyHistory());
    setLatestRank(""); setTrendingRank(""); setReason("");
    try {
      const detail = await json<{ item: FaqRecord }>(`${base}/${encodeURIComponent(item.id)}`);
      if (requestId !== selectionRequest.current) return;
      const entry = detail.item;
      if (!entry) throw new Error("FAQ detail response is missing");
      setSelected(entry);
      setForm({
        id: entry.id, question: entry.title,
        answer: entry.payload.answer || "", category: entry.payload.category || "",
        tags: (entry.payload.tags || []).join("، "),
        sources: (entry.payload.sourceReferences || []).join("\n"),
      });
      setLatestRank(entry.payload.latestRank?.toString() || "");
      setTrendingRank(entry.payload.trendingRank?.toString() || "");
    } catch (cause) {
      if (requestId === selectionRequest.current) setError(getAdminErrorMessage(cause, "تعذر قراءة تفاصيل السؤال."));
    } finally {
      if (requestId === selectionRequest.current) setDetailLoading(false);
    }
  }
  function newEntry() {
    selectionRequest.current += 1;
    setSelected(null); setForm(empty()); setVersions(emptyHistory()); setAudit(emptyHistory()); setDetailLoading(false);
    setLatestRank(""); setTrendingRank(""); setReason(""); setNotice(""); setError("");
  }

  async function mutate(action: "create" | "save" | "submit-review" | "approve" | "reject" | "publish" | "unpublish" | "reopen" | "rank") {
    if (!allowed || busy || detailLoading) return;
    setBusy(true); setError(""); setNotice("");
    try {
      let payload: unknown;
      let path = base;
      let method: "POST" | "PATCH" = "POST";
      const id = selected?.id;
      const expectedVersion = Number(selected?.version);
      const fields = {
        answer: form.answer.trim(), category: form.category.trim(),
        tags: parseList(form.tags), sourceReferences: parseList(form.sources),
      };
      if (action === "create") {
        payload = { publicId: form.id.trim(), title: form.question.trim(), payload: fields };
      } else {
        if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) throw new Error("اختر سؤالاً صالحاً.");
        path = `${base}/${encodeURIComponent(id)}`;
        if (action === "save") { method = "PATCH"; payload = { expectedVersion, title: form.question.trim(), payload: fields }; }
        else if (action === "rank") {
          method = "PATCH"; path += "/ranking";
          const rankValue = (value: string) => value.trim() ? Number(value) : null;
          payload = { expectedVersion, latestRank: rankValue(latestRank), trendingRank: rankValue(trendingRank) };
        } else {
          path += `/actions/${action}`;
          payload = action === "reject" ? { expectedVersion, reason: reason.trim() } : { expectedVersion };
        }
      }
      const result = await json<{ item: FaqRecord }>(path, method, payload);
      if (!result.item) throw new Error("لم يُعِد الخادم السؤال المحدّث.");
      setNotice("حُفظ التغيير مع سجل المراجعة والتدقيق.");
      setRefresh((n) => n + 1);
      await choose(result.item);
    } catch (cause) { setError(getAdminErrorMessage(cause, "تعذّر تنفيذ العملية. لم يُؤكّد الخادم نجاحها.")); }
    finally { setBusy(false); }
  }

  const status = selected?.status, review = selected?.payload.reviewStatus;
  return <section dir="rtl" className="superadmin-surface card" aria-label="إدارة الأسئلة الشائعة" data-r025-editor="guarded">
    <h2>إدارة الأسئلة الشائعة والمراجعة</h2>
    <p className="muted">إجابة موثّقة بمراجع إجراءات رسمية، مراجعة بشرية قبل النشر، وإظهار ترتيب الأحدث والرائج بعد الاعتماد فقط.</p>
    {!allowed && <p className="muted">للمسؤولين صلاحية الاطلاع. تتطلّب الكتابة والموافقة صلاحية مدير النظام.</p>}
    <div className="ops-form-actions">
      <label>بحث الأسئلة <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="عنوان السؤال أو معرّفه" /></label>
      <button type="button" disabled={busy} onClick={newEntry}>سؤال جديد</button>
    </div>
    {error && <p role="alert" className="error-text">{error}</p>}
    {authorityError && <p role="status" className="error-text">{authorityError}</p>}
    {detailLoading && <p role="status">جارٍ تحميل تفاصيل السؤال...</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p>جارٍ التحميل...</p> : <div className="ops-form-actions" aria-label="قائمة الأسئلة">
      {records.map((item) => <button type="button" key={item.id} data-faq-id={item.id} className={selected?.id === item.id ? "accent" : "ghost"}
        disabled={busy}
        onClick={() => void choose(item)}>{item.title} — {labels[item.status]}</button>)}
      {!records.length && <p className="muted">لا توجد أسئلة مطابقة.</p>}
    </div>}
    <fieldset disabled={busy || detailLoading || !allowed}>
      <legend>{selected ? "تحرير السؤال المحدد" : "صياغة مسودة جديدة"}</legend>
      <div className="ops-form-actions">
        <label>المعرّف <input dir="ltr" maxLength={160} value={form.id} disabled={!!selected} onChange={(e) => setForm((s) => ({ ...s, id: e.target.value }))} /></label>
        <label>السؤال <input maxLength={300} value={form.question} disabled={!!selected && status !== "DRAFT"} onChange={(e) => setForm((s) => ({ ...s, question: e.target.value }))} /></label>
      </div>
      <label>الجواب الرسمي <textarea rows={5} maxLength={5000} value={form.answer} disabled={!!selected && status !== "DRAFT"}
        onChange={(e) => setForm((s) => ({ ...s, answer: e.target.value }))} /></label>
      <div className="ops-form-actions">
        <label>التصنيف <input value={form.category} disabled={!!selected && status !== "DRAFT"} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} /></label>
        <label>الوسوم <input value={form.tags} disabled={!!selected && status !== "DRAFT"} onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))} /></label>
        <label>معرّفات الإجراءات المرجعية (معرّف في كل سطر) <textarea rows={3} value={form.sources}
          disabled={!!selected && status !== "DRAFT"} onChange={(e) => setForm((s) => ({ ...s, sources: e.target.value }))} /></label>
      </div>
      <p className="muted">الحالة: {status ? labels[status] : "مسودة جديدة"} · المراجعة: {review || "لم تبدأ"} · النسخة: {selected?.version || "—"}</p>
      <div className="ops-form-actions">
        {!selected && <button type="button" className="accent" onClick={() => void mutate("create")}>إنشاء المسودة</button>}
        {status === "DRAFT" && <>
          <button type="button" onClick={() => void mutate("save")}>حفظ المسودة</button>
          <button type="button" className="accent" onClick={() => void mutate("submit-review")}>إرسال للمراجعة</button>
        </>}
        {status === "REVIEW_READY" && review === "submitted" && <>
          <button type="button" className="accent" onClick={() => void mutate("approve")}>اعتماد المراجعة</button>
          <label>سبب الرفض <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={5}/></label>
          <button type="button" onClick={() => void mutate("reject")}>رفض وإعادة للمسودة</button>
        </>}
        {status === "REVIEW_READY" && review === "approved" &&
          <button type="button" className="accent" onClick={() => void mutate("publish")}>نشر السؤال المعتمد</button>}
        {status === "PUBLISHED" &&
          <button type="button" onClick={() => void mutate("unpublish")}>إلغاء النشر</button>}
        {status === "UNPUBLISHED" &&
          <button type="button" onClick={() => void mutate("reopen")}>إعادة فتح مسودة</button>}
      </div>
      {status === "PUBLISHED" && <div className="ops-form-actions">
        <label>ترتيب الأحدث (1 أولاً) <input type="number" min={1} max={9999} value={latestRank} onChange={(e) => setLatestRank(e.target.value)} /></label>
        <label>ترتيب الرائج (1 أولاً) <input type="number" min={1} max={9999} value={trendingRank} onChange={(e) => setTrendingRank(e.target.value)} /></label>
        <button type="button" onClick={() => void mutate("rank")}>حفظ الترتيب</button>
      </div>}
    </fieldset>
    {selected && (historyPermissions.versions || historyPermissions.audit) && <details><summary>الإصدارات وسجل التدقيق</summary>
      {historyPermissions.versions && <section aria-label="الإصدارات"><h3>الإصدارات</h3>
        {versions.loading ? <p role="status">جارٍ تحميل الإصدارات...</p> : versions.error ? <p role="alert" className="error-text">{versions.error}</p> :
          versions.items.length ? <ul>{versions.items.map((item) => <li key={item.id}>نسخة {item.version} · {item.createdAt}</li>)}</ul> : <p className="muted">لا توجد إصدارات.</p>}
      </section>}
      {historyPermissions.audit && <section aria-label="التدقيق"><h3>التدقيق</h3>
        {audit.loading ? <p role="status">جارٍ تحميل التدقيق...</p> : audit.error ? <p role="alert" className="error-text">{audit.error}</p> :
          audit.items.length ? <ul>{audit.items.map((item) => <li key={item.id}>{item.eventType} · {item.actorId} · {item.createdAt}</li>)}</ul> : <p className="muted">لا توجد أحداث تدقيق.</p>}
      </section>}
    </details>}
  </section>;
}
