import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "../lib/api";

type AuditEntry = {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  ip?: string;
  created_at: string;
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PER_PAGE), offset: String((page - 1) * PER_PAGE) });
      if (actionFilter) params.set("action", actionFilter);
      const res = await adminFetch(`/api/admin/audit?${params}`);
      const body = await res.json();
      setEntries(body.entries ?? []);
    } catch (err) {
      console.error("Failed to load audit log", err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = entries.filter(
    (e) =>
      !search ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.resource.toLowerCase().includes(search.toLowerCase()) ||
      e.user_id.includes(search)
  );

  const actions = [...new Set(entries.map((e) => e.action))];

  return (
    <div>
      <div className="page-header">
        <h2>Audit Log</h2>
        <p className="muted">Searchable history of all administrative and system actions.</p>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search actions, resources, user ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="filter-select"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button className="ghost" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Resource</th>
              <th>User</th>
              <th>IP</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="muted center">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted center">No audit entries.</td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{new Date(e.created_at).toLocaleString()}</td>
                  <td><span className="action-tag">{e.action}</span></td>
                  <td>{e.resource || "—"}</td>
                  <td className="mono truncate">{e.user_id.slice(0, 8)}…</td>
                  <td className="muted">{e.ip || "—"}</td>
                  <td>
                    <details>
                      <summary className="ghost sm">View</summary>
                      <pre className="detail-json">{JSON.stringify(e.details, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          ← Previous
        </button>
        <span className="muted">Page {page}</span>
        <button className="ghost" disabled={entries.length < PER_PAGE} onClick={() => setPage(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
