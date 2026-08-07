import { useEffect, useMemo, useState } from "react";
import { Warning24Regular } from "../../theme/watany-v4/legacyIconBridge";
import {
  api,
  type TaxiAdminDriver,
  type TaxiAdminDriverStatus,
  type TaxiAdminMonitoring,
  type TaxiAdminSettings,
} from "../../lib/api";

type TaxiMobilityAdminPanelProps = Readonly<{
  apiBaseUrl: string;
}>;

const STATUS_OPTIONS: TaxiAdminDriverStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

const DEFAULT_MONITORING: TaxiAdminMonitoring = {
  totalDrivers: 0,
  pendingDrivers: 0,
  approvedDrivers: 0,
  rejectedDrivers: 0,
  suspendedDrivers: 0,
  availableDrivers: 0,
  busyDrivers: 0,
  offlineDrivers: 0,
  lastUpdatedAt: null,
};

const DEFAULT_SETTINGS: TaxiAdminSettings = {
  requireAdminApproval: true,
  allowPhoneContact: true,
  allowWhatsappContact: true,
  complaintsEnabled: true,
  privacyMaskPlateDigits: true,
  veteranPriorityOnly: true,
  maxActiveReservationsPerDriver: 3,
  availabilityHeartbeatMinutes: 30,
};

function formatDateTime(value: string | null): string {
  if (!value) return "غير متاح";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "غير متاح";
  return new Intl.DateTimeFormat("ar-LB", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function statusLabel(status: TaxiAdminDriverStatus): string {
  switch (status) {
    case "PENDING":
      return "قيد المراجعة";
    case "APPROVED":
      return "معتمد";
    case "REJECTED":
      return "مرفوض";
    case "SUSPENDED":
      return "معلّق";
    default:
      return status;
  }
}

export default function TaxiMobilityAdminPanel({ apiBaseUrl }: TaxiMobilityAdminPanelProps) {
  const [monitoring, setMonitoring] = useState<TaxiAdminMonitoring>(DEFAULT_MONITORING);
  const [settings, setSettings] = useState<TaxiAdminSettings>(DEFAULT_SETTINGS);
  const [drivers, setDrivers] = useState<TaxiAdminDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sortedDrivers = useMemo(
    () => [...drivers].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [drivers],
  );

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [nextMonitoring, nextSettings, nextDrivers] = await Promise.all([
        api.getAdminTaxiMonitoring(apiBaseUrl),
        api.getAdminTaxiSettings(apiBaseUrl),
        api.getAdminTaxiDrivers(apiBaseUrl),
      ]);
      setMonitoring(nextMonitoring);
      setSettings(nextSettings);
      setDrivers(nextDrivers);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحميل بيانات إدارة التاكسي");
    } finally {
      setLoading(false);
    }
  }

  // loadData intentionally omitted from deps
  useEffect(() => {
    void loadData();
  }, [apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return undefined;
    const timer = globalThis.setTimeout(() => setNotice(null), 2800);
    return () => globalThis.clearTimeout(timer);
  }, [notice]);

  async function handleDriverStatusChange(driverId: string, status: TaxiAdminDriverStatus) {
    setBusyKey(`driver:${driverId}`);
    setError(null);
    try {
      await api.updateAdminTaxiDriverStatus(driverId, status, apiBaseUrl);
      setNotice("تم تحديث حالة السائق.");
      await loadData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحديث حالة السائق");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveSettings() {
    setBusyKey("settings");
    setError(null);
    try {
      const nextSettings = await api.updateAdminTaxiSettings(settings, apiBaseUrl);
      setSettings(nextSettings);
      setNotice("تم حفظ إعدادات التاكسي.");
      await loadData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حفظ إعدادات التاكسي");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="sa-section-stack">
      {loading ? (
        <div className="screen-loader">
          <div className="screen-loader__spinner" />
          <span>جارٍ تحميل إدارة التاكسي…</span>
        </div>
      ) : null}

      {error ? (
        <section className="admin-payments-banner admin-payments-banner--error">
          <Warning24Regular aria-hidden />
          <span>{error}</span>
        </section>
      ) : null}

      {notice ? <section className="admin-payments-banner"><span>{notice}</span></section> : null}

      <section className="admin-payments-metrics">
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">إجمالي السائقين</span>
          <strong>{monitoring.totalDrivers}</strong>
        </article>
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">بانتظار الموافقة</span>
          <strong>{monitoring.pendingDrivers}</strong>
        </article>
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">سائقون متاحون الآن</span>
          <strong>{monitoring.availableDrivers}</strong>
        </article>
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">آخر تحديث</span>
          <strong>{formatDateTime(monitoring.lastUpdatedAt)}</strong>
        </article>
      </section>

      <section className="admin-payments-grid admin-payments-grid--lists">
        <article className="admin-payments-card admin-payments-form admin-payments-card--wide">
          <div className="admin-payments-card__header">
            <h2>إعدادات خدمة التاكسي</h2>
            <span>تحكم مركزي بسياسات الاعتماد والتواصل والخصوصية.</span>
          </div>

          <div className="admin-payments-form__row">
            <label className="admin-payments-toggle">
              <input
                type="checkbox"
                checked={settings.requireAdminApproval}
                onChange={(event) => setSettings((current) => ({ ...current, requireAdminApproval: event.target.checked }))}
              />
              <span>لا يظهر السائق إلا بعد موافقة الإدارة</span>
            </label>
            <label className="admin-payments-toggle">
              <input
                type="checkbox"
                checked={settings.veteranPriorityOnly}
                onChange={(event) => setSettings((current) => ({ ...current, veteranPriorityOnly: event.target.checked }))}
              />
              <span>أولوية للخدمة المخصصة للمحاربين وعائلاتهم</span>
            </label>
          </div>

          <div className="admin-payments-form__row">
            <label className="admin-payments-toggle">
              <input
                type="checkbox"
                checked={settings.allowPhoneContact}
                onChange={(event) => setSettings((current) => ({ ...current, allowPhoneContact: event.target.checked }))}
              />
              <span>السماح بالتواصل الهاتفي المباشر</span>
            </label>
            <label className="admin-payments-toggle">
              <input
                type="checkbox"
                checked={settings.allowWhatsappContact}
                onChange={(event) => setSettings((current) => ({ ...current, allowWhatsappContact: event.target.checked }))}
              />
              <span>السماح بالتواصل عبر واتساب</span>
            </label>
          </div>

          <div className="admin-payments-form__row">
            <label className="admin-payments-toggle">
              <input
                type="checkbox"
                checked={settings.complaintsEnabled}
                onChange={(event) => setSettings((current) => ({ ...current, complaintsEnabled: event.target.checked }))}
              />
              <span>تفعيل استقبال الشكاوى</span>
            </label>
            <label className="admin-payments-toggle">
              <input
                type="checkbox"
                checked={settings.privacyMaskPlateDigits}
                onChange={(event) => setSettings((current) => ({ ...current, privacyMaskPlateDigits: event.target.checked }))}
              />
              <span>إخفاء بيانات لوحة السيارة الحساسة</span>
            </label>
          </div>

          <div className="admin-payments-form__row">
            <label className="admin-payments-field">
              <span>حد أقصى حجوزات نشطة لكل سائق</span>
              <input
                type="number"
                min={1}
                value={settings.maxActiveReservationsPerDriver}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  maxActiveReservationsPerDriver: Number(event.target.value) || current.maxActiveReservationsPerDriver,
                }))}
              />
            </label>
            <label className="admin-payments-field">
              <span>مهلة تحديث التوفر (بالدقائق)</span>
              <input
                type="number"
                min={1}
                value={settings.availabilityHeartbeatMinutes}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  availabilityHeartbeatMinutes: Number(event.target.value) || current.availabilityHeartbeatMinutes,
                }))}
              />
            </label>
          </div>

          <div className="admin-payments-editor__actions">
            <button className="sa-group__btn wt-cta-glow wt-cta-processing" type="button" onClick={() => void handleSaveSettings()} disabled={busyKey === "settings"} aria-busy={busyKey === "settings"}>
              {busyKey === "settings" ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
            </button>
            <button className="sa-group__btn sa-group__btn--off wt-cta-glow" type="button" onClick={() => void loadData()} disabled={busyKey === "settings"}>
              إعادة التحميل
            </button>
          </div>
        </article>

        <article className="admin-payments-card admin-payments-card--wide">
          <div className="admin-payments-card__header">
            <h2>مراقبة السائقين واعتماداتهم</h2>
            <span>لوحة مراجعة سريعة لحالات التوفر والموافقة لكل سائق.</span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>السائق</th>
                  <th>المنطقة</th>
                  <th>المركبة</th>
                  <th>التوفر</th>
                  <th>الحالة الإدارية</th>
                  <th>آخر تحديث</th>
                </tr>
              </thead>
              <tbody>
                {sortedDrivers.length > 0 ? sortedDrivers.map((driver) => (
                  <tr key={driver.id}>
                    <td>
                      <strong>{driver.fullName}</strong>
                      <div>{driver.phone}</div>
                    </td>
                    <td>{driver.areaLabel}</td>
                    <td>{driver.vehicleLabel}</td>
                    <td>{driver.availability}</td>
                    <td>
                      <select
                        value={driver.status}
                        onChange={(event) => void handleDriverStatusChange(driver.id, event.target.value as TaxiAdminDriverStatus)}
                        disabled={busyKey === `driver:${driver.id}`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{statusLabel(status)}</option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDateTime(driver.updatedAt)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6}>لا يوجد سائقون مسجلون حتى الآن.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}


