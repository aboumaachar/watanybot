import { useState, useEffect, useCallback } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminDataTable, AdminErrorState, AdminPageHeader, AdminPageSection, AdminPagination, AdminSearchInput, AdminStatusBadge } from "../components/admin/AdminPrimitives";

type AuditEntry = {
  id: string;
  user_id: string | null;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  ip?: string;
  created_at: string;
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(PER_PAGE), offset: String((page - 1) * PER_PAGE) });
      if (actionFilter) params.set("action", actionFilter);
      if (search) params.set("search", search);
      const res = await adminFetch(`/api/admin/audit?${params}`);
      const body = await res.json();
      setEntries(body.entries ?? []);
      setTotal(Number(body.total ?? 0));
    } catch (err) {
      setError(getAdminErrorMessage(err, "Unable to load audit activity."));
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, search]);

  useEffect(() => { load(); }, [load]);

  const actions = [...new Set(entries.map((e) => e.action))];

  return (
    <div className="ops-page-stack">
      <AdminPageHeader title="سجل التدقيق" description="سجل قابل للبحث للإجراءات الإدارية والنظامية المملوك لـ Gateway." actions={<button className="ghost" type="button" onClick={() => void load()}>تحديث</button>} />
      <AdminPageSection title="النشاط" description="صفِّ سجل تدقيق Gateway المعتمد.">

      <div className="toolbar">
        <AdminSearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="ابحث في الإجراءات والموارد ومعرّف المستخدم" />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="filter-select"
        >
          <option value="">كل الإجراءات</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {error ? <AdminErrorState message={error} /> : null}
      <div className="table-wrap">
        <AdminDataTable rows={entries} columns={["الوقت", "الإجراء", "المورد", "المستخدم", "عنوان IP", "التفاصيل"]} loading={loading} error={error} empty="لا توجد سجلات تدقيق." renderRow={(e) => <>
            <td className="mono">{new Date(e.created_at).toLocaleString()}</td><td><AdminStatusBadge status={e.action} /></td><td>{e.resource || "—"}</td><td className="mono truncate">{e.user_id ? `${e.user_id.slice(0, 8)}…` : "النظام"}</td><td className="muted">{e.ip || "—"}</td><td><details><summary>عرض التفاصيل</summary><pre className="detail-json">{JSON.stringify(e.details, null, 2)}</pre></details></td>
                </>} />
      </div>

      <AdminPagination page={page} pageSize={PER_PAGE} total={total} onPageChange={setPage} />
      </AdminPageSection>
    </div>
  );
}
