import { useEffect, useMemo, useState } from "react";
import { downloadV19AdminExport, V19AdminApiError, v19AdminFetch } from "../lib/v19AdminApi";

type AddressValue = {
  governorateId?: string; governorateName?: string; cazaId?: string; cazaName?: string;
  municipalityId?: string; municipalityName?: string; villageId?: string; villageName?: string; manualText?: string;
};
type Application = {
  id: string; fullName: string; phone: string; email?: string; service: string; rank: string;
  address: AddressValue; retirementDate: string; benchmarkCode: string; benchmarkLabel: string;
  depositMonth: string; depositYear: "2019" | "2020"; amount: number; problemSummary?: string; submittedAt: string;
};

function addressText(address: AddressValue) {
  return [address.governorateName || address.governorateId, address.cazaName || address.cazaId,
    address.villageName || address.villageId].filter(Boolean).join(" - ") || "—";
}
function money(value: number) { return `${Number(value || 0).toLocaleString("en-US")} ل.ل.`; }

export default function Veterans2019ApplicationsAdminPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [query, setQuery] = useState("");
  const [benchmark, setBenchmark] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "json" | "">("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await v19AdminFetch("/api/veterans-2019/applications");
        const payload = await response.json().catch(() => ({})) as { ok?: boolean; applications?: Application[] };
        if (!response.ok || !payload.ok || !Array.isArray(payload.applications)) throw new Error("LOAD_FAILED");
        if (!cancelled) setItems(payload.applications);
      } catch (reason) {
        if (reason instanceof V19AdminApiError && reason.status === 401) {
          globalThis.location.assign("/ops/");
          return;
        }
        if (!cancelled) setError("تعذر تحميل لائحة الطلبات.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => items.filter((item) => {
    const haystack = [item.id, item.fullName, item.phone, item.email, item.service, item.rank, addressText(item.address), item.problemSummary].join(" ").toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (!benchmark || item.benchmarkCode === benchmark) && (!year || item.depositYear === year);
  }), [items, query, benchmark, year]);

  const before = items.filter((item) => item.benchmarkCode === "BEFORE_2019_10_17").length;
  const after = items.filter((item) => item.benchmarkCode === "ON_OR_AFTER_2019_10_17").length;
  const totalAmount = visible.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  async function exportFile(format: "csv" | "json") {
    setExporting(format); setError("");
    try { await downloadV19AdminExport(format); }
    catch (reason) { if (reason instanceof V19AdminApiError && reason.status === 401) { globalThis.location.assign("/ops/"); return; } setError(`تعذر تصدير ${format.toUpperCase()}.`); }
    finally { setExporting(""); }
  }
  if (loading) return <main className="wt-page" dir="rtl"><section className="wt-panel"><p>جارٍ تحميل الطلبات…</p></section></main>;
  if (error) return <main className="wt-page" dir="rtl"><section className="wt-panel"><p role="alert">{error}</p></section></main>;

  return (
    <main className="wt-page" dir="rtl" style={{ maxWidth: 1280, margin: "0 auto" }}>
      <section className="wt-panel">
        <p className="wt-kicker">الإدارة</p>
        <h1>لائحة حالات العسكريين المحالين إلى التقاعد خلال عام 2019</h1>
      </section>
      <section className="wt-panel wt-panel--subtle">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          <div><small>إجمالي الطلبات</small><strong style={{ display: "block", fontSize: 24 }}>{items.length}</strong></div>
          <div><small>قبل 17 تشرين</small><strong style={{ display: "block", fontSize: 24 }}>{before}</strong></div>
          <div><small>17 تشرين وما بعده</small><strong style={{ display: "block", fontSize: 24 }}>{after}</strong></div>
          <div><small>دخل التعويض في 2019</small><strong style={{ display: "block", fontSize: 24 }}>{items.filter((item) => item.depositYear === "2019").length}</strong></div>
          <div><small>دخل التعويض في 2020</small><strong style={{ display: "block", fontSize: 24 }}>{items.filter((item) => item.depositYear === "2020").length}</strong></div>
        </div>
      </section>

      <section className="wt-panel">
        <div className="wt-form-grid">
          <label className="wt-field"><span>بحث</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="الاسم، الهاتف، البريد، السلك، الرتبة أو العنوان" /></label>
          <label className="wt-field"><span>تصنيف 17 تشرين</span><select value={benchmark} onChange={(e) => setBenchmark(e.target.value)}><option value="">الكل</option><option value="BEFORE_2019_10_17">قبل 17 تشرين</option><option value="ON_OR_AFTER_2019_10_17">17 تشرين وما بعده</option></select></label>
          <label className="wt-field"><span>سنة دخول التعويض</span><select value={year} onChange={(e) => setYear(e.target.value)}><option value="">الكل</option><option value="2019">2019</option><option value="2020">2020</option></select></label>
        </div>
        <div className="wt-actions" style={{ marginTop: 12 }}>
          <button className="wt-button wt-button--primary" type="button" disabled={Boolean(exporting)} onClick={() => void exportFile("csv")}>{exporting === "csv" ? "جارٍ التصدير…" : "تصدير CSV"}</button>
          <button className="wt-button wt-button--secondary" type="button" disabled={Boolean(exporting)} onClick={() => void exportFile("json")}>{exporting === "json" ? "جارٍ التصدير…" : "تصدير JSON"}</button>
        </div>
        <p><strong>إجمالي قيمة التعويضات الظاهرة: {money(totalAmount)}</strong></p>
      </section>

      <section className="wt-panel" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
          <thead><tr><th>رقم الطلب</th><th>الاسم</th><th>الهاتف</th><th>البريد</th><th>السلك</th><th>الرتبة</th><th>العنوان</th><th>المشكلة باختصار</th><th>تاريخ التقاعد</th><th>التصنيف</th><th>دخول التعويض</th><th>القيمة</th><th>التسجيل</th></tr></thead>
          <tbody>
            {visible.length === 0 ? <tr><td colSpan={13} style={{ textAlign: "center", padding: 24 }}>لا توجد طلبات مطابقة.</td></tr> : visible.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td><td>{item.fullName}</td><td>{item.phone}</td><td>{item.email || "—"}</td>
                <td>{item.service}</td><td>{item.rank}</td><td>{addressText(item.address)}</td><td>{item.problemSummary || "—"}</td><td>{item.retirementDate}</td>
                <td>{item.benchmarkLabel}</td><td>{item.depositMonth}</td><td>{money(item.amount)}</td>
                <td>{new Date(item.submittedAt).toLocaleString("ar-LB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
