import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { adminFetch } from "../lib/api";
import { ManageableList, type ManageableListAdapter } from "../components/ManageableList";
import { executeBulkAction } from "../components/BulkActionFramework";
import { AdminConfirmDialog, AdminDetailDrawer, AdminPageHeader, AdminPagination, AdminSearchInput, AdminStatusBadge } from "../components/admin/AdminPrimitives";

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
      <AdminPageHeader title="إدارة المستخدمين" description="حسابات المستخدمين وأدوارهم وحالات الوصول مملوكة لـ Gateway. لا تتم إعادة إنشاء السجلات المحمية للاختبار." />

      <div className="toolbar">
        <AdminSearchInput value={search} onChange={(value) => setParams({ search: value, page: "1", limit: String(pageSize) })} placeholder="البحث بالاسم أو البريد الإلكتروني" />
        <select value={roleFilter} onChange={(event) => setParams({ search, role: event.target.value, status: statusFilter, page: "1", limit: String(pageSize) })} aria-label="التصفية حسب الدور"><option value="">كل الأدوار</option><option value="public">عام</option><option value="accredited">معتمد</option><option value="driver">سائق</option><option value="moderator">مشرف</option><option value="admin">مسؤول</option><option value="superadmin">مسؤول أعلى</option></select>
        <select value={statusFilter} onChange={(event) => setParams({ search, role: roleFilter, status: event.target.value, page: "1", limit: String(pageSize) })} aria-label="التصفية حسب الحالة"><option value="">كل الحالات</option><option value="active">نشط</option><option value="suspended">موقوف</option><option value="banned">محظور</option></select>
        <button type="button" className="ghost" onClick={load}>
          تحديث
        </button>
        <button type="button" className="ghost" onClick={() => void activateSelected()} disabled={selectedIds.length === 0 || bulkPending}>
          {bulkPending ? "جارٍ التفعيل..." : "تفعيل المحدد"}
        </button>
      </div>

      {error && <div className="alert" role="alert">{error}</div>}

      <div className="table-wrap">
        {loading ? <p className="muted center">جارٍ التحميل...</p> : users.length === 0 ? <p className="muted center">لا يوجد مستخدمون.</p> : <ManageableList adapter={{
          featureId: "cms.user",
          domain: "CMS",
          title: "إدارة المستخدمين",
          loadRows: async () => users,
          getRowId: (user) => user.id,
          columns: ["الاسم", "البريد الإلكتروني", "الدور", "الحالة", "تاريخ الإنشاء", "آخر دخول", "عنوان IP لآخر دخول", "الإجراءات"],
          renderRow: (u) => <>
                  <td className="strong" dir={/[\u0600-\u06ff]/u.test(u.name) ? "rtl" : "ltr"}>{u.name || "—"}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => setPendingAction({ userId: u.id, type: "role", value: e.target.value })}
                      className="role-select"
                    >
                      <option value="public">عام</option>
                      <option value="accredited">معتمد</option>
                      <option value="moderator">مشرف</option>
                      <option value="admin">مدير</option>
                      <option value="superadmin">مدير أعلى</option>
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
                        حظر
                      </button>
                    ) : u.status === "banned" ? (
                      <button type="button" className="ghost sm" onClick={() => setPendingAction({ userId: u.id, type: "status", value: "active" })}>
                        إلغاء الحظر
                      </button>
                    ) : null}
                    <button type="button" className="ghost sm" onClick={() => setSelectedUser(u)}>التفاصيل</button>
                  </td>
                </>
        } satisfies ManageableListAdapter<User>} rows={users} onSelectionChange={setSelectedIds} />}
      </div>
      <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => setParams({ search, role: roleFilter, status: statusFilter, page: String(nextPage), limit: String(pageSize) })} />
      {selectedUser ? <AdminDetailDrawer title={selectedUser.name || selectedUser.email} onClose={() => setSelectedUser(null)}><p>{selectedUser.email}</p><p>الدور: {selectedUser.role}</p><p>الحالة: <AdminStatusBadge status={selectedUser.status} /></p><p>تاريخ الإنشاء: {new Date(selectedUser.created_at).toLocaleString()}</p><p>آخر دخول: {selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : "لم يسجل الدخول"}</p></AdminDetailDrawer> : null}
      {pendingAction ? <AdminConfirmDialog title={pendingAction.type === "role" ? "تأكيد تغيير الدور" : "تأكيد تغيير الحالة"} message={`هل تريد تطبيق ${pendingAction.value} على هذا المستخدم؟ تبقى قواعد الأمان من جهة الخادم سارية.`} confirmLabel="تطبيق" onCancel={() => setPendingAction(null)} onConfirm={() => { const action = pendingAction; setPendingAction(null); void (action.type === "role" ? updateRole(action.userId, action.value) : updateStatus(action.userId, action.value)); }} /> : null}
    </div>
  );
}
