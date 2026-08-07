import { useEffect, useMemo, useState } from "react";
import type { TicketV2 } from "../../types/domain";
import { api } from "../../lib/api";
import { useApp } from "../../store/app";

type Props = {
  onDone: () => void;
};

const CATEGORIES = [
  { id: "bank", label: "مشكلة بالبنك" },
  { id: "finance", label: "مشكلة بالمالية" },
  { id: "pension", label: "مشكلة بالمعاش" },
  { id: "school", label: "مشكلة بالمدارس" },
  { id: "other", label: "غير هيك" },
];

export function TicketsSheet({ onDone }: Props) {
  const { apiBaseUrl } = useApp();
  const [tickets, setTickets] = useState<TicketV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Create ticket
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const [title, setTitle] = useState("عندي مشكلة");
  const [desc, setDesc] = useState("");
  const canCreate = useMemo(() => desc.trim().length >= 10, [desc]);

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      const data = await api.listTicketsV2(apiBaseUrl);
      setTickets(data.tickets || []);
    } catch (e: any) {
      setErr("مش قادر جيب التذاكر هلّق… جرّب بعدين.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  async function create() {
    if (!canCreate) return;
    setLoading(true);
    setErr("");
    try {
      const payload = {
        category: cat,
        title_lb: title || "عندي مشكلة",
        description: desc,
        // best-effort fields; backend can fill defaults
        priority: "normal",
        intent: "followup",
        domain: "retired_military",
      } as any;
      await api.createTicketV2(payload, apiBaseUrl);
      setDesc("");
      await refresh();
    } catch {
      setErr("ما قدرنا نفتح تذكرة… جرّب بعد شوي.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wt-sheet">
      <div className="wt-sheet__row">
        <div className="wt-muted">إذا ما انحلّت قصتك هون… منفتح تذكرة وبتتابعها.</div>
        <button className="wt-btn wt-btn--ghost" onClick={onDone}>
          إلغاء
        </button>
      </div>

      <div className="wt-card">
        <div className="wt-card__title">فتح تذكرة</div>

        <div className="wt-field">
          <div className="wt-label">شو نوع المشكلة؟</div>
          <div className="wt-chips">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                data-feature-key={c.id}
                className={"wt-chipbtn" + (cat === c.id ? " wt-chipbtn--on" : "")}
                onClick={() => setCat(c.id)}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="wt-field">
          <div className="wt-label">عنوان مختصر</div>
          <input className="wt-input wt-input--sheet" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="wt-field">
          <div className="wt-label">شرح بسيط (على القلي 10 حروف)</div>
          <textarea
            className="wt-textarea"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="مثلاً: البنك عم يرفض يحوّل المعاش…"
            rows={3}
          />
        </div>

        <div className="wt-sheet__row">
          <button className="wt-btn wt-btn--primary" onClick={create} disabled={!canCreate || loading}>
            فتح تذكرة
          </button>
          <button className="wt-btn" onClick={refresh} disabled={loading}>
            تحديث
          </button>
        </div>

        {err ? <div className="wt-error">{err}</div> : null}
      </div>

      <div className="wt-card">
        <div className="wt-card__title">تذاكري</div>
        {loading ? <div className="wt-muted">عم حمّل…</div> : null}
        {!loading && tickets.length === 0 ? <div className="wt-muted">ما في تذاكر بعد.</div> : null}

        <div className="wt-list">
          {tickets.map((t) => (
            <details className="wt-accordion" key={t.id}>
              <summary className="wt-accordion__sum">
                <span>{t.title_lb || "تذكرة"}</span>
                <span className={"wt-pill " + (t.status === "resolved" ? "wt-pill--ok" : "wt-pill--wait")}>
                  {t.status}
                </span>
              </summary>
              <div className="wt-accordion__body">
                <div className="wt-muted">التصنيف: {t.category}</div>
                <div className="wt-muted">آخر تحديث: {t.updated_at}</div>
                <div className="wt-pre">{t.description}</div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
