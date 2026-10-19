import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FEATURES } from "@watany/shared/features";
import { adminFetch, getAdminProfile, getApiUrl } from "../lib/api";
import {
  AdminConfirmDialog,
  AdminNotice,
  AdminPageHeader,
  AdminPageSection,
  AdminPagination,
  AdminSearchInput,
  AdminStatCard,
  AdminStatusBadge,
  AdminTableToolbar,
} from "../components/admin/AdminPrimitives";
import { CreateUserDrawer } from "../components/users/CreateUserDrawer";
import { ImportUsersDrawer } from "../components/users/ImportUsersDrawer";
import { UserManagementNav } from "../components/users/UserManagementNav";
import type { BulkPreview, BulkRequest, ManagedUser, UsersSummary } from "../components/users/user-management-types";

const EMPTY_SUMMARY: UsersSummary = {
  total: 0, active: 0, suspended: 0, banned: 0,
  logged_today: 0, never_logged_in: 0, inactive_30: 0,
};

const ROLE_LABELS: Record<string, string> = {
  public: "عام", accredited: "معتمد", driver: "سائق", moderator: "مشرف", admin: "مدير", superadmin: "مدير أعلى",
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("ar-LB") : "لم يسجل الدخول";
}
function resolveAvatarUrl(value?: string | null) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https:\/\//iu.test(url)) return url;
  return `${getApiUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}
export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [summary, setSummary] = useState<UsersSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const search = params.get("search") || "";
  const role = params.get("role") || "";
  const status = params.get("status") || "";
  const lastLogin = params.get("lastLogin") || "";
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = [25, 50, 100].includes(Number(params.get("limit"))) ? Number(params.get("limit")) : 25;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllResults, setSelectAllResults] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<BulkPreview | null>(null);
  const [pendingBulk, setPendingBulk] = useState<BulkRequest | null>(null);
  const [bulkRole, setBulkRole] = useState("public");
  const [canManageFeatureOverrides, setCanManageFeatureOverrides] = useState(false);
  const [bulkFeatureId, setBulkFeatureId] = useState(FEATURES.find((feature) => feature.canDisable)?.id || FEATURES[0].id);
  const [bulkFeatureMode, setBulkFeatureMode] = useState<"inherit" | "enabled" | "disabled">("inherit");

  const activeFilters = useMemo(() => ({ search, role, status, lastLogin }), [lastLogin, role, search, status]);

  const updateFilters = useCallback((updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    if (!("page" in updates)) next.set("page", "1");
    setParams(next);
  }, [params, setParams]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
      if (search) query.set("search", search);
      if (role) query.set("role", role);
      if (status) query.set("status", status);
      if (lastLogin) query.set("lastLogin", lastLogin);
      const [listResponse, summaryResponse] = await Promise.all([
        adminFetch(`/api/admin/users?${query}`),
        adminFetch("/api/admin/users/summary"),
      ]);
      const listBody = await listResponse.json();
      const summaryBody = await summaryResponse.json();
      if (!listResponse.ok) throw new Error(listBody.error || "تعذر تحميل المستخدمين");
      if (!summaryResponse.ok) throw new Error(summaryBody.error || "تعذر تحميل ملخص المستخدمين");
      setUsers(listBody.users || []);
      setTotal(Number(listBody.total || 0));
      setSummary({ ...EMPTY_SUMMARY, ...(summaryBody.summary || {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المستخدمين");
    } finally {
      setLoading(false);
    }
  }, [lastLogin, page, pageSize, role, search, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    void getAdminProfile()
      .then((profile) => { if (active) setCanManageFeatureOverrides(profile.role === "superadmin"); })
      .catch(() => { if (active) setCanManageFeatureOverrides(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { setSelectedIds([]); setSelectAllResults(false); }, [search, role, status, lastLogin, page, pageSize]);
  const pageIds = users.map((user) => user.id);
  const pageFullySelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const selectedCount = selectAllResults ? total : selectedIds.length;
  const singleSelectedUser = !selectAllResults && selectedIds.length === 1 ? users.find((user) => user.id === selectedIds[0]) || null : null;

  function togglePage(checked: boolean) {
    setSelectAllResults(false);
    setSelectedIds(checked ? pageIds : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectAllResults(false);
    setSelectedIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id));
  }

  function openProfile(id: string, initialTab = "overview") {
    navigate(`/users/${encodeURIComponent(id)}${initialTab === "overview" ? "" : `?tab=${encodeURIComponent(initialTab)}`}`);
  }

  function buildBulkRequest(action: BulkRequest["action"], value?: string): BulkRequest {
    return {
      ...(selectAllResults ? { filters: activeFilters } : { ids: selectedIds }),
      action,
      ...(value ? { value } : {}),
      dryRun: true,
    };
  }

  async function previewBulk(action: BulkRequest["action"], value?: string) {
    if (selectedCount === 0 || bulkBusy) return;
    const request = buildBulkRequest(action, value);
    setBulkBusy(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/users/bulk", { method: "POST", body: JSON.stringify(request) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر معاينة العملية الجماعية");
      setBulkPreview(body.preview);
      setPendingBulk(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر معاينة العملية الجماعية");
    } finally {
      setBulkBusy(false);
    }
  }
  async function previewBulkFeature() {
    if (selectedCount === 0 || bulkBusy || !canManageFeatureOverrides) return;
    const featureOverride = bulkFeatureMode === "inherit" ? null : bulkFeatureMode === "enabled";
    const request: BulkRequest = {
      ...(selectAllResults ? { filters: activeFilters } : { ids: selectedIds }),
      action: "feature",
      featureId: bulkFeatureId,
      featureOverride,
      dryRun: true,
    };
    setBulkBusy(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/users/bulk", { method: "POST", body: JSON.stringify(request) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر معاينة تعديل الميزات");
      setBulkPreview(body.preview);
      setPendingBulk(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر معاينة تعديل الميزات");
    } finally {
      setBulkBusy(false);
    }
  }

  async function applyBulk() {
    if (!pendingBulk || bulkBusy) return;
    setBulkBusy(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/users/bulk", {
        method: "POST",
        body: JSON.stringify({ ...pendingBulk, ...(pendingBulk.action === "delete" ? { confirmDelete: true } : {}), dryRun: false }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر تنفيذ العملية الجماعية");
      setPendingBulk(null);
      setBulkPreview(null);
      setSelectedIds([]);
      setSelectAllResults(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية الجماعية");
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportCurrent() {
    setError("");
    try {
      const query = new URLSearchParams();
      if (search) query.set("search", search);
      if (role) query.set("role", role);
      if (status) query.set("status", status);
      if (lastLogin) query.set("lastLogin", lastLogin);
      const response = await adminFetch(`/api/admin/users/export.csv?${query}`);
      if (!response.ok) throw new Error("تعذر تصدير المستخدمين");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `watany-users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تصدير المستخدمين");
    }
  }
  const clearFilters = () => setParams(new URLSearchParams({ page: "1", limit: String(pageSize) }));
  const hasFilters = Boolean(search || role || status || lastLogin);

  return (
    <div className="users-management-page users-management-compact" data-users-surface="20260921-v2">
      <AdminPageHeader
        title="إدارة المستخدمين"
        description="إدارة الحسابات والأدوار وحالات الوصول والجلسات وسجل الدخول من سطح واحد، مع عمليات جماعية قابلة للمعاينة والتدقيق."
        actions={<>
          <button type="button" className="accent" onClick={() => setCreateOpen(true)}>+ إضافة مستخدم</button>
          <button type="button" className="ghost" onClick={() => setImportOpen(true)}>استيراد CSV</button>
          <button type="button" className="ghost" onClick={() => void exportCurrent()}>تصدير CSV</button>
          <button type="button" className="ghost" onClick={() => void load()}>تحديث</button>
        </>}
      />

      <UserManagementNav />

      <div className="admin-stat-grid users-stat-grid">
        <button type="button" className="user-stat-button" onClick={() => clearFilters()}><AdminStatCard label="إجمالي المستخدمين" value={summary.total} detail="جميع الحسابات" /></button>
        <button type="button" className="user-stat-button" onClick={() => updateFilters({ status: "active" })}><AdminStatCard label="النشطون" value={summary.active} detail="حسابات متاحة" /></button>
        <button type="button" className="user-stat-button" onClick={() => updateFilters({ status: "suspended" })}><AdminStatCard label="الموقوفون" value={summary.suspended} detail="وصول موقوف" /></button>
        <button type="button" className="user-stat-button" onClick={() => updateFilters({ status: "banned" })}><AdminStatCard label="المحظورون" value={summary.banned} detail="وصول محظور" /></button>
        <button type="button" className="user-stat-button" onClick={() => updateFilters({ lastLogin: "today" })}><AdminStatCard label="دخلوا اليوم" value={summary.logged_today} detail="نشاط اليوم" /></button>
        <button type="button" className="user-stat-button" onClick={() => updateFilters({ lastLogin: "inactive30" })}><AdminStatCard label="غير نشطين 30 يوماً" value={summary.inactive_30} detail={`${summary.never_logged_in} لم يسجلوا الدخول`} /></button>
      </div>

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      <AdminPageSection title="قائمة المستخدمين" description="البحث يشمل الاسم والبريد والهاتف ومعرّف المستخدم. حالة التصفية محفوظة في رابط الصفحة.">
        <AdminTableToolbar resultCount={total} onClear={hasFilters ? clearFilters : undefined}>
          <AdminSearchInput value={search} onChange={(value) => updateFilters({ search: value })} placeholder="البحث بالاسم أو البريد أو الهاتف أو المعرّف" />
          <select value={role} onChange={(event) => updateFilters({ role: event.target.value })} aria-label="التصفية حسب الدور">
            <option value="">كل الأدوار</option>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={status} onChange={(event) => updateFilters({ status: event.target.value })} aria-label="التصفية حسب الحالة">
            <option value="">كل الحالات</option><option value="active">نشط</option><option value="suspended">موقوف</option><option value="banned">محظور</option>
          </select>
          <select value={lastLogin} onChange={(event) => updateFilters({ lastLogin: event.target.value })} aria-label="التصفية حسب آخر دخول">
            <option value="">كل أوقات الدخول</option><option value="today">دخل اليوم</option><option value="never">لم يسجل الدخول</option><option value="inactive30">غير نشط 30 يوماً</option><option value="inactive90">غير نشط 90 يوماً</option>
          </select>
          <select value={pageSize} onChange={(event) => updateFilters({ limit: event.target.value, page: "1" })} aria-label="عدد النتائج في الصفحة"><option value="25">25</option><option value="50">50</option><option value="100">100</option></select>
        </AdminTableToolbar>

        <div id="bulk-operations" className="users-selection-toolbar" role="region" aria-label="التحديد الجماعي للمستخدمين">
          <div><strong>التحديد الجماعي</strong><span>{selectedCount > 0 ? `تم تحديد ${selectedCount} مستخدم` : "لم يتم تحديد مستخدمين بعد"}</span></div>
          <div className="users-selection-actions">
            <button type="button" className="ghost sm" disabled={loading || users.length === 0} onClick={() => togglePage(true)}>تحديد الصفحة ({users.length})</button>
            <button type="button" className="ghost sm" disabled={loading || total === 0} onClick={() => { setSelectedIds(pageIds); setSelectAllResults(true); }}>تحديد جميع النتائج ({total})</button>
            <button type="button" className="ghost sm" disabled={selectedCount === 0} onClick={() => { setSelectedIds([]); setSelectAllResults(false); }}>إلغاء التحديد</button>
          </div>
        </div>

        {singleSelectedUser ? <section className="users-selected-command-center" role="region" aria-label="وظائف إدارة المستخدم المحدد">
          <div className="users-selected-user-summary">
            <div className="users-selected-avatar">{resolveAvatarUrl(singleSelectedUser.avatar_url) ? <img src={resolveAvatarUrl(singleSelectedUser.avatar_url)} alt="" /> : <span>{(singleSelectedUser.name || singleSelectedUser.email || "U").slice(0, 1).toUpperCase()}</span>}</div>
            <div><strong>{singleSelectedUser.name || "—"}</strong><span dir="ltr">{singleSelectedUser.email || singleSelectedUser.phone || singleSelectedUser.id}</span><small>اختر مهمة لإدارة هذا المستخدم. تفتح جميع المهام في صفحة المستخدم المستقلة.</small></div>
          </div>
          <div className="users-selected-task-actions">
            <button type="button" className="accent" onClick={() => openProfile(singleSelectedUser.id)}>فتح صفحة المستخدم</button>
            <button type="button" className="ghost" onClick={() => openProfile(singleSelectedUser.id, "network")}>الشبكة والعنوان</button>
            <button type="button" className="ghost" onClick={() => openProfile(singleSelectedUser.id, "privileges")}>امتيازات الخدمات</button>
            <button type="button" className="ghost" onClick={() => openProfile(singleSelectedUser.id, "access")}>الدور والوصول</button>
            <button type="button" className="ghost" onClick={() => openProfile(singleSelectedUser.id, "features")}>الميزات</button>
            <button type="button" className="ghost" onClick={() => openProfile(singleSelectedUser.id, "security")}>الأمان والدخول</button>
            <button type="button" className="ghost" onClick={() => openProfile(singleSelectedUser.id, "sessions")}>الجلسات</button>
            {canManageFeatureOverrides ? <button type="button" className="user-row-delete" onClick={() => openProfile(singleSelectedUser.id, "danger")}>حذف الحساب</button> : null}
          </div>
        </section> : null}

        {selectedCount > 0 ? <div className="users-bulk-bar" role="region" aria-label="إجراءات جماعية">
          <strong>تم تحديد {selectedCount} مستخدم</strong>
          <button type="button" className="ghost sm" disabled={bulkBusy} onClick={() => void previewBulk("status", "active")}>تفعيل</button>
          <button type="button" className="ghost sm" disabled={bulkBusy} onClick={() => void previewBulk("status", "suspended")}>إيقاف</button>
          <button type="button" className="ghost sm" disabled={bulkBusy} onClick={() => void previewBulk("revoke_sessions")}>إنهاء الجلسات</button>
          <span className="users-bulk-role"><select value={bulkRole} onChange={(event) => setBulkRole(event.target.value)} aria-label="الدور الجماعي">{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" className="ghost sm" disabled={bulkBusy} onClick={() => void previewBulk("role", bulkRole)}>تغيير الدور</button></span>
          {canManageFeatureOverrides ? <button type="button" className="users-bulk-delete" disabled={bulkBusy} onClick={() => void previewBulk("delete")}>حذف المحدد</button> : null}
          {canManageFeatureOverrides ? <span className="users-bulk-feature">
            <select value={bulkFeatureId} onChange={(event) => setBulkFeatureId(event.target.value as typeof bulkFeatureId)} aria-label="الميزة الجماعية">{FEATURES.map((feature) => <option key={feature.id} value={feature.id}>{feature.label}</option>)}</select>
            <select value={bulkFeatureMode} onChange={(event) => setBulkFeatureMode(event.target.value as "inherit" | "enabled" | "disabled")} aria-label="وضع الميزة الجماعي">
              <option value="inherit">توريث العام</option><option value="enabled">تفعيل</option><option value="disabled" disabled={!FEATURES.find((feature) => feature.id === bulkFeatureId)?.canDisable}>حظر</option>
            </select>
            <button type="button" className="ghost sm" disabled={bulkBusy} onClick={() => void previewBulkFeature()}>تطبيق ميزة</button>
          </span> : null}
          <button type="button" className="ghost sm" onClick={() => { setSelectedIds([]); setSelectAllResults(false); }}>إلغاء التحديد</button>
        </div> : null}

        {pageFullySelected && total > users.length && !selectAllResults ? <div className="users-select-all-banner">
          تم تحديد كل مستخدمي هذه الصفحة ({users.length}).
          <button type="button" className="link-button" onClick={() => setSelectAllResults(true)}>تحديد جميع النتائج المطابقة ({total})</button>
        </div> : null}
        {selectAllResults ? <div className="users-select-all-banner"><strong>تم تحديد جميع النتائج المطابقة للفلاتر ({total}).</strong><button type="button" className="link-button" onClick={() => { setSelectAllResults(false); setSelectedIds(pageIds); }}>العودة لتحديد الصفحة فقط</button></div> : null}

        <div className="admin-data-table-wrap">
          <table className="admin-data-table users-table">
            <caption className="sr-only">قائمة إدارة المستخدمين</caption>
            <thead><tr>
              <th scope="col"><input type="checkbox" aria-label="تحديد كل مستخدمي الصفحة" checked={pageFullySelected || selectAllResults} onChange={(event) => togglePage(event.target.checked)} /></th>
              <th scope="col">المستخدم</th><th scope="col">الحالة</th><th scope="col">الدور</th><th scope="col">آخر دخول</th><th scope="col">عنوان IP</th><th scope="col">تاريخ الإنشاء</th><th scope="col">الإجراءات</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="admin-state">جارٍ التحميل...</td></tr> : users.length === 0 ? <tr><td colSpan={8} className="admin-state">لا توجد نتائج مطابقة.</td></tr> : users.map((user) => (
                <tr key={user.id} className="users-row" onClick={() => openProfile(user.id)}>
                  <td onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`تحديد ${user.name || user.email || user.id}`} checked={selectAllResults || selectedIds.includes(user.id)} onChange={(event) => toggleOne(user.id, event.target.checked)} /></td>
                  <td><button type="button" className="user-identity-button" onClick={() => openProfile(user.id)}>{resolveAvatarUrl(user.avatar_url) ? <img className="users-table-avatar" src={resolveAvatarUrl(user.avatar_url)} alt="" /> : <span className="users-table-avatar users-table-avatar-placeholder">{(user.name || user.email || "U").slice(0, 1).toUpperCase()}</span>}<span className="user-identity-copy"><strong>{user.name || "—"}</strong><span dir="ltr">{user.email || user.phone || user.id}</span></span></button></td>
                  <td><AdminStatusBadge status={user.status} /></td>
                  <td>{ROLE_LABELS[user.role] || user.role}</td>
                  <td className="muted">{formatDate(user.last_login)}</td>
                  <td className="mono" dir="ltr">{user.last_login_ip || "—"}</td>
                  <td className="muted">{new Date(user.created_at).toLocaleDateString("ar-LB")}</td>
                  <td onClick={(event) => event.stopPropagation()}><div className="users-row-actions"><button type="button" className="ghost sm" onClick={() => openProfile(user.id)}>فتح الملف</button>{canManageFeatureOverrides ? <button type="button" className="user-row-delete" onClick={() => openProfile(user.id, "danger")}>حذف الحساب</button> : null}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => updateFilters({ page: String(nextPage) })} />
      </AdminPageSection>

      {createOpen ? <CreateUserDrawer onClose={() => setCreateOpen(false)} onCreated={() => void load()} /> : null}
      {importOpen ? <ImportUsersDrawer onClose={() => setImportOpen(false)} onImported={() => void load()} /> : null}
      {pendingBulk && bulkPreview ? <AdminConfirmDialog
        title={pendingBulk.action === "delete" ? "تأكيد حذف المستخدمين" : "تأكيد العملية الجماعية"}
        message={bulkPreview.blocked
          ? `تعذر تنفيذ العملية: ${bulkPreview.blockReason || "محظورة من الخادم"}.`
          : pendingBulk.action === "delete"
            ? `سيتم حذف ${bulkPreview.affected} حساب نهائياً. لا يمكن التراجع عن هذه العملية. رقم التتبع: ${bulkPreview.correlationId}.`
            : `سيتم تطبيق العملية على ${bulkPreview.affected} مستخدم. رقم التتبع: ${bulkPreview.correlationId}.`}
        confirmLabel={bulkBusy ? "جارٍ التنفيذ..." : pendingBulk.action === "delete" ? "حذف نهائي" : "تنفيذ"}
        danger={pendingBulk.action === "delete"}
        onCancel={() => { setPendingBulk(null); setBulkPreview(null); }}
        onConfirm={() => { if (!bulkPreview.blocked) void applyBulk(); }}
      /> : null}
    </div>
  );
}
