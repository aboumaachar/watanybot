import { useEffect, useState } from "react";
import { Filter24Regular, Link24Regular, Warning24Regular } from "../theme/watany-v4/legacyIconBridge";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import InlineInfoButton from "../components/InlineInfoButton";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import type { EmergencyAlert } from "../types/domain";
import { useApp } from "../store/app";
import { api } from "../lib/api";


import { WatanyFeatureTemplate } from "../components/template";

type UtilityColorStyle = React.CSSProperties & { "--utility-color": string };

function utilityColorStyle(color: string): UtilityColorStyle {
  return { "--utility-color": color };
}

function AlertsPageLegacy() {
  const { apiBaseUrl } = useApp();
  const [query, setQuery] = useState("");
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(nextQuery = query) {
    setLoading(true);
    setError("");
    try {
      const data = await api.getEmergencyAlerts(nextQuery, apiBaseUrl);
      setAlerts(data);
    } catch {
      setError("تعذر جلب التنبيهات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const alertsWithSource = alerts.filter((alert) => Boolean(alert.url)).length;

  return (
    <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized panel utility-page watany-utility-page">
      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-header watany-utility-page__header">
        <UtilityHeaderTitleRow
          className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized"
          titleClassName="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-title"
          title="التنبيهات والإشعارات العاجلة"
          infoText="استعرض التنبيهات وابحث ضمنها وراجع المصدر عند توفره."
          infoLabel="حول صفحة التنبيهات"
        />
      </div>

      <div className="watany-approved-home-icons wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-grid utility-action-grid--compact">
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card watany-utility-action-card" onClick={() => void load()} style={utilityColorStyle("#dc2626")}>
          <UtilityActionIcon className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized" icon={<Warning24Regular aria-hidden />} />
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__label">تحديث</span>
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__desc">جلب أحدث التنبيهات الصادرة وفق العبارة الحالية في البحث.</span>
        </button>
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card watany-utility-action-card" onClick={() => { setQuery(""); void load(""); }} style={utilityColorStyle("#64748b")}>
          <UtilityActionIcon className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized" icon={<Filter24Regular aria-hidden />} />
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__label">مسح</span>
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__desc">إعادة عرض جميع التنبيهات من دون أي فلترة نصية.</span>
        </button>
        <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card utility-action-card--static watany-utility-action-card" style={utilityColorStyle("#0f766e")}>
          <UtilityActionIcon className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized" icon={<Link24Regular aria-hidden />} />
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__label">مع مصدر</span>
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__desc">{`${alertsWithSource} تنبيه يتضمن رابطاً إلى المصدر المرجعي.`}</span>
        </div>
      </div>

      {error && <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized panel-error">{error}</div>}
      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized row watany-utility-page__search-row">
        <input
          className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized input watany-ui-field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في عناوين التنبيهات أو ملخصاتها"
          onKeyDown={(e) => { if (e.key === "Enter") load(); }}
        />
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn watany-ui-cta watany-ui-cta--primary" onClick={() => void load()} title="تحديث التنبيهات">
          {loading ? "جارٍ التحديث" : "تنفيذ البحث"}
        </button>
      </div>
      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized results watany-utility-page__results">
        {alerts.map((alert) => (
          <div key={alert.id} className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card utility-list-card utility-list-card--compact watany-utility-list-card">
            <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-row">
              <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-copy">
                <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card-title">{alert.title}</div>
                <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card-sub">{alert.country} • {new Date(alert.date).toLocaleDateString("ar-LB")}</div>
              </div>
              <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-actions">
                <InlineInfoButton text={alert.summary || "لا يوجد ملخص."} label={`عرض ملخص التنبيه ${alert.title}`} />
              </div>
            </div>
            <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__footer">
              <span className={`pill watany-ui-pill ${alert.url ? "verified" : "pending"}`}>{alert.url ? "مصدر متاح" : "من دون رابط"}</span>
              {alert.url ? (
                <a className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized link watany-ui-inline-action" href={alert.url}>فتح المصدر</a>
              ) : null}
            </div>
          </div>
        ))}
        {!alerts.length && !loading ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized muted">لا توجد تنبيهات مطابقة حالياً.</div> : null}
      </div>
    </div>
  );
}




// APEX_PHASE3D_UTILITY_ROUTE_READY: next safe slice may wrap this route with WatanyUtilityRoute after component-specific review.
export default function AlertsPage() {
  return (
    <WatanyFeatureTemplate
      category="updates"
      eyebrow="WatanyBot unified surface"
      title="Alerts"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.1."
      meta={[{ label: "Route", value: "/alerts" }]}
      className="watany-template-batch-v141"
    >
      <div data-watany-template-batch="v1.4.1" data-watany-template-route="/alerts">
        <AlertsPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}


