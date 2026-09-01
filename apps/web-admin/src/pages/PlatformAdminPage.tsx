import { useEffect, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminDataTable, AdminErrorState, AdminLoadingState, AdminPageSection, AdminStatusBadge } from "../components/admin/AdminPrimitives";

type Row = { id: string; [key: string]: unknown };
const configs: Record<string, { title: string; endpoint: string; key: string }> = {
  permissions: { title: "Roles & Permissions", endpoint: "/api/admin-authority/permissions", key: "policies" },
  approvals: { title: "Approval Center", endpoint: "/api/admin-authority/approval-requests", key: "approvals" },
  health: { title: "Module Health", endpoint: "/api/admin-authority/module-health", key: "modules" },
  integrations: { title: "Integration Status", endpoint: "/api/admin-authority/integration-status", key: "integrations" },
  authorityAudit: { title: "Authority Audit", endpoint: "/api/admin-authority/audit-events", key: "events" },
};
export default function PlatformAdminPage({ kind }: { kind: keyof typeof configs }) {
  const config = configs[kind]; const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { let active = true; adminFetch(config.endpoint).then((response) => response.json()).then((body) => { if (active) setRows((body[config.key] ?? []).map((row: Row, index: number) => ({ ...row, id: String(row.id ?? row.key ?? index) }))); }).catch((reason) => { if (active) setError(getAdminErrorMessage(reason, "Unable to load this authority surface.")); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [config.endpoint, config.key]);
  const columns = rows.length ? Object.keys(rows[0]).filter((key) => key !== "id").slice(0, 7) : ["Status"];
  const displayColumns = kind === "approvals" ? [...columns, "actions"] : columns;
  async function decide(id: string, decision: "approved" | "rejected" | "cancelled") { await adminFetch(`/api/admin-authority/approval-requests/${id}/decision`, { method: "POST", body: JSON.stringify({ decision }) }); setRows((current) => current.filter((row) => row.id !== id)); }
  return <AdminPageSection title={config.title} description="Read-only authority data from the existing admin-authority service.">{loading ? <AdminLoadingState /> : error ? <AdminErrorState message={error} /> : <AdminDataTable rows={rows} columns={displayColumns.map((column) => column.replace(/([A-Z])/g, " $1"))} empty="No records available." renderRow={(row) => <>{columns.map((column) => <td key={column}>{column.toLowerCase().includes("status") || column === "evidenceStatus" ? <AdminStatusBadge status={String(row[column] ?? "unknown")} /> : String(row[column] ?? "Unavailable")}</td>)}{kind === "approvals" ? <td><button type="button" className="ghost sm" onClick={() => { const detail = window.confirm(`Approve ${String(row.actionType ?? row.id)} for ${String(row.entityId ?? "target")}?`); if (detail) void decide(row.id, "approved"); }}>Approve</button><button type="button" className="ghost sm danger" onClick={() => { const detail = window.confirm(`Reject ${String(row.actionType ?? row.id)}?`); if (detail) void decide(row.id, "rejected"); }}>Reject</button><button type="button" className="ghost sm" onClick={() => { const detail = window.confirm(`Cancel ${String(row.actionType ?? row.id)}?`); if (detail) void decide(row.id, "cancelled"); }}>Cancel</button></td> : null}</>} />}</AdminPageSection>;
}
