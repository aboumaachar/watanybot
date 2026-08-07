import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "../lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone?: string;
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
        <button className="ghost" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="muted center">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted center">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id}>
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
                  <td>
                    {u.status === "active" ? (
                      <button className="ghost sm danger" onClick={() => updateStatus(u.id, "banned")}>
                        Ban
                      </button>
                    ) : u.status === "banned" ? (
                      <button className="ghost sm" onClick={() => updateStatus(u.id, "active")}>
                        Unban
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
