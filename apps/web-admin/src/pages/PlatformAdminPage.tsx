import { useEffect, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminDataTable, AdminErrorState, AdminLoadingState, AdminPageSection, AdminStatusBadge } from "../components/admin/AdminPrimitives";

type Row = { id: string; [key: string]: unknown };
const configs: Record<string, { title: string; endpoint: string; key: string }> = {
  permissions: { title: "الأدوار والصلاحيات", endpoint: "/api/admin-authority/permissions", key: "policies" },
  approvals: { title: "مركز الموافقات", endpoint: "/api/admin-authority/approval-requests", key: "approvals" },
  health: { title: "صحة الوحدات", endpoint: "/api/admin-authority/module-health", key: "modules" },
  integrations: { title: "حالة التكاملات", endpoint: "/api/admin-authority/integration-status", key: "integrations" },
  authorityAudit: { title: "تدقيق الصلاحيات", endpoint: "/api/admin-authority/audit-events", key: "events" },
};
export default function PlatformAdminPage({ kind }: { kind: keyof typeof configs }) {
  const config = configs[kind]; const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { let active = true; adminFetch(config.endpoint).then((response) => response.json()).then((body) => { if (active) setRows((body[config.key] ?? []).map((row: Row, index: number) => ({ ...row, id: String(row.id ?? row.key ?? index) }))); }).catch((reason) => { if (active) setError(getAdminErrorMessage(reason, "تعذر تحميل مساحة الصلاحيات.")); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [config.endpoint, config.key]);
  const columns = rows.length ? Object.keys(rows[0]).filter((key) => key !== "id").slice(0, 7) : ["Status"];
  const displayColumns = kind === "approvals" ? [...columns, "actions"] : columns;
  async function decide(id: string, decision: "approved" | "rejected" | "cancelled") { await adminFetch(`/api/admin-authority/approval-requests/${id}/decision`, { method: "POST", body: JSON.stringify({ decision }) }); setRows((current) => current.filter((row) => row.id !== id)); }
  return <AdminPageSection title={config.title} description="بيانات صلاحيات للقراءة فقط من خدمة الإدارة المعتمدة.">{loading ? <AdminLoadingState /> : error ? <AdminErrorState message={error} /> : <AdminDataTable rows={rows} columns={displayColumns.map((column) => column.replace(/([A-Z])/g, " $1"))} empty="لا توجد سجلات متاحة." renderRow={(row) => <>{columns.map((column) => <td key={column}>{column.toLowerCase().includes("status") || column === "evidenceStatus" ? <AdminStatusBadge status={String(row[column] ?? "غير معروف")} /> : String(row[column] ?? "غير متاح")}</td>)}{kind === "approvals" ? <td><button type="button" className="ghost sm" onClick={() => { const detail = window.confirm(`هل توافق على ${String(row.actionType ?? row.id)} للهدف ${String(row.entityId ?? "المعرّف")}؟`); if (detail) void decide(row.id, "approved"); }}>موافقة</button><button type="button" className="ghost sm danger" onClick={() => { const detail = window.confirm(`هل ترفض ${String(row.actionType ?? row.id)}؟`); if (detail) void decide(row.id, "rejected"); }}>رفض</button><button type="button" className="ghost sm" onClick={() => { const detail = window.confirm(`هل تلغي ${String(row.actionType ?? row.id)}؟`); if (detail) void decide(row.id, "cancelled"); }}>إلغاء</button></td> : null}</>} />}</AdminPageSection>;
}
