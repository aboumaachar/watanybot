import { useCallback, useEffect, useMemo, useState } from "react";
import { AddressWidget, type AddressValue } from "@watany/address-network";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { adminFetch, getApiUrl } from "../lib/api";
import { AdminLoadingState, AdminNotice, AdminPageHeader, AdminStatusBadge, AdminTabs } from "../components/admin/AdminPrimitives";
import type { UserManagementDetail, UserServicePrivilegeId } from "../components/users/user-management-types";

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

const PRIVILEGE_META: Record<UserServicePrivilegeId, { label: string; description: string; destination?: string }> = {
  taxi_driver: { label: "سائق تاكسي", description: "يسمح بربط الحساب بخدمات النقل وملف السائق ومناطق الخدمة." },
  seller: { label: "بائع", description: "يسمح باستخدام هوية بائع ضمن السوق وإدارة العروض المرتبطة بالحساب.", destination: "/market" },
  employer: { label: "صاحب عمل", description: "يسمح باستخدام هوية صاحب عمل ونشر وإدارة فرص العمل.", destination: "/jobs" },
};

const TAB_ITEMS = [
  { value: "overview", label: "الملف الشخصي" },
  { value: "network", label: "الشبكة والعنوان" },
  { value: "privileges", label: "امتيازات الخدمات" },
  { value: "access", label: "الدور والوصول" },
  { value: "features", label: "الميزات" },
  { value: "security", label: "الأمان والدخول" },
  { value: "sessions", label: "الجلسات" },
  { value: "activity", label: "سجل الإدارة" },
  { value: "danger", label: "إجراءات حساسة" },
] as const;

type TabId = typeof TAB_ITEMS[number]["value"];

function isTab(value: string | null): value is TabId {
  return TAB_ITEMS.some((item) => item.value === value);
}

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

function resolveAvatarUrl(value?: string | null) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https:\/\//iu.test(url)) return url;
  return `${getApiUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.readAsDataURL(file);
  });
}

export default function UserPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = isTab(searchParams.get("tab")) ? searchParams.get("tab") as TabId : "overview";

  const [detail, setDetail] = useState<UserManagementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileRank, setProfileRank] = useState("");
  const [profileMilitaryId, setProfileMilitaryId] = useState("");
  const [profileRegion, setProfileRegion] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [networkAddress, setNetworkAddress] = useState<AddressValue>({});
  const [networkVisibility, setNetworkVisibility] = useState("VISIBLE_CAZA_ONLY");
  const [networkFamilyTier, setNetworkFamilyTier] = useState("BASIC_FAMILY_MEMBER");
  const [networkPoints, setNetworkPoints] = useState("0");
  const [networkVerified, setNetworkVerified] = useState(false);

  const [featureOverrides, setFeatureOverrides] = useState<Record<string, boolean | null>>({});
  const [servicePrivileges, setServicePrivileges] = useState<Record<UserServicePrivilegeId, boolean>>({ taxi_driver: false, seller: false, employer: false });
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch(`/api/admin/users/${id}/management`);
      const body = await response.json() as UserManagementDetail;
      setDetail(body);
      setProfileName(body.user?.name || "");
      setProfileEmail(body.user?.email || "");
      setProfilePhone(body.user?.phone || "");
      setProfileRank(body.user?.rank || "");
      setProfileMilitaryId(body.user?.military_id || "");
      setProfileRegion(body.user?.region || "");
      setAvatarUrl(body.user?.avatar_url || "");
      setFeatureOverrides(Object.fromEntries((body.features || []).map((feature) => [feature.id, feature.override])));
      setServicePrivileges({
        taxi_driver: body.servicePrivileges?.find((item) => item.privilege === "taxi_driver")?.enabled === true,
        seller: body.servicePrivileges?.find((item) => item.privilege === "seller")?.enabled === true,
        employer: body.servicePrivileges?.find((item) => item.privilege === "employer")?.enabled === true,
      });
      const profile = body.networkProfile;
      setNetworkAddress(profile?.address || {});
      setNetworkVisibility(profile?.visibilityLevel || "VISIBLE_CAZA_ONLY");
      setNetworkFamilyTier(profile?.familyTier || "BASIC_FAMILY_MEMBER");
      setNetworkPoints(String(profile?.points || 0));
      setNetworkVerified(profile?.isVerifiedUser === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل ملف المستخدم");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setDeleteConfirmation(""); }, [id]);

  async function mutate(url: string, options: RequestInit, successMessage: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminFetch(url, options);
      setNotice(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية");
    } finally {
      setBusy(false);
    }
  }

  function changeTab(next: string) {
    if (!isTab(next)) return;
    const params = new URLSearchParams(searchParams);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  async function uploadAvatar(file?: File) {
    if (!file || uploadingAvatar) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("الصورة يجب أن تكون JPG أو PNG أو WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 5 MB.");
      return;
    }
    setUploadingAvatar(true);
    setError("");
    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await adminFetch("/api/files/upload", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType: file.type, dataUrl }),
      });
      const body = await response.json() as { url?: string };
      if (!body.url) throw new Error("لم يُرجع الخادم رابط الصورة");
      setAvatarUrl(body.url);
      setNotice("تم رفع الصورة. اضغط «حفظ بيانات الملف» لتثبيتها على الحساب.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر رفع الصورة");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function deleteAccount() {
    if (!detail?.user || busy || !detail.canDeleteUser) return;
    setBusy(true);
    setError("");
    try {
      await adminFetch(`/api/admin/users/${detail.user.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      navigate("/users", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف الحساب");
      setBusy(false);
    }
  }

  const user = detail?.user;
  const deleteIdentity = user?.email || user?.id || "";
  const deleteConfirmed = Boolean(deleteIdentity) && deleteConfirmation.trim().toLowerCase() === deleteIdentity.toLowerCase();
  const avatarSrc = resolveAvatarUrl(avatarUrl);
  const tabItems = useMemo(() => TAB_ITEMS.map((item) => ({
    ...item,
    count: item.value === "features" ? detail?.features.filter((feature) => feature.override !== null).length
      : item.value === "security" ? detail?.loginEvents.length
      : item.value === "sessions" ? detail?.sessions.length
      : undefined,
  })), [detail]);

  if (loading && !detail) return <div className="user-page"><AdminLoadingState message="جارٍ تحميل ملف المستخدم..." /></div>;

  return (
    <div className="user-page" dir="rtl">
      <AdminPageHeader
        title={user?.name || user?.email || "ملف المستخدم"}
        description="صفحة مستقلة للتحكم الكامل بالحساب، ملفه الشخصي، عنوانه ضمن شبكة موطني، امتيازات الخدمات، الأمان والجلسات."
        actions={<button type="button" className="ghost" onClick={() => navigate("/users")}>العودة إلى المستخدمين</button>}
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {notice ? <AdminNotice tone="info">{notice}</AdminNotice> : null}

      {detail && user ? <>
        <section className="user-page-hero">
          <div className="user-page-avatar-wrap">
            {avatarSrc ? <img className="user-page-avatar" src={avatarSrc} alt={`صورة ${user.name || "المستخدم"}`} /> : <div className="user-page-avatar user-page-avatar-placeholder" aria-hidden="true">{(user.name || user.email || "U").slice(0, 1).toUpperCase()}</div>}
          </div>
          <div className="user-page-identity">
            <div className="user-page-title-row"><h2>{user.name || "—"}</h2><AdminStatusBadge status={user.status} /></div>
            <span dir="ltr">{user.email || "—"}</span>
            <div className="user-chip-list">
              <span>{ROLE_OPTIONS.find(([value]) => value === user.role)?.[1] || user.role}</span>
              <span dir="ltr">ID: {user.id}</span>
              {detail.networkProfile ? <span>عضو في الشبكة: {detail.networkProfile.approvalStatus}</span> : <span>غير مسجل في الشبكة</span>}
            </div>
          </div>
          <div className="user-page-hero-metrics">
            <div><span>آخر دخول</span><strong>{formatDate(user.last_login)}</strong></div>
            <div><span>الجلسات النشطة</span><strong>{detail.sessions.length}</strong></div>
            <div><span>استثناءات الميزات</span><strong>{detail.features.filter((feature) => feature.override !== null).length}</strong></div>
          </div>
        </section>

        <section className="user-page-task-grid" aria-label="وظائف إدارة المستخدم">
          {TAB_ITEMS.map((item) => <button key={item.value} type="button" className={tab === item.value ? "active" : ""} onClick={() => changeTab(item.value)}>
            <strong>{item.label}</strong>
            <span>{item.value === "network" ? "المحافظة · القضاء · البلدة" : item.value === "privileges" ? "سائق · بائع · صاحب عمل" : item.value === "security" ? "IP وسجل الدخول" : item.value === "sessions" ? "إنهاء ومراجعة الجلسات" : item.value === "danger" ? "حذف الحساب" : "فتح الإدارة"}</span>
          </button>)}
        </section>

        <AdminTabs items={tabItems} value={tab} onChange={changeTab} />

        <section className="user-page-content">
          {tab === "overview" ? <div className="user-profile-overview">
            <div className="user-avatar-editor">
              <div className="user-avatar-preview">
                {avatarSrc ? <img src={avatarSrc} alt="صورة الملف الشخصي" /> : <span>{(user.name || "U").slice(0, 1).toUpperCase()}</span>}
              </div>
              <div>
                <strong>الصورة الشخصية / Avatar</strong>
                <p>JPG أو PNG أو WebP، بحد أقصى 5 MB.</p>
                <div className="user-management-form-actions">
                  <label className="ghost user-avatar-upload-button"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />{uploadingAvatar ? "جارٍ الرفع..." : "رفع صورة"}</label>
                  {avatarUrl ? <button type="button" className="ghost" onClick={() => setAvatarUrl("")}>إزالة الصورة</button> : null}
                </div>
              </div>
            </div>
            <form className="user-management-form user-profile-form" onSubmit={(event) => {
              event.preventDefault();
              void mutate(`/api/admin/users/${user.id}/profile`, {
                method: "PUT",
                body: JSON.stringify({ name: profileName, email: profileEmail, phone: profilePhone, rank: profileRank, militaryId: profileMilitaryId, region: profileRegion, avatarUrl }),
              }, "تم حفظ بيانات الملف الشخصي.");
            }}>
              <div className="user-profile-form-grid">
                <label><span>الاسم</span><input required value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label>
                <label><span>البريد الإلكتروني</span><input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} /></label>
                <label><span>الهاتف</span><input dir="ltr" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} /></label>
                <label><span>الرتبة</span><input value={profileRank} onChange={(event) => setProfileRank(event.target.value)} /></label>
                <label><span>الرقم العسكري</span><input dir="ltr" value={profileMilitaryId} onChange={(event) => setProfileMilitaryId(event.target.value)} /></label>
                <label><span>المنطقة / وصف إضافي</span><input value={profileRegion} onChange={(event) => setProfileRegion(event.target.value)} /></label>
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

          {tab === "network" ? <div className="user-network-panel">
            <div className="user-panel-heading"><div><strong>هوية المستخدم ضمن شبكة موطني</strong><p className="muted">العنوان هنا يستخدم نفس مصدر المحافظة / القضاء / البلدة المعتمد في ميزة الشبكة، وليس حقلاً نصياً منفصلاً.</p></div>{detail.networkProfile ? <AdminStatusBadge status={detail.networkProfile.approvalStatus} /> : null}</div>
            <AddressWidget
              value={networkAddress}
              onChange={setNetworkAddress}
              catalogUrl={`${import.meta.env.BASE_URL}vendor/lebanon-admin-widget/data/lebanon_admin_data.json`}
              featureFlags={{ gpsEnabled: false, mapEnabled: false, manualPinEnabled: false }}
            />
            <div className="user-profile-form-grid">
              <label className="user-inline-field"><span>مستوى الظهور</span><select value={networkVisibility} onChange={(event) => setNetworkVisibility(event.target.value)}><option value="VISIBLE_PUBLIC">عام</option><option value="VISIBLE_NETWORK_ONLY">داخل الشبكة فقط</option><option value="VISIBLE_CAZA_ONLY">ضمن القضاء</option><option value="VISIBLE_VILLAGE_ONLY">ضمن البلدة / القرية</option><option value="HIDDEN">مخفي</option></select></label>
              <label className="user-inline-field"><span>فئة العضوية</span><select value={networkFamilyTier} onChange={(event) => setNetworkFamilyTier(event.target.value)}><option value="BASIC_FAMILY_MEMBER">عضو أساسي</option><option value="VERIFIED_FAMILY_MEMBER">عضو موثق</option><option value="CONTRIBUTOR">مساهم</option><option value="COMMUNITY_STEWARD">مشرف مجتمع</option></select></label>
              <label className="user-inline-field"><span>النقاط</span><input type="number" min="0" value={networkPoints} onChange={(event) => setNetworkPoints(event.target.value)} /></label>
              <label className="user-toggle-card"><input type="checkbox" checked={networkVerified} onChange={(event) => setNetworkVerified(event.target.checked)} /><span><strong>مستخدم موثّق</strong><small>تمييز عضوية الشبكة كهوية موثقة.</small></span></label>
            </div>
            <div className="user-management-form-actions">
              <button type="button" className="ghost" disabled={busy} onClick={() => void mutate(`/api/admin/users/${user.id}/network`, { method: "PUT", body: JSON.stringify({ address: networkAddress, visibilityLevel: networkVisibility, familyTier: networkFamilyTier, points: Number(networkPoints || 0), isVerifiedUser: networkVerified, approvalAction: "draft" }) }, "تم حفظ بيانات الشبكة.")}>حفظ كمسودة</button>
              <button type="button" className="ghost" disabled={busy} onClick={() => void mutate(`/api/admin/users/${user.id}/network`, { method: "PUT", body: JSON.stringify({ address: networkAddress, visibilityLevel: networkVisibility, familyTier: networkFamilyTier, points: Number(networkPoints || 0), isVerifiedUser: networkVerified, approvalAction: "submit" }) }, "تم إرسال عضوية الشبكة للمراجعة.")}>إرسال للمراجعة</button>
              <button type="button" className="accent" disabled={busy} onClick={() => void mutate(`/api/admin/users/${user.id}/network`, { method: "PUT", body: JSON.stringify({ address: networkAddress, visibilityLevel: networkVisibility, familyTier: networkFamilyTier, points: Number(networkPoints || 0), isVerifiedUser: networkVerified, approvalAction: "approve" }) }, "تم حفظ واعتماد عضوية الشبكة.")}>حفظ واعتماد</button>
            </div>
          </div> : null}

          {tab === "privileges" ? <div className="user-service-privileges-panel">
            <AdminNotice tone={detail.canManageServicePrivileges ? "info" : "warning"}>{detail.canManageServicePrivileges ? "هذه امتيازات خدمات متعددة للحساب، وهي مستقلة عن دور RBAC الإداري. يمكن للحساب أن يكون بائعاً وصاحب عمل وسائقاً في الوقت نفسه." : "امتيازات الخدمات للقراءة فقط هنا، وتعديلها محصور بالمدير الأعلى."}</AdminNotice>
            <div className="user-service-privilege-grid">
              {(Object.keys(PRIVILEGE_META) as UserServicePrivilegeId[]).map((privilege) => {
                const meta = PRIVILEGE_META[privilege];
                return <article key={privilege} className={servicePrivileges[privilege] ? "user-service-privilege-card active" : "user-service-privilege-card"}>
                  <label><input type="checkbox" checked={servicePrivileges[privilege]} disabled={!detail.canManageServicePrivileges || busy} onChange={(event) => setServicePrivileges((current) => ({ ...current, [privilege]: event.target.checked }))} /><span><strong>{meta.label}</strong><small>{meta.description}</small></span></label>
                  {meta.destination ? <NavLink to={meta.destination}>فتح إدارة الخدمة</NavLink> : null}
                </article>;
              })}
            </div>
            {detail.canManageServicePrivileges ? <div className="user-management-form-actions"><button type="button" className="accent" disabled={busy} onClick={() => void mutate(`/api/admin/users/${user.id}/privileges`, { method: "PUT", body: JSON.stringify({ privileges: servicePrivileges }) }, "تم حفظ امتيازات الخدمات.")}>{busy ? "جارٍ الحفظ..." : "حفظ امتيازات الخدمات"}</button></div> : null}
          </div> : null}

          {tab === "access" ? <div className="user-access-panel">
            <AdminNotice tone="info">الدور يحدد صلاحيات النظام العامة. امتيازات سائق / بائع / صاحب عمل تُدار بصورة مستقلة في تبويب «امتيازات الخدمات».</AdminNotice>
            <label><span>الدور</span><select value={user.role} disabled={busy} onChange={(event) => void mutate(`/api/admin/users/${user.id}/role`, { method: "PUT", body: JSON.stringify({ role: event.target.value }) }, "تم تحديث دور المستخدم.")}>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>الحالة</span><select value={user.status} disabled={busy} onChange={(event) => void mutate(`/api/admin/users/${user.id}/status`, { method: "PUT", body: JSON.stringify({ status: event.target.value }) }, "تم تحديث حالة المستخدم.")}><option value="active">نشط</option><option value="suspended">موقوف</option><option value="banned">محظور</option></select></label>
            <div className="user-capabilities"><div className="user-panel-heading"><strong>الصلاحيات الموروثة من الدور</strong><NavLink to="/roles-permissions">إدارة نموذج الأدوار</NavLink></div><div className="user-chip-list">{detail.access.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div></div>
          </div> : null}

          {tab === "features" ? <div className="user-feature-panel">
            <AdminNotice tone={detail.canManageFeatureOverrides ? "info" : "warning"}>{detail.canManageFeatureOverrides ? "يمكن للمدير الأعلى ضبط استثناءات هذا الحساب فقط. خيار «توريث» يعيد الميزة إلى الإعداد العام المنشور." : "استثناءات الميزات للقراءة فقط هنا. تعديلها محصور بالمدير الأعلى."}</AdminNotice>
            <div className="user-feature-list">{detail.features.map((feature) => {
              const override = featureOverrides[feature.id] ?? null;
              const effectiveEnabled = override === null ? feature.globalEnabled : override;
              const value = override === null ? "inherit" : override ? "enabled" : "disabled";
              return <article key={feature.id} className="user-feature-row"><div className="user-feature-copy"><strong>{feature.label}</strong><span>{FEATURE_CATEGORY_LABELS[feature.category] || feature.category}</span><small>عام: {feature.globalEnabled ? "مفعّل" : "معطّل"} · فعلي: {effectiveEnabled ? "مفعّل" : "معطّل"}</small></div><select aria-label={`استثناء ميزة ${feature.label}`} value={value} disabled={busy || !detail.canManageFeatureOverrides} onChange={(event) => { const next = event.target.value === "inherit" ? null : event.target.value === "enabled"; setFeatureOverrides((current) => ({ ...current, [feature.id]: next })); }}><option value="inherit">توريث الإعداد العام</option><option value="enabled">تفعيل لهذا المستخدم</option>{feature.canDisable ? <option value="disabled">حظر لهذا المستخدم</option> : null}</select></article>;
            })}</div>
            {detail.canManageFeatureOverrides ? <div className="user-management-form-actions"><button type="button" className="accent" disabled={busy} onClick={() => void mutate(`/api/admin/users/${id}/features`, { method: "PUT", body: JSON.stringify({ overrides: featureOverrides }) }, "تم حفظ استثناءات الميزات.")}>حفظ استثناءات الميزات</button></div> : null}
          </div> : null}

          {tab === "security" ? <div className="user-event-list">{detail.loginEvents.length === 0 ? <p className="muted">لا توجد أحداث دخول مسجلة بعد.</p> : detail.loginEvents.map((event) => <article key={event.id} className="user-event-row"><div><strong>{event.success ? "دخول ناجح" : "محاولة غير ناجحة"}</strong><span>{formatDate(event.occurred_at)} · {event.auth_method || "—"}</span></div><div className="user-ip-stack"><span>Client <b dir="ltr">{event.client_ip || "—"}</b></span><span>Peer <b dir="ltr">{event.peer_ip || "—"}</b></span></div><small dir="ltr">{event.user_agent || "—"}</small></article>)}</div> : null}

          {tab === "sessions" ? <div className="user-event-list"><div className="user-panel-heading"><strong>الجلسات النشطة</strong><button type="button" className="ghost sm" disabled={busy || detail.sessions.length === 0} onClick={() => void mutate(`/api/admin/users/${user.id}/sessions`, { method: "DELETE" }, "تم إنهاء كل جلسات المستخدم.")}>إنهاء كل الجلسات</button></div>{detail.sessions.length === 0 ? <p className="muted">لا توجد جلسات نشطة.</p> : detail.sessions.map((session) => <article key={session.id} className="user-event-row"><div><strong dir="ltr">{session.ip || "—"}</strong><span>{formatDate(session.created_at)} → {formatDate(session.expires_at)}</span></div><small dir="ltr">{session.user_agent || "—"}</small><button type="button" className="ghost sm" disabled={busy} onClick={() => void mutate(`/api/admin/sessions/${session.id}`, { method: "DELETE" }, "تم إنهاء الجلسة.")}>إنهاء الجلسة</button></article>)}</div> : null}

          {tab === "activity" ? <div className="user-event-list">{detail.auditEvents.length === 0 ? <p className="muted">لا توجد أحداث إدارية مسجلة لهذا الحساب.</p> : detail.auditEvents.map((event) => <article key={event.id} className="user-event-row"><div><strong dir="ltr">{event.action}</strong><span>{formatDate(event.created_at)} · {event.resource}</span></div><small dir="ltr">{event.ip || "—"}</small>{event.details ? <pre>{JSON.stringify(event.details, null, 2)}</pre> : null}</article>)}</div> : null}

          {tab === "danger" ? <div className="user-danger-panel"><AdminNotice tone="warning">الحذف نهائي للحساب نفسه. الجلسات والبيانات التابعة ذات سياسة الحذف المتسلسل تُحذف، بينما السجلات ذات سياسة الاحتفاظ تبقى مفصولة عن الحساب، ويُحفظ سجل تدقيق إداري للعملية.</AdminNotice>{detail.canDeleteUser ? <><p>للتأكيد اكتب البريد الإلكتروني للحساب كما هو ظاهر أدناه. إذا لم يوجد بريد، اكتب معرّف المستخدم.</p><code dir="ltr">{deleteIdentity}</code><label className="user-delete-confirmation"><span>تأكيد هوية الحساب</span><input dir="ltr" autoComplete="off" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={deleteIdentity} /></label><button type="button" className="user-delete-button" disabled={busy || !deleteConfirmed} onClick={() => void deleteAccount()}>{busy ? "جارٍ الحذف..." : "حذف الحساب نهائياً"}</button></> : <AdminNotice tone="error">{deleteReasonLabel(detail.deleteBlockReason)}</AdminNotice>}</div> : null}
        </section>
      </> : null}
    </div>
  );
}
