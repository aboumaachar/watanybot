import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "../lib/api";
import { ManageableList, type ManageableListAdapter } from "../components/ManageableList";
import { executeBulkAction } from "../components/BulkActionFramework";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone?: string;
  created_at: string;
  last_login?: string | null;
  last_login_ip?: string | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch("/api/admin/users");
      const body = await res.json();
      setUsers(body.users ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateRole(userId: string, role: string) {
    try {
      await adminFetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      load();
    } catch (err) {
      console.error("Role update failed", err);
    }
  }

  async function updateStatus(userId: string, status: string) {
    try {
      await adminFetch(`/api/admin/users/${userId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      console.error("Status update failed", err);
    }
  }

  async function activateSelected() {
    if (selectedIds.length === 0 || bulkPending) return;
    setBulkPending(true);
    try {
      await executeBulkAction({
        id: "cms.user.status.active", label: "Activate selected", requiredPermission: "admin.users",
        executionMode: "perItem", payload: { status: "active" }, executeOne: async (id, payload) => updateStatus(id, payload.status),
        pending: bulkPending, successes: [], failures: [], partialFailure: false, refresh: load, auditContext: "cms.user",
      }, selectedIds);
      setSelectedIds([]);
    } finally { setBulkPending(false); }
  }

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h2>User Management</h2>
        <p className="muted">Manage accounts, roles, and access control.</p>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search users by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button type="button" className="ghost" onClick={load}>
          Refresh
        </button>
        <button type="button" className="ghost" onClick={() => void activateSelected()} disabled={selectedIds.length === 0 || bulkPending}>
          {bulkPending ? "Activating..." : "Activate selected"}
        </button>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        {loading ? <p className="muted center">Loading…</p> : filtered.length === 0 ? <p className="muted center">No users found.</p> : <ManageableList adapter={{
          featureId: "cms.user",
          domain: "CMS",
          title: "User Management",
          loadRows: async () => users,
          getRowId: (user) => user.id,
          columns: ["Name", "Email", "Role", "Status", "Created", "Last Login", "Last Login IP", "Actions"],
          renderRow: (u) => <>
                  <td className="strong">{u.name || "—"}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="role-select"
                    >
                      <option value="public">Public</option>
                      <option value="accredited">Accredited</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={`status-badge ${u.status}`}>{u.status}</span>
                  </td>
                  <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="muted">{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                  <td className="mono" dir="ltr">{u.last_login_ip || "—"}</td>
                  <td>
                    {u.status === "active" ? (
                      <button type="button" className="ghost sm danger" onClick={() => updateStatus(u.id, "banned")}>
                        Ban
                      </button>
                    ) : u.status === "banned" ? (
                      <button type="button" className="ghost sm" onClick={() => updateStatus(u.id, "active")}>
                        Unban
                      </button>
                    ) : null}
                  </td>
                </>
        } satisfies ManageableListAdapter<User>} rows={filtered} onSelectionChange={setSelectedIds} />}
      </div>
    </div>
  );
}
