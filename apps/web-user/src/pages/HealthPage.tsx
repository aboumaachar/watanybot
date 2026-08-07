import { useEffect, useMemo, useState } from "react";
import { WatanyFeatureTemplate } from "../components/template";
import { api, type OfficialService } from "../lib/api";
import { useApp } from "../store/app";

function isHealthService(service: OfficialService): boolean {
  const haystack = [service.titleAr, service.providerAr, service.category, service.summaryAr, service.helpTextAr].join(" ").toLowerCase();
  return /health|medical|طب|صحة|استشفاء|تحويل|دواء|مستشفى/.test(haystack);
}

export default function HealthPage() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<OfficialService[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.listOfficialServices(apiBaseUrl)
      .then((services) => {
        if (!active) return;
        const healthServices = services.filter(isHealthService);
        setItems(healthServices.length ? healthServices : services);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((service) => [service.titleAr, service.providerAr, service.summaryAr, service.helpTextAr].join(" ").toLowerCase().includes(normalizedQuery));
  }, [items, query]);

  return (
    <WatanyFeatureTemplate category="service" title="الصحة">
      <section data-watany-feature-route="health" className="official-services-page" dir="rtl">
        <header className="official-services-hero official-services-hero--compact">
          <h1>خدمات الصحة والطبابة</h1>
          <div className="official-services-search">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في خدمات الصحة" aria-label="ابحث في خدمات الصحة" />
          </div>
        </header>
        {loading ? <div className="official-info">جار تحميل الخدمات...</div> : null}
        {!loading && visibleItems.length === 0 ? <div className="official-warning">لا توجد خدمات صحية مطابقة حالياً.</div> : null}
        <section className="official-services-grid" aria-label="لائحة الخدمات الصحية">
          {visibleItems.map((service) => (
            <article key={service.id} className="official-service-card">
              <div className="official-service-head">
                <div className="official-service-head__title-wrap">
                  <h2>{service.titleAr}</h2>
                  <p className="official-service-head__meta">{service.providerAr}</p>
                </div>
              </div>
              <p>{service.summaryAr || service.helpTextAr}</p>
              {(service.portalUrl || service.sourceUrl) ? <a href={service.portalUrl || service.sourceUrl} target="_blank" rel="noreferrer">فتح الخدمة</a> : null}
            </article>
          ))}
        </section>
      </section>
    </WatanyFeatureTemplate>
  );
}