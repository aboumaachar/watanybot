import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { adminFetch } from "../../lib/api";
import { AdminDetailDrawer, AdminLoadingState, AdminNotice, AdminStatusBadge, AdminTabs } from "../admin/AdminPrimitives";
import type { UserManagementDetail } from "./user-management-types";

const ROLE_OPTIONS = [
  ["public", "عام"],
  ["accredited", "معتمد"],
  ["driver", "سائق"],
  ["moderator", "مشرف"],
  ["admin", "مدير"],
  ["superadmin", "مدير أعلى"],
] as const;

const FEATURE_CATEGORY_LABELS: Record<string, string> = {
  core: "الأساسيات",
  services: "الخدمات",
  communication: "الاتصال والصوت",
  account: "الحساب",
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("ar-LB") : "—";
}

function deleteReasonLabel(reason?: string | null) {
  const labels: Record<string, string> = {
    SUPERADMIN_REQUIRED_FOR_USER_DELETE: "حذف الحسابات محصور بالمدير الأعلى.",
    CANNOT_DELETE_OWN_ACCOUNT: "لا يمكن حذف الحساب الذي تستخدمه حالياً.",
    CONFIGURED_ADMIN_ACCOUNT_PROTECTED: "هذا حساب إدارة محمي بإعدادات النظام ولا يمكن حذفه من لوحة المستخدمين.",
    CANNOT_DELETE_LAST_ACTIVE_ADMINISTRATOR: "لا يمكن حذف آخر حساب إداري نشط.",
  };
  return reason ? labels[reason] || reason : "";
}

export function UserManagementDrawer({ userId, onClose, onChanged, initialTab = "overview" }: { userId: string; onClose: () => void; onChanged: () => void; initialTab?: string }) {
  const [detail, setDetail] = useState<UserManagementDetail | null>(null);
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileRank, setProfileRank] = useState("");
  const [profileMilitaryId, setProfileMilitaryId] = useState("");
  const [profileRegion, setProfileRegion] = useState("");
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, boolean | null>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch(`/api/admin/users/${userId}/management`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر تحميل ملف المستخدم");
      setDetail(body);
      setProfileName(body.user?.name || "");
      setProfileEmail(body.user?.email || "");
      setProfilePhone(body.user?.phone || "");
      setProfileRank(body.user?.rank || "");
      setProfileMilitaryId(body.user?.military_id || "");
      setProfileRegion(body.user?.region || "");
      setFeatureOverrides(Object.fromEntries((body.features || []).map((feature: { id: string; override: boolean | null }) => [feature.id, feature.override])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل ملف المستخدم");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setTab(initialTab);
    setDeleteConfirmation("");
  }, [initialTab, userId]);
  useEffect(() => { void load(); }, [load]);

  async function mutate(url: string, options: RequestInit) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await adminFetch(url, options);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "تعذر تنفيذ العملية");
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!detail?.user || busy || !detail.canDeleteUser) return;
    setBusy(true);
    setError("");
    try {
      const response = await adminFetch(`/api/admin/users/${detail.user.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "تعذر حذف الحساب");
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف الحساب");
    } finally {
      setBusy(false);
    }
  }

  const user = detail?.user;
  const tabs = [
    { value: "overview", label: "نظرة عامة" },
    { value: "access", label: "الوصول والصلاحيات" },
    { value: "features", label: "الميزات", count: detail?.features.filter((feature) => feature.override !== null).length },
    { value: "security", label: "الأمان والدخول", count: detail?.loginEvents.length },
    { value: "sessions", label: "الجلسات", count: detail?.sessions.length },
    { value: "activity", label: "سجل الإدارة", count: detail?.auditEvents.length },
    { value: "danger", label: "إجراءات حساسة" },
  ];
  const deleteIdentity = user?.email || user?.id || "";
  const deleteConfirmed = Boolean(deleteIdentity) && deleteConfirmation.trim().toLowerCase() === deleteIdentity.toLowerCase();

  return (
    <AdminDetailDrawer title={user?.name || user?.email || "إدارة المستخدم"} onClose={onClose}>
      <div className="user-management-card">
        {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
        {loading && !detail ? <AdminLoadingState message="جارٍ تحميل ملف المستخدم..." /> : null}
        {detail ? <>
          <div className="user-profile-heading">
            <div><strong>{user?.name || "—"}</strong><span dir="ltr">{user?.email || "—"}</span></div>
            {user ? <AdminStatusBadge status={user.status} /> : null}
          </div>
          <AdminTabs items={tabs} value={tab} onChange={setTab} />

          {tab === "overview" && user ? <div className="user-profile-overview">
            <form className="user-management-form user-profile-form" onSubmit={(event) => {
              event.preventDefault();
              void mutate(`/api/admin/users/${user.id}/profile`, {
                method: "PUT",
                body: JSON.stringify({
                  name: profileName,
                  email: profileEmail,
                  phone: profilePhone,
                  rank: profileRank,
                  militaryId: profileMilitaryId,
                  region: profileRegion,
                }),
              });
            }}>
              <div className="user-profile-form-grid">
                <label><span>الاسم</span><input required value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label>
                <label><span>البريد الإلكتروني</span><input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} /></label>
                <label><span>الهاتف</span><input dir="ltr" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} /></label>
                <label><span>الرتبة</span><input value={profileRank} onChange={(event) => setProfileRank(event.target.value)} /></label>
                <label><span>الرقم العسكري</span><input dir="ltr" value={profileMilitaryId} onChange={(event) => setProfileMilitaryId(event.target.value)} /></label>
                <label><span>المنطقة</span><input value={profileRegion} onChange={(event) => setProfileRegion(event.target.value)} /></label>
              </div>
              <div className="user-management-form-actions"><button type="submit" className="accent" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ بيانات الملف"}</button></div>
            </form>
            <div className="user-detail-grid">
              <div><span>الدور</span><strong>{ROLE_OPTIONS.find(([value]) => value === user.role)?.[1] || user.role}</strong></div>
              <div><span>تاريخ التسجيل</span><strong>{formatDate(user.created_at)}</strong></div>
              <div><span>آخر دخول</span><strong>{formatDate(user.last_login)}</strong></div>
              <div><span>عنوان IP الأخير</span><strong dir="ltr">{user.last_login_ip || "—"}</strong></div>
            </div>
          </div> : null}
          {tab === "access" && user ? <div className="user-access-panel">
            <AdminNotice tone="info">الصلاحيات الحالية مشتقة من الدور الفعلي في Gateway. لا تُعرض مفاتيح تجميلية لا يطبقها الخادم.</AdminNotice>
            <label><span>الدور</span><select value={user.role} disabled={busy} onChange={(event) => void mutate(`/api/admin/users/${user.id}/role`, { method: "PUT", body: JSON.stringify({ role: event.target.value }) })}>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>الحالة</span><select value={user.status} disabled={busy} onChange={(event) => void mutate(`/api/admin/users/${user.id}/status`, { method: "PUT", body: JSON.stringify({ status: event.target.value }) })}><option value="active">نشط</option><option value="suspended">موقوف</option><option value="banned">محظور</option></select></label>
            <div className="user-capabilities">
              <div className="user-panel-heading"><strong>الصلاحيات الموروثة من الدور</strong><NavLink to="/superadmin/roles-permissions">إدارة نموذج الأدوار</NavLink></div>
              <div className="user-chip-list">{detail.access.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div>
            </div>
          </div> : null}

          {tab === "features" ? <div className="user-feature-panel">
            <AdminNotice tone={detail.canManageFeatureOverrides ? "info" : "warning"}>
              {detail.canManageFeatureOverrides
                ? "يمكن للمدير الأعلى ضبط استثناءات هذا الحساب فقط. خيار «توريث» يعيد الميزة إلى الإعداد العام المنشور."
                : "استثناءات الميزات للقراءة فقط هنا. تعديلها محصور بالمدير الأعلى."}
            </AdminNotice>
            <div className="user-feature-list">
              {detail.features.map((feature) => {
                const override = featureOverrides[feature.id] ?? null;
                const effectiveEnabled = override === null ? feature.globalEnabled : override;
                const value = override === null ? "inherit" : override ? "enabled" : "disabled";
                return <article key={feature.id} className="user-feature-row">
                  <div className="user-feature-copy">
                    <strong>{feature.label}</strong>
                    <span>{FEATURE_CATEGORY_LABELS[feature.category] || feature.category}</span>
                    <small>عام: {feature.globalEnabled ? "مفعّل" : "معطّل"} · فعلي: {effectiveEnabled ? "مفعّل" : "معطّل"}</small>
                  </div>
                  <select
                    aria-label={`استثناء ميزة ${feature.label}`}
                    value={value}
                    disabled={busy || !detail.canManageFeatureOverrides}
                    onChange={(event) => {
                      const next = event.target.value === "inherit" ? null : event.target.value === "enabled";
                      setFeatureOverrides((current) => ({ ...current, [feature.id]: next }));
                    }}
                  >
                    <option value="inherit">توريث الإعداد العام</option>
                    <option value="enabled">تفعيل لهذا المستخدم</option>
                    {feature.canDisable ? <option value="disabled">حظر لهذا المستخدم</option> : null}
                  </select>
                </article>;
              })}
            </div>
            {detail.canManageFeatureOverrides ? <div className="user-management-form-actions">
              <button type="button" className="accent" disabled={busy} onClick={() => void mutate(`/api/admin/users/${userId}/features`, {
                method: "PUT",
                body: JSON.stringify({ overrides: featureOverrides }),
              })}>{busy ? "جارٍ الحفظ..." : "حفظ استثناءات الميزات"}</button>
            </div> : null}
          </div> : null}

          {tab === "security" ? <div className="user-event-list">
            {detail.loginEvents.length === 0 ? <p className="muted">لا توجد أحداث دخول مسجلة بعد.</p> : detail.loginEvents.map((event) => <article key={event.id} className="user-event-row">
              <div><strong>{event.success ? "دخول ناجح" : "محاولة غير ناجحة"}</strong><span>{formatDate(event.occurred_at)} · {event.auth_method || "—"}</span></div>
              <div className="user-ip-stack"><span>Client <b dir="ltr">{event.client_ip || "—"}</b></span><span>Peer <b dir="ltr">{event.peer_ip || "—"}</b></span></div>
              <small dir="ltr">{event.user_agent || "—"}</small>
            </article>)}
          </div> : null}
          {tab === "sessions" && user ? <div className="user-event-list">
            <div className="user-panel-heading"><strong>الجلسات النشطة</strong><button type="button" className="ghost sm" disabled={busy || detail.sessions.length === 0} onClick={() => void mutate(`/api/admin/users/${user.id}/sessions`, { method: "DELETE" })}>إنهاء كل الجلسات</button></div>
            {detail.sessions.length === 0 ? <p className="muted">لا توجد جلسات نشطة.</p> : detail.sessions.map((session) => <article key={session.id} className="user-event-row">
              <div><strong dir="ltr">{session.ip || "—"}</strong><span>{formatDate(session.created_at)} → {formatDate(session.expires_at)}</span></div>
              <small dir="ltr">{session.user_agent || "—"}</small>
              <button type="button" className="ghost sm" disabled={busy} onClick={() => void mutate(`/api/admin/sessions/${session.id}`, { method: "DELETE" })}>إنهاء الجلسة</button>
            </article>)}
          </div> : null}

          {tab === "activity" ? <div className="user-event-list">
            {detail.auditEvents.length === 0 ? <p className="muted">لا توجد أحداث إدارية مسجلة لهذا الحساب.</p> : detail.auditEvents.map((event) => <article key={event.id} className="user-event-row">
              <div><strong dir="ltr">{event.action}</strong><span>{formatDate(event.created_at)} · {event.resource}</span></div>
              <small dir="ltr">{event.ip || "—"}</small>
              {event.details ? <pre>{JSON.stringify(event.details, null, 2)}</pre> : null}
            </article>)}
          </div> : null}

          {tab === "danger" && user ? <div className="user-danger-panel">
            <AdminNotice tone="warning">الحذف نهائي للحساب نفسه. الجلسات والبيانات التابعة ذات سياسة الحذف المتسلسل تُحذف، بينما السجلات ذات سياسة الاحتفاظ تبقى مفصولة عن الحساب، ويُحفظ سجل تدقيق إداري لعملية الحذف.</AdminNotice>
            {detail.canDeleteUser ? <>
              <p>للتأكيد اكتب البريد الإلكتروني للحساب كما هو ظاهر أدناه. إذا لم يوجد بريد، اكتب معرّف المستخدم.</p>
              <code dir="ltr">{deleteIdentity}</code>
              <label className="user-delete-confirmation"><span>تأكيد هوية الحساب</span><input dir="ltr" autoComplete="off" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={deleteIdentity} /></label>
              <button type="button" className="user-delete-button" disabled={busy || !deleteConfirmed} onClick={() => void deleteAccount()}>{busy ? "جارٍ الحذف..." : "حذف الحساب نهائياً"}</button>
            </> : <AdminNotice tone="error">{deleteReasonLabel(detail.deleteBlockReason)}</AdminNotice>}
          </div> : null}
        </> : null}
      </div>
    </AdminDetailDrawer>
  );
}
