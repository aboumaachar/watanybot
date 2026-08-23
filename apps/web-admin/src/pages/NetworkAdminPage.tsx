import { useEffect, useMemo, useState } from "react";
import { AdminFluentIcon } from "../components/AdminFluentIcon";
import { getAdminErrorMessage, getNetworkSettings, listNetworkProfiles, type NetworkApprovalStatus, type NetworkProfile, type NetworkSettings } from "../lib/api";

const visibilityLabels: Record<NetworkProfile["visibilityLevel"], string> = {
  VISIBLE_PUBLIC: "عام",
  VISIBLE_NETWORK_ONLY: "داخل الشبكة",
  VISIBLE_CAZA_ONLY: "ضمن القضاء",
  VISIBLE_VILLAGE_ONLY: "ضمن البلدة",
  HIDDEN: "مخفي",
};

const approvalLabels: Record<NetworkApprovalStatus, string> = {
  PENDING: "قيد المراجعة",
  APPROVED: "معتمد",
  SUSPENDED: "موقوف",
  HIDDEN_BY_ADMIN: "مخفي إدارياً",
};

function addressLabel(profile: NetworkProfile): string {
  return [profile.address.villageId, profile.address.municipalityId, profile.address.cazaId, profile.address.governorateId]
    .filter(Boolean)
    .join(" / ") || "غير محدد";
}

function settingLabel(value: boolean): string {
  return value ? "مفعّل" : "غير مفعّل";
}

export default function NetworkAdminPage() {
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]);
  const [settings, setSettings] = useState<NetworkSettings | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadNetwork() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const [nextSettings, nextProfiles] = await Promise.all([getNetworkSettings(), listNetworkProfiles()]);
      setSettings(nextSettings);
      setProfiles(nextProfiles);
      setSuccess("تم تحميل حالة الشبكة.");
    } catch (reason) {
      setSettings(null);
      setProfiles([]);
      setError(getAdminErrorMessage(reason, "تعذر تحميل حالة الشبكة."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNetwork();
  }, []);

  const visibleProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return profiles;
    return profiles.filter((profile) => [profile.displayName, profile.userId, addressLabel(profile), visibilityLabels[profile.visibilityLevel], approvalLabels[profile.approvalStatus]]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery));
  }, [profiles, query]);

  return (
    <div dir="rtl">
      <div className="page-header">
        <h2><AdminFluentIcon name="location" /> إدارة الشبكة</h2>
        <p className="muted">الحالة الحالية للأعضاء المعتمدين وإعدادات الشبكة.</p>
      </div>

      <div className="superadmin-shortcuts">
        <input aria-label="بحث في أعضاء الشبكة" placeholder="بحث في الأعضاء..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="button" className="ghost" onClick={() => void loadNetwork()} disabled={loading}>تحديث</button>
      </div>

      {loading ? <p className="muted">جار تحميل حالة الشبكة...</p> : null}
      {error ? <p role="alert" className="error-text">{error}</p> : null}
      {success && !error ? <p role="status" className="muted">{success}</p> : null}

      {!loading && !error && settings ? (
        <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <section className="card">
            <h3>إعدادات الشبكة</h3>
            <p className="muted">الخدمة: {settingLabel(settings.featureEnabled)}</p>
            <p className="muted">الموافقة مطلوبة: {settingLabel(settings.requireApproval)}</p>
            <p className="muted">الخريطة: {settingLabel(settings.mapEnabled)}</p>
            <p className="muted">GPS: {settingLabel(settings.gpsEnabled)}</p>
            <p className="muted">الاتصالات: {settingLabel(settings.connectionsEnabled)}</p>
          </section>
          <section className="card">
            <h3>ملخص الأعضاء</h3>
            <p className="muted">الأعضاء المعتمدون</p>
            <strong style={{ fontSize: "2rem" }}>{profiles.length}</strong>
            <p className="muted">الظاهرون في القائمة الحالية: {visibleProfiles.length}</p>
          </section>
        </section>
      ) : null}

      {!loading && !error && visibleProfiles.length === 0 ? <p className="muted">لا توجد عضويات معتمدة مطابقة.</p> : null}
      {!loading && !error && visibleProfiles.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>العضو</th><th>المعرف</th><th>الموقع</th><th>الظهور</th><th>الحالة</th><th>آخر تحديث</th></tr></thead>
            <tbody>
              {visibleProfiles.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.displayName}</td>
                  <td>{profile.userId}</td>
                  <td>{addressLabel(profile)}</td>
                  <td>{visibilityLabels[profile.visibilityLevel]}</td>
                  <td>{approvalLabels[profile.approvalStatus]}</td>
                  <td>{new Date(profile.updatedAt).toLocaleDateString("ar-LB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}