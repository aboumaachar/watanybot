import { useEffect, useMemo, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminDataTable, AdminErrorState, AdminLoadingState, AdminPageSection } from "../components/admin/AdminPrimitives";

type Row = { id: string; [key: string]: unknown };

type AdminModuleTablePageProps = {
  title: string;
  description: string;
  endpoint: string;
  rowKeys?: string[];
  columns?: string[];
};

function asRows(payload: unknown, rowKeys: string[]): Row[] {
  if (Array.isArray(payload)) return payload.filter((row): row is Row => typeof row === "object" && row !== null).map((row, index) => {
    const sourceId = row.id ?? row.key;
    const id = typeof sourceId === "string" || typeof sourceId === "number" ? String(sourceId) : String(index);
    return { ...row, id };
  });
  if (!payload || typeof payload !== "object") return [];
  const source = payload as Record<string, unknown>;
  for (const key of rowKeys) {
    if (Array.isArray(source[key])) return asRows(source[key], []);
    if (source[key] && typeof source[key] === "object") return asRows(source[key], rowKeys);
  }
  return asRows(source.items ?? source.data ?? source.results ?? [], []);
}

function displayValue(value: unknown): string {
  const labels: Record<string, string> = { active: "نشط", inactive: "غير نشط", enabled: "مفعّل", disabled: "معطّل", pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض", draft: "مسودة", published: "منشور", healthy: "سليم", degraded: "متدهور", offline: "غير متصل", online: "متصل", unavailable: "غير متاح" };
  if (value === null || value === undefined || value === "") return "غير متاح";
  if (typeof value === "object") return JSON.stringify(value) || "غير متاح";
  if (typeof value === "string") return labels[value.toLowerCase()] ?? value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value.toString();
  return "غير متاح";
}

const columnLabels: Record<string, string> = { status: "الحالة", health: "الصحة", name: "الاسم", title: "العنوان", type: "النوع", category: "الفئة", url: "الرابط", input: "المدخل", output: "المخرج", source: "المصدر", created: "تاريخ الإنشاء", updated: "آخر تحديث", version: "الإصدار", configuration: "الإعدادات", checks: "الفحوصات", services: "الخدمات" };

export default function AdminModuleTablePage({ title, description, endpoint, rowKeys = ["items", "data", "results"], columns }: Readonly<AdminModuleTablePageProps>) {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 25;
  const rowKeySignature = rowKeys.join("|");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void adminFetch(endpoint)
      .then((response) => response.json())
      .then((payload) => { if (active) setRows(asRows(payload, rowKeySignature.split("|"))); })
      .catch((reason: unknown) => { if (active) setError(getAdminErrorMessage(reason, `Unable to load ${title}.`)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, rowKeySignature, title]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => Object.values(row).some((value) => displayValue(value).toLowerCase().includes(normalized)));
  }, [query, rows]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const tableColumns = columns ?? (rows.length ? Object.keys(rows[0]).filter((key) => key !== "id").slice(0, 8) : ["status"]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  let content = <AdminDataTable rows={visible} columns={tableColumns.map((column) => columnLabels[column.toLowerCase()] ?? column.replace(/([A-Z])/g, " $1"))} empty="لا توجد سجلات متاحة." renderRow={(row) => <>{tableColumns.map((column) => <td key={column}>{displayValue(row[column])}</td>)}</>} />;
  if (loading) content = <AdminLoadingState />;
  else if (error) content = <AdminErrorState message={error} />;

  return <AdminPageSection title={title} description={description}>
    <div className="admin-toolbar">
      <label>بحث <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={`بحث في ${title}`} /></label>
      <span>{filtered.length} سجل</span>
    </div>
    {content}
    {!loading && !error &&
      <div className="admin-pagination" aria-label={`${title} pagination`}>
        <button type="button" className="ghost sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>السابق</button>
        <span>صفحة {page} من {pageCount}</span>
        <button type="button" className="ghost sm" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>التالي</button>
      </div>
    }
  </AdminPageSection>;
}
