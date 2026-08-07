import React, { useEffect, useMemo, useState } from "react";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./superadminUsers.css";

type UserRow = {
  id: string;
  displayName: string;
  username?: string;
  email?: string;
  phone?: string;
  roles: string[];
  status: string;
  birthDate?: string;
  birthdayLabel?: string;
  lastSeenAt?: string;
  isActiveNow: boolean;
  lastKnownIp?: string;
  registrationIp?: string;
  ipCount?: number;
  createdAt?: string;
};

type Dashboard = {
  users: UserRow[];
  activeUsers: {
    activeNow: number;
    activeLast15Minutes: number;
    activeToday: number;
    generatedAt: string;
  };
  birthdays: {
    today: UserRow[];
    upcoming: UserRow[];
    generatedAt: string;
  };
  totalUsers: number;
};

const emptyDashboard: Dashboard = {
  users: [],
  activeUsers: { activeNow: 0, activeLast15Minutes: 0, activeToday: 0, generatedAt: "" },
  birthdays: { today: [], upcoming: [], generatedAt: "" },
  totalUsers: 0,
};

const roleOptions = [
  { value: "USER", label: "مستخدم" },
  { value: "DRIVER", label: "سائق تاكسي" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPERADMIN", label: "Superadmin" },
];

export default function SuperadminUsersPage() {
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [roleSavingUserId, setRoleSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (status) params.set("status", status);
        if (role) params.set("role", role);

        const response = await fetch(`/api/superadmin/users?${params.toString()}`, {
          headers: {
            Accept: "application/json",
            // Dev-only preview guard. Real production guard must come from auth/RBAC.
            "x-watany-role": "SUPERADMIN",
          },
        });

        if (!response.ok) {
          throw new Error(`SUPERADMIN_USERS_${response.status}`);
        }

        const payload = (await response.json()) as Dashboard;
        if (active) {
          setDashboard(payload);
          setError("");
        }
      } catch {
        if (active) {
          setDashboard(emptyDashboard);
          setError("تعذر تحميل لوحة المستخدمين. تأكد أن صلاحيات المشرف العام والـ API مفعّلة.");
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [query, status, role]);

  const birthdayNames = useMemo(
    () => dashboard.birthdays.today.map((u) => u.displayName).join("، "),
    [dashboard.birthdays.today]
  );

  async function assignRole(user: UserRow, nextRole: string) {
    setRoleSavingUserId(user.id);
    try {
      const response = await fetch(`/api/superadmin/users/${encodeURIComponent(user.id)}/role`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-watany-role": "SUPERADMIN",
        },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!response.ok) {
        throw new Error(`SUPERADMIN_USER_ROLE_${response.status}`);
      }

      const payload = (await response.json()) as { user?: UserRow };
      setDashboard((current) => ({
        ...current,
        users: current.users.map((currentUser) => currentUser.id === user.id ? (payload.user ?? { ...currentUser, roles: [nextRole] }) : currentUser),
      }));
      setError("");
    } catch {
      setError("تعذر تحديث دور المستخدم. تأكد أن صلاحيات المشرف العام مفعّلة.");
    } finally {
      setRoleSavingUserId(null);
    }
  }

  return (
    <main dir="rtl" className="su-page">
      <section className="su-hero">
        <p className="su-eyebrow">Superadmin</p>
        <h1>إدارة مستخدمي التطبيق</h1>
        <p>
          لوحة إدارة على نمط vBulletin: بحث، فلاتر، حالة المستخدم، عناوين IP، أعياد الميلاد،
          وعدد المستخدمين النشطين.
        </p>
      </section>

      <section className="su-stats-grid">
        <article className="su-stat-card">
          <span>المستخدمون</span>
          <strong>{dashboard.totalUsers}</strong>
        </article>
        <article className="su-stat-card">
          <span>نشط الآن</span>
          <strong>{dashboard.activeUsers.activeNow}</strong>
        </article>
        <article className="su-stat-card">
          <span>نشط خلال 15 دقيقة</span>
          <strong>{dashboard.activeUsers.activeLast15Minutes}</strong>
        </article>
        <article className="su-stat-card">
          <span>أعياد ميلاد اليوم</span>
          <strong>{dashboard.birthdays.today.length}</strong>
        </article>
      </section>

      {birthdayNames && (
        <section className="su-birthday-strip">
          🎂 أعياد ميلاد اليوم: {birthdayNames}
        </section>
      )}

      <section className="su-filters">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث بالاسم، البريد، الهاتف، أو اسم المستخدم"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="SUSPENDED">معلّق</option>
          <option value="BANNED">محظور</option>
          <option value="PENDING">قيد المراجعة</option>
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">كل الأدوار</option>
          {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </section>

      {error && <section className="su-error">{error}</section>}

      <section className="su-table-wrap">
        <table className="su-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الحالة</th>
              <th>الأدوار</th>
              <th>آخر نشاط</th>
              <th>IP الأخير</th>
              <th>عيد الميلاد</th>
              <th>إدارة</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.users.map((user) => (
              <tr key={user.id}>
                <td data-label="المستخدم">
                  <strong>{user.displayName}</strong>
                  <small>{user.username || user.email || user.phone || user.id}</small>
                </td>
                <td data-label="الحالة">
                  <span className={`su-status su-status--${user.status.toLowerCase()}`}>
                    {user.status}
                  </span>
                </td>
                <td data-label="الأدوار">{user.roles.join(", ")}</td>
                <td data-label="آخر نشاط">{user.lastSeenAt || "غير متوفر"}</td>
                <td data-label="IP الأخير">{user.lastKnownIp || "غير متوفر"}</td>
                <td data-label="عيد الميلاد">{user.birthdayLabel || user.birthDate || "غير متوفر"}</td>
                <td data-label="إدارة">
                  <div className="su-actions">
                    <label className="su-role-control">
                      <span>الدور</span>
                      <select
                        value={user.roles.includes("DRIVER") ? "DRIVER" : user.roles.includes("SUPERADMIN") ? "SUPERADMIN" : user.roles.includes("ADMIN") ? "ADMIN" : "USER"}
                        onChange={(event) => assignRole(user, event.target.value)}
                        disabled={roleSavingUserId === user.id}
                      >
                        {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={() => assignRole(user, "DRIVER")} disabled={roleSavingUserId === user.id || user.roles.includes("DRIVER")}>تفعيل السائق</button>
                  </div>
                </td>
              </tr>
            ))}
            {dashboard.users.length === 0 && (
              <tr>
                <td colSpan={7} className="su-empty">
                  لا توجد بيانات مستخدمين متاحة أو لم يتم ربط قاعدة المستخدمين بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="su-policy">
        <strong>تنبيه خصوصية:</strong> عناوين IP يجب أن تظهر للمشرف العام فقط ولأغراض الحماية
        والتدقيق ومنع إساءة الاستخدام.
      </section>
    </main>
  );
}
