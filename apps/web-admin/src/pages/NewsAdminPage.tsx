import { useEffect, useState, useRef } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminFluentIcon } from "../components/AdminFluentIcon";

interface NewsItem {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  image_url: string | null;
  source_url: string | null;
  is_published: number;
  published_at: number;
  created_at: number;
  created_by: string | null;
}

const empty = (): Partial<NewsItem> => ({
  title: "",
  body: "",
  category: "",
  image_url: "",
  source_url: "",
  is_published: 1,
  published_at: Date.now(),
});

export default function NewsAdminPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<NewsItem>>(empty());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    adminFetch("/admin/news")
      .then((r) => r.json())
      .then((data: NewsItem[]) => { setItems(data); setLoading(false); })
      .catch((e) => { setError(getAdminErrorMessage(e, "تعذر تحميل الأخبار.")); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const startEdit = (item: NewsItem) => {
    setEditId(item.id);
    setForm({ ...item });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const resetForm = () => { setEditId(null); setForm(empty()); setSaveErr(null); };

  const handleSave = async () => {
    if (!form.title?.trim()) { setSaveErr("العنوان مطلوب"); return; }
    setSaving(true);
    setSaveErr(null);
    try {
      const url = editId ? `/admin/news/${editId}` : "/admin/news";
      const res = await adminFetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title!.trim(),
          body: form.body || null,
          category: form.category || null,
          image_url: form.image_url || null,
          source_url: form.source_url || null,
          is_published: form.is_published ?? 1,
          published_at: form.published_at ?? Date.now(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as any;
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      resetForm();
      load();
    } catch (e) {
      setSaveErr(getAdminErrorMessage(e, "تعذر حفظ الخبر."));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (item: NewsItem) => {
    const next = item.is_published ? 0 : 1;
    await adminFetch(`/admin/news/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: next }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("حذف هذا الخبر نهائياً؟")) return;
    await adminFetch(`/admin/news/${id}`, { method: "DELETE" });
    if (editId === id) resetForm();
    load();
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 900 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <AdminFluentIcon name="news" />
        إدارة الأخبار
      </h2>

      {/* ── Form ── */}
      <div
        ref={formRef}
        style={{
          background: "var(--surface, #1e293b)",
          borderRadius: 10,
          padding: "18px 20px",
          marginBottom: 24,
          border: "1px solid var(--border, #334155)",
        }}
      >
        <h3 style={{ marginBottom: 14, fontSize: "0.95rem", color: "var(--ink, #e2e8f0)" }}>
          {editId ? "تعديل الخبر" : "إضافة خبر جديد"}
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          {(["title", "body", "category", "image_url", "source_url"] as const).map((field) => (
            <label key={field} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-muted, #94a3b8)" }}>
                {
                  field === "title" ? "العنوان *" :
                  field === "body" ? "نص الخبر" :
                  field === "category" ? "التصنيف" :
                  field === "image_url" ? "رابط الصورة" :
                  "رابط المصدر"
                }
              </span>
              {field === "body" ? (
                <textarea
                  rows={3}
                  value={(form[field] as string) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  style={{ borderRadius: 6, border: "1px solid var(--border, #334155)", background: "var(--bg, #0f172a)", color: "var(--ink, #e2e8f0)", padding: "7px 10px", fontSize: "0.88rem", resize: "vertical", fontFamily: "inherit" }}
                  dir="rtl"
                />
              ) : (
                <input
                  type="text"
                  value={(form[field] as string) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  style={{ borderRadius: 6, border: "1px solid var(--border, #334155)", background: "var(--bg, #0f172a)", color: "var(--ink, #e2e8f0)", padding: "7px 10px", fontSize: "0.88rem" }}
                  dir="rtl"
                />
              )}
            </label>
          ))}

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.is_published === 1}
              onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked ? 1 : 0 }))}
            />
            <span style={{ fontSize: "0.88rem", color: "var(--ink, #e2e8f0)" }}>منشور</span>
          </label>
        </div>

        {saveErr && <p style={{ color: "#f87171", marginTop: 8, fontSize: "0.85rem" }}>{saveErr}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            className="accent"
            onClick={handleSave}
            disabled={saving}
            style={{ minWidth: 90 }}
          >
            {saving ? "جارٍ الحفظ…" : editId ? "حفظ التعديل" : "نشر الخبر"}
          </button>
          {editId && (
            <button className="ghost" onClick={resetForm}>
              إلغاء
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      {loading && <p style={{ color: "#94a3b8" }}>جارٍ التحميل…</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p style={{ color: "#64748b" }}>لا توجد أخبار بعد. أضف أول خبر أعلاه.</p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          style={{
            background: "var(--surface, #1e293b)",
            border: "1px solid var(--border, #334155)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 10,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--ink, #e2e8f0)", marginBottom: 3 }}>
              {item.title}
            </div>
            {item.body && (
              <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 520 }}>
                {item.body}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, fontSize: "0.75rem", color: "#64748b" }}>
              {item.category && <span>📂 {item.category}</span>}
              <span>📅 {new Date(item.published_at).toLocaleDateString("ar-LB")}</span>
              <span
                style={{
                  padding: "1px 8px",
                  borderRadius: 20,
                  background: item.is_published ? "#15803d22" : "#7f1d1d22",
                  color: item.is_published ? "#86efac" : "#fca5a5",
                  border: `1px solid ${item.is_published ? "#166534" : "#991b1b"}`,
                }}
              >
                {item.is_published ? "منشور" : "مسودة"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              className="ghost"
              title={item.is_published ? "إلغاء النشر" : "نشر"}
              onClick={() => togglePublish(item)}
              style={{ fontSize: 12 }}
            >
              {item.is_published ? "إخفاء" : "نشر"}
            </button>
            <button className="ghost" onClick={() => startEdit(item)} style={{ fontSize: 12 }}>
              تعديل
            </button>
            <button
              onClick={() => handleDelete(item.id)}
              style={{ fontSize: 12, color: "#f87171", background: "transparent", border: "1px solid #7f1d1d", borderRadius: 6, cursor: "pointer", padding: "4px 10px" }}
            >
              حذف
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
