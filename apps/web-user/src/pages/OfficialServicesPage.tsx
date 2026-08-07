import { useEffect, useMemo, useState } from "react";
import { api, type OfficialService } from "../lib/api";
import { useApp } from "../store/app";
import "./official-services.css";


import { WatanyFeatureTemplate } from "../components/template";
const PINNED_SALARY_ATTESTATION_SERVICE: OfficialService = {
  id: "pinned-salary-attestation",
  listingNo: 0,
  titleAr: "إفادة راتب",
  providerAr: "وزارة المالية",
  category: "official",
  sourceUrl: "https://eservices.finance.gov.lb/RetiredInfo.aspx",
  route: "https://eservices.finance.gov.lb/RetiredInfo.aspx",
  mode: "EXISTING_LOCAL",
  enabled: true,
  summaryAr: "خدمة مباشرة لفتح إفادة الراتب.",
  helpTextAr: "افتح خدمة إفادة الراتب مباشرة من موقع وزارة المالية.",
  externalOnly: true,
  portalUrl: "https://eservices.finance.gov.lb/RetiredInfo.aspx",
};

function isSalaryAttestationService(service: OfficialService): boolean {
  const title = service.titleAr || "";
  const route = service.route || "";
  const id = service.id || "";
  return /(?:إفادة|افادة)\s*(?:الراتب|راتب)/i.test(title)
    || route === "/pension"
    || /pension|salary.*attest/i.test(id);
}

function OfficialServicesPageLegacy() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<OfficialService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    api.listOfficialServices(apiBaseUrl)
      .then((nextItems) => {
        if (!active) return;
        setItems(nextItems);
      })
      .catch((nextError) => {
        if (!active) return;
        setItems([]);
        setError(nextError instanceof Error ? nextError.message : "تعذر تحميل الروابط المفيدة");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  const filteredItems = useMemo(() => {
    const hasSalaryAttestationFromApi = items.some(isSalaryAttestationService);
    const listingItems = hasSalaryAttestationFromApi
      ? items
      : [PINNED_SALARY_ATTESTATION_SERVICE, ...items];

    const sortedItems = [...listingItems].sort((left, right) => {
      const leftPinned = isSalaryAttestationService(left) ? 0 : 1;
      const rightPinned = isSalaryAttestationService(right) ? 0 : 1;
      if (leftPinned !== rightPinned) return leftPinned - rightPinned;
      return left.listingNo - right.listingNo;
    });
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sortedItems;
    return sortedItems.filter((service) => {
      const haystack = [
        service.titleAr,
        service.providerAr,
        service.summaryAr,
        service.helpTextAr,
        ...(service.guideBulletsAr || []),
      ].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, query]);

  return (
    <main className="official-services-page" dir="rtl">
      <section className="official-services-hero official-services-hero--compact">
        <h1>روابط مفيدة</h1>
        <div className="official-services-search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن رابط مفيد أو جهة رسمية..."
            aria-label="ابحث في الروابط المفيدة"
          />
        </div>
      </section>

      {loading ? <div className="official-info">جارٍ تحميل الروابط المفيدة...</div> : null}
      {!loading && error ? <div className="official-alert">{error}</div> : null}
      {!loading && !error && filteredItems.length === 0 ? <div className="official-warning">لا توجد روابط مطابقة لعبارة البحث الحالية.</div> : null}

      <section className="official-services-grid">
        {filteredItems.map((service) => {
          const officialUrl = service.sourceUrl || service.portalUrl;
          const cardClassName = `official-service-card watany-listing-card${service.externalOnly ? " official-service-card--link" : ""}${service.enabled ? "" : " official-service-card--disabled"}`;

          return (
            <article key={service.id} className={cardClassName}>
              <div className="official-service-head">
                <div className="official-service-head__title-wrap">
                  {officialUrl ? (
                    <h2 className="watany-listing-card__title">
                      <a
                        href={officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`فتح ${service.titleAr}`}
                      >
                        {service.titleAr}
                      </a>
                    </h2>
                  ) : (
                    <h2 className="watany-listing-card__title">{service.titleAr}</h2>
                  )}
                  {service.providerAr ? <p className="official-service-head__meta">{service.providerAr}</p> : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
export default function OfficialServicesPage() {
  return (
    <WatanyFeatureTemplate
      category="service"
      eyebrow="WatanyBot unified surface"
      title="Official Services"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.2."
      meta={[{ label: "Route", value: "/services/official" }]}
      className="watany-template-batch-v142"
    >
      <div data-watany-template-batch="v1.4.2" data-watany-template-route="/services/official">
        <OfficialServicesPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}


