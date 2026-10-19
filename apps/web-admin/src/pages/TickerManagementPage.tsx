import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import UniversalCollectionPage from "./UniversalCollectionPage";

const DEFAULT_SECONDS = 240;
const MIN_SECONDS = 60;
const MAX_SECONDS = 300;

export default function TickerManagementPage() {
  const [seconds, setSeconds] = useState(DEFAULT_SECONDS);
  const [savedSeconds, setSavedSeconds] = useState(DEFAULT_SECONDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await adminFetch("/api/admin/ticker/settings");
      const body = await response.json();
      const next = Math.round(Number(body?.settings?.cycleMs || DEFAULT_SECONDS * 1000) / 1000);
      const bounded = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, next));
      setSeconds(bounded); setSavedSeconds(bounded);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل إعدادات الشريط الإخباري");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true); setError(null); setMessage(null);
    try {
      const response = await adminFetch("/api/admin/ticker/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cycleMs: seconds * 1000 }),
      });
      const body = await response.json();
      const next = Math.round(Number(body?.settings?.cycleMs || seconds * 1000) / 1000);
      setSeconds(next); setSavedSeconds(next);
      setMessage(`تم حفظ سرعة الشريط: دورة كاملة كل ${next} ثانية.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حفظ إعدادات الشريط الإخباري");
    } finally { setSaving(false); }
  };

  return <>
    <section className="card" aria-labelledby="ticker-settings-title">
      <div className="page-header">
        <span className="eyebrow">النظام / الشريط الإخباري</span>
        <h2 id="ticker-settings-title">إعدادات الشريط الإخباري</h2>
        <p className="muted">اضبط سرعة الحركة. الإعداد الافتراضي هو 240 ثانية للدورة الكاملة، ويمكن تعديله وحفظه من هنا.</p>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="alert success">{message}</div> : null}
      <div className="form-grid">
        <label>
          مدة الدورة الكاملة: <strong>{seconds} ثانية</strong>
          <input type="range" min={MIN_SECONDS} max={MAX_SECONDS} step={15} value={seconds} disabled={loading || saving}
            onChange={(event) => setSeconds(Number(event.target.value))} />
        </label>
        <div className="muted">الحد الأدنى دقيقة واحدة، والحد الأقصى خمس دقائق. يتوقف الشريط مؤقتاً عند تمرير المؤشر فوقه.</div>
        <div className="button-row">
          {[60, 90, 120, 180, 240].map((value) => <button key={value} type="button" className="ghost" disabled={loading || saving} onClick={() => setSeconds(value)}>{value} ث</button>)}
          <button type="button" className="accent" disabled={loading || saving || seconds === savedSeconds} onClick={() => void save()}>
            {saving ? "جارٍ الحفظ..." : "حفظ السرعة"}
          </button>
        </div>
      </div>
    </section>
    <UniversalCollectionPage kind="ticker" />
  </>;
}
