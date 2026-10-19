import { useEffect, useMemo, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminDataTable, AdminErrorState, AdminPageSection, AdminSearchInput, AdminStatCard, AdminTableToolbar } from "../components/admin/AdminPrimitives";

type AddressValue = {
  governorateId?: string; governorateName?: string; cazaId?: string; cazaName?: string;
  villageId?: string; villageName?: string;
};
type Application = {
  id: string; fullName: string; phone: string; email?: string; service: string; rank: string;
  address: AddressValue; retirementDate: string; benchmarkCode: string; benchmarkLabel: string;
  depositMonth: string; depositYear: "2019" | "2020"; amount: number; problemSummary?: string; submittedAt: string;
};
type ListResponse = { ok?: boolean; count?: number; applications?: Application[] };

const money = (value: number) => `${Number(value || 0).toLocaleString("en-US")} ل.ل.`;
const addressText = (address: AddressValue) => [
  address.governorateName || address.governorateId,
  address.cazaName || address.cazaId,
  address.villageName || address.villageId,
].filter(Boolean).join(" - ") || "—";

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("ar-LB");
}

export default function Veterans2019ApplicationsAdminPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [query, setQuery] = useState("");
  const [benchmark, setBenchmark] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"csv" | "json" | "">("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await adminFetch("/api/veterans-2019/applications");
      const payload = await response.json() as ListResponse;
      if (!payload.ok || !Array.isArray(payload.applications)) throw new Error("VETERANS_2019_LIST_INVALID");
      setItems(payload.applications);
    } catch (reason) {
      setItems([]);
      setError(getAdminErrorMessage(reason, "تعذر تحميل حالات متقاعدي 2019."));
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => items.filter((item) => {
    const haystack = [item.id, item.fullName, item.phone, item.email, item.service, item.rank, addressText(item.address), item.problemSummary].join(" ").toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase()))
      && (!benchmark || item.benchmarkCode === benchmark)
      && (!year || item.depositYear === year);
  }), [items, query, benchmark, year]);

  const before = items.filter((item) => item.benchmarkCode === "BEFORE_2019_10_17").length;
  const after = items.filter((item) => item.benchmarkCode === "ON_OR_AFTER_2019_10_17").length;
  const y2019 = items.filter((item) => item.depositYear === "2019").length;
  const y2020 = items.filter((item) => item.depositYear === "2020").length;
  const visibleAmount = visible.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  async function exportFile(format: "csv" | "json") {
    setExporting(format); setError("");
    try {
      const response = await adminFetch(`/api/veterans-2019/applications/export.${format}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `veterans-2019-applications.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(getAdminErrorMessage(reason, `تعذر تصدير ${format.toUpperCase()}.`));
    } finally { setExporting(""); }
  }

  return <div className="admin-page" dir="rtl">
    <AdminPageSection title="حالات العسكريين المتقاعدين 2019" description="لائحة الاستمارات المسجلة من النموذج العام، مع البحث والفرز والتصدير." action={<button className="ghost" type="button" onClick={() => void load()}>تحديث</button>}>
      <div className="admin-stats">
        <AdminStatCard label="إجمالي الطلبات" value={items.length} />
        <AdminStatCard label="قبل 17 تشرين" value={before} />
        <AdminStatCard label="17 تشرين وما بعده" value={after} />
        <AdminStatCard label="دخل التعويض في 2019" value={y2019} />
        <AdminStatCard label="دخل التعويض في 2020" value={y2020} />
      </div>

      <AdminTableToolbar resultCount={visible.length} onClear={() => { setQuery(""); setBenchmark(""); setYear(""); }}>
        <AdminSearchInput value={query} onChange={setQuery} placeholder="الاسم، الهاتف، البريد، السلك، الرتبة، العنوان أو المشكلة" />
        <select value={benchmark} onChange={(event) => setBenchmark(event.target.value)}>
          <option value="">كل تصنيفات 17 تشرين</option>
          <option value="BEFORE_2019_10_17">قبل 17 تشرين</option>
          <option value="ON_OR_AFTER_2019_10_17">17 تشرين وما بعده</option>
        </select>
        <select value={year} onChange={(event) => setYear(event.target.value)}>
          <option value="">كل سنوات دخول التعويض</option>
          <option value="2019">2019</option>
          <option value="2020">2020</option>
        </select>
        <button className="ghost" type="button" disabled={Boolean(exporting)} onClick={() => void exportFile("csv")}>{exporting === "csv" ? "جارٍ التصدير…" : "تصدير CSV"}</button>
        <button className="ghost" type="button" disabled={Boolean(exporting)} onClick={() => void exportFile("json")}>{exporting === "json" ? "جارٍ التصدير…" : "تصدير JSON"}</button>
      </AdminTableToolbar>
      {error ? <AdminErrorState message={error} /> : null}
      <p className="muted"><strong>إجمالي قيمة التعويضات الظاهرة: {money(visibleAmount)}</strong></p>
      <AdminDataTable
        rows={visible}
        columns={["رقم الطلب", "الاسم", "الهاتف", "البريد", "السلك", "الرتبة", "العنوان", "المشكلة باختصار", "تاريخ التقاعد", "التصنيف", "دخول التعويض", "القيمة", "التسجيل"]}
        loading={loading}
        empty="لا توجد طلبات مطابقة."
        renderRow={(item) => <>
          <td>{item.id}</td><td><strong>{item.fullName}</strong></td><td dir="ltr">{item.phone}</td><td>{item.email || "—"}</td>
          <td>{item.service}</td><td>{item.rank}</td><td>{addressText(item.address)}</td><td>{item.problemSummary || "—"}</td>
          <td>{item.retirementDate}</td><td>{item.benchmarkLabel}</td><td>{item.depositMonth}</td><td>{money(item.amount)}</td><td>{dateLabel(item.submittedAt)}</td>
        </>}
      />
    </AdminPageSection>
  </div>;
}
