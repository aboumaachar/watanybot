import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { adminFetch } from "../lib/api";
import { ManageableList, type ManageableListAdapter } from "../components/ManageableList";
import { executeBulkAction } from "../components/BulkActionFramework";
import { AdminConfirmDialog, AdminDataTable, AdminDetailDrawer, AdminPagination, AdminSearchInput, AdminStatusBadge } from "../components/admin/AdminPrimitives";

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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const roleFilter = params.get("role") || "";
  const statusFilter = params.get("status") || "";
  const page = Number(params.get("page") || 1);
  const pageSize = Number(params.get("limit") || 25);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pendingAction, setPendingAction] = useState<{ userId: string; type: "role" | "status"; value: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
      if (search) query.set("search", search);
      if (roleFilter) query.set("role", roleFilter);
      if (statusFilter) query.set("status", statusFilter);
      const res = await adminFetch(`/api/admin/users?${query}`);
      const body = await res.json();
      setUsers(body.users ?? []);
      setTotal(Number(body.total ?? 0));
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, roleFilter, search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateRole(userId: string, role: string) {
    try {
      await adminFetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      await load();
      setSelectedUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role update failed");
    }
  }

  async function updateStatus(userId: string, status: string) {
    try {
      await adminFetch(`/api/admin/users/${userId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await load();
      setSelectedUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
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

  return (
    <div>
      <div className="page-header">
        <h2>User Management</h2>
        <p className="muted">Manage accounts, roles, and access control.</p>
      </div>

      <div className="toolbar">
        <AdminSearchInput value={search} onChange={(value) => setParams({ search: value, page: "1", limit: String(pageSize) })} placeholder="Search users by name or email" />
        <select value={roleFilter} onChange={(event) => setParams({ search, role: event.target.value, status: statusFilter, page: "1", limit: String(pageSize) })} aria-label="Filter by role"><option value="">All roles</option><option value="public">Public</option><option value="accredited">Accredited</option><option value="driver">Driver</option><option value="moderator">Moderator</option><option value="admin">Admin</option><option value="superadmin">Super Admin</option></select>
        <select value={statusFilter} onChange={(event) => setParams({ search, role: roleFilter, status: event.target.value, page: "1", limit: String(pageSize) })} aria-label="Filter by status"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option></select>
        <button type="button" className="ghost" onClick={load}>
          Refresh
        </button>
        <button type="button" className="ghost" onClick={() => void activateSelected()} disabled={selectedIds.length === 0 || bulkPending}>
          {bulkPending ? "Activating..." : "Activate selected"}
        </button>
      </div>

      {error && <div className="alert" role="alert">{error}</div>}

      <div className="table-wrap">
        {loading ? <p className="muted center">Loading…</p> : users.length === 0 ? <p className="muted center">No users found.</p> : <ManageableList adapter={{
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
                      onChange={(e) => setPendingAction({ userId: u.id, type: "role", value: e.target.value })}
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
                    <AdminStatusBadge status={u.status} />
                  </td>
                  <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="muted">{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                  <td className="mono" dir="ltr">{u.last_login_ip || "—"}</td>
                  <td>
                    {u.status === "active" ? (
                      <button type="button" className="ghost sm danger" onClick={() => setPendingAction({ userId: u.id, type: "status", value: "banned" })}>
                        Ban
                      </button>
                    ) : u.status === "banned" ? (
                      <button type="button" className="ghost sm" onClick={() => setPendingAction({ userId: u.id, type: "status", value: "active" })}>
                        Unban
                      </button>
                    ) : null}
                    <button type="button" className="ghost sm" onClick={() => setSelectedUser(u)}>Details</button>
                  </td>
                </>
        } satisfies ManageableListAdapter<User>} rows={users} onSelectionChange={setSelectedIds} />}
      </div>
      <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => setParams({ search, role: roleFilter, status: statusFilter, page: String(nextPage), limit: String(pageSize) })} />
      {selectedUser ? <AdminDetailDrawer title={selectedUser.name || selectedUser.email} onClose={() => setSelectedUser(null)}><p>{selectedUser.email}</p><p>Role: {selectedUser.role}</p><p>Status: <AdminStatusBadge status={selectedUser.status} /></p><p>Created: {new Date(selectedUser.created_at).toLocaleString()}</p><p>Last login: {selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : "Never"}</p></AdminDetailDrawer> : null}
      {pendingAction ? <AdminConfirmDialog title={pendingAction.type === "role" ? "Confirm role change" : "Confirm status change"} message={`Apply ${pendingAction.value} to this user? Server-side safety rules still apply.`} confirmLabel="Apply" onCancel={() => setPendingAction(null)} onConfirm={() => { const action = pendingAction; setPendingAction(null); void (action.type === "role" ? updateRole(action.userId, action.value) : updateStatus(action.userId, action.value)); }} /> : null}
    </div>
  );
}
