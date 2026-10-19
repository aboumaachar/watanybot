import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "../lib/api";
import { AdminErrorState, AdminLoadingState, AdminNotice, AdminPageHeader, AdminPageSection, AdminStatusBadge } from "../components/admin/AdminPrimitives";

type KBNode = {
  id: number;
  title: string;
  category: string;
  content: string;
  source?: string;
  updated_at?: string;
};
type LiveIndexStats = { records?: number; sources?: number; generatedAt?: string };
type LiveDocument = { id: string; title: string; sourceType: string; excerpt?: string; sourceUrl?: string; tags?: string[]; score?: number };

export default function KBEditorPage() {
  const [nodes, setNodes] = useState<KBNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<KBNode | null>(null);
  const [selectedLive, setSelectedLive] = useState<LiveDocument | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [indexHealthy, setIndexHealthy] = useState<boolean | null>(null);
  const [total, setTotal] = useState(0);
  const [indexStats, setIndexStats] = useState<LiveIndexStats | null>(null);
  const [indexError, setIndexError] = useState("");
  const [liveDocuments, setLiveDocuments] = useState<LiveDocument[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setLiveLoading(true);
    const query = search ? `?q=${encodeURIComponent(search)}` : "";
    const liveQuery = `?limit=20${search ? `&q=${encodeURIComponent(search)}` : ""}`;
    const [editableResult, liveResult] = await Promise.allSettled([
      adminFetch(`/api/admin/kb${query}`).then((response) => response.json()),
      adminFetch(`/api/kb/live-search${liveQuery}`).then((response) => response.json()),
    ]);
    if (editableResult.status === "fulfilled") {
      const body = editableResult.value as { nodes?: KBNode[]; total?: number };
      setNodes(body.nodes ?? []); setTotal(Number(body.total ?? 0));
    } else {
      setNodes([]); setTotal(0);
    }
    if (liveResult.status === "fulfilled") {
      const body = liveResult.value as { documents?: LiveDocument[]; indexStats?: LiveIndexStats };
      setLiveDocuments(body.documents ?? []); setIndexStats(body.indexStats ?? null); setIndexHealthy(true); setIndexError("");
    } else {
      setLiveDocuments([]); setIndexHealthy(false); setIndexError("Live search is unavailable.");
    }
    setLoading(false); setLiveLoading(false);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);
  function selectNode(node: KBNode) {
    setSelected(node); setSelectedLive(null);
    setEditContent(node.content);
  }

  function selectLiveDocument(document: LiveDocument) {
    setSelected(null); setSelectedLive(document);
  }

  async function saveNode() {
    if (!selected) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/kb/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ content: editContent }),
      });
      setNodes((prev) =>
        prev.map((n) => (n.id === selected.id ? { ...n, content: editContent } : n))
      );
      setSelected({ ...selected, content: editContent });
    } catch (err) {
      console.error("Save KB node failed", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ops-page-stack">
      <AdminPageHeader title="قاعدة المعرفة" description="فهرس البحث الديناميكي في Gateway هو مصدر المعرفة النشط. تظهر السجلات القابلة للتحرير عندما يوفّرها مالك التحرير." actions={<button className="ghost" type="button" onClick={() => void load()}>تحديث</button>} />
      <AdminPageSection title="حالة الفهرس" description="المعلومات التشغيلية مصدرها واجهة البحث المباشر في Gateway."><div className="admin-stat-grid"><div className="admin-stat-card"><span className="admin-stat-label">فهرس البحث</span><strong>{indexError ? "غير متاح" : indexStats ? "يعمل" : "جارٍ التحقق..."}</strong><span className="admin-stat-detail">{indexStats?.generatedAt ? `آخر تحديث ${new Date(indexStats.generatedAt).toLocaleString("ar-LB")}` : indexError || "بانتظار استجابة Gateway"}</span></div><div className="admin-stat-card"><span className="admin-stat-label">السجلات المفهرسة</span><strong>{indexStats?.records ?? "غير متاح"}</strong><span className="admin-stat-detail">الفهرس الديناميكي المباشر</span></div><div className="admin-stat-card"><span className="admin-stat-label">المصادر</span><strong>{indexStats?.sources ?? "غير متاح"}</strong><span className="admin-stat-detail">مجموعات المصادر المعتمدة</span></div><div className="admin-stat-card"><span className="admin-stat-label">العقد القابلة للتحرير</span><strong>{total}</strong><span className="admin-stat-detail">مالك التحرير في لوحة الإدارة</span></div></div>{indexError ? <AdminErrorState message={indexError} /> : <AdminNotice tone="info">ملكية التحرير واضحة: حرّر فقط السجلات التي تعيدها واجهة التحرير؛ أما بقية نتائج الفهرس فهي للقراءة فقط.</AdminNotice>}</AdminPageSection>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search KB by title or content…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button className="ghost" onClick={load}>
          تحديث
        </button>
      </div>

      <div className="kb-editor-layout">
        {/* Node list */}
        <div className="kb-node-list">
          {loading && <AdminLoadingState message="جارٍ تحميل فهرس المعرفة في Gateway..." />}
          {!loading && liveLoading && nodes.length === 0 && <AdminLoadingState message="جارٍ البحث في فهرس Gateway المباشر..." />}
          {!loading && !liveLoading && nodes.length === 0 && liveDocuments.length === 0 && <div className="admin-state">{indexHealthy === false ? <AdminErrorState message="فهرس المعرفة في Gateway غير متاح. لم تُغيّر أي بيانات تحريرية." /> : indexStats && (indexStats.records ?? 0) > 0 ? <><strong>لا توجد سجلات مباشرة مطابقة</strong><p className="muted">يحتوي الفهرس على سجلات، لكن لا يطابق أي منها هذا البحث. جرّب بحثاً أوسع.</p></> : <><strong>{total === 0 ? "لا توجد سجلات مطابقة" : "لا توجد سجلات في هذه الصفحة"}</strong><p className="muted">جرّب بحثاً أوسع أو حدّث الصفحة.</p></>}</div>}
          {nodes.map((n) => (
            <button
              key={n.id}
              className={`kb-node-row ${selected?.id === n.id ? "active" : ""}`}
              onClick={() => selectNode(n)}
            >
              <div className="kb-node-title">{n.title || `Node #${n.id}`}</div>
              <div className="kb-node-meta">
                <span className="tag">{n.category}</span>
                {n.source && <span className="muted">{n.source}</span>}
              </div>
            </button>
          ))}
          {!liveLoading && nodes.length === 0 && liveDocuments.map((document) => <button key={document.id} className={`kb-node-row ${selectedLive?.id === document.id ? "active" : ""}`} onClick={() => selectLiveDocument(document)}><div className="kb-node-title">{document.title}</div><div className="kb-node-meta"><span className="tag">{document.sourceType}</span><span className="muted">نتيجة Gateway للقراءة فقط</span></div></button>)}
        </div>

        {/* Editor pane */}
        <div className="kb-editor-pane">
          {!selected && (
            <div className="muted center-msg">اختر عقدة لعرض محتواها وتعديله.</div>
          )}
          {selected && (
            <>
              <div className="kb-editor-header">
                <h3>{selected.title || `Node #${selected.id}`}</h3>
                <span className="tag">{selected.category}</span><AdminStatusBadge status="Gateway index" />
              </div>
              <textarea
                className="kb-editor-textarea"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={20}
              />
              <div className="form-actions">
                <button className="accent" onClick={saveNode} disabled={saving}>
                  {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                </button>
                <button className="ghost" onClick={() => setEditContent(selected.content)}>
                  تجاهل التغييرات
                </button>
              </div>
            </>
          )}
          {selectedLive && <div className="kb-live-detail"><div className="kb-editor-header"><h3>{selectedLive.title}</h3><AdminStatusBadge status="للقراءة فقط" /></div><AdminNotice tone="info">تنتمي هذه النتيجة إلى فهرس Gateway الديناميكي. التغييرات التحريرية تتم في استوديو المحتوى أو Payload.</AdminNotice><p>{selectedLive.excerpt || "لم يُرجع الفهرس المباشر مقتطفاً."}</p><dl className="kb-metadata"><div><dt>نوع المصدر</dt><dd>{selectedLive.sourceType}</dd></div><div><dt>الوسوم</dt><dd>{selectedLive.tags?.join(", ") || "غير متاح"}</dd></div><div><dt>النتيجة</dt><dd>{selectedLive.score ?? "غير متاح"}</dd></div></dl>{selectedLive.sourceUrl && <a href={selectedLive.sourceUrl} target="_blank" rel="noreferrer">فتح المصدر الأساسي</a>}</div>}
        </div>
      </div>
    </div>
  );
}
