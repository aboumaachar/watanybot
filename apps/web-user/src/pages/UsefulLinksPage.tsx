import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight24Regular, Link24Regular } from "../theme/watany-v4/legacyIconBridge";
import { useApp } from "../store/app";
import { api, type UsefulLink } from "../lib/api";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./useful-links.css";

import { WatanyFeatureTemplate } from "../components/template";

const SALARY_ATTESTATION_PINNED_LINK: UsefulLink = {
  id: "salary-attestation-pinned",
  label: "إفادة الراتب",
  url: "https://eservices.finance.gov.lb/RetiredInfo.aspx",
  category: "روابط مفيدة",
  description: "افتح خدمة إفادة الراتب مباشرة.",
  official: true,
};

const t = {
  title: "روابط تهمك",
  search: "ابحث عن رابط أو مؤسسة...",
  open: "فتح الرابط",
  empty: "لا توجد روابط مطابقة.",
  error: "تعذّر تحميل الروابط المفيدة.",
  loading: "جارٍ التحميل...",
};

function UsefulLinksPageLegacy() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<UsefulLink[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const displayItems = useMemo(() => {
    const normalizedQuery = q.trim().toLowerCase();
    const baseItems = items.filter((item) => item.id !== SALARY_ATTESTATION_PINNED_LINK.id);

    const shouldIncludePinned =
      normalizedQuery.length === 0 ||
      SALARY_ATTESTATION_PINNED_LINK.label.toLowerCase().includes(normalizedQuery) ||
      (SALARY_ATTESTATION_PINNED_LINK.description || "").toLowerCase().includes(normalizedQuery);

    if (!shouldIncludePinned) return baseItems;

    return [SALARY_ATTESTATION_PINNED_LINK, ...baseItems];
  }, [items, q]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.getUsefulLinks(q, apiBaseUrl)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) {
          setItems([]);
          setError(t.error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiBaseUrl, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, UsefulLink[]>();
    for (const item of displayItems) {
      const key = item.category || "other";
      map.set(key, [...(map.get(key) || []), item]);
    }
    return Array.from(map.entries());
  }, [displayItems]);

  return (
    <main className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized legal-page useful-links-page" dir="rtl">
      <section className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized legal-page__hero legal-page__hero--stack legal-page__hero--compact useful-links-page__hero">
        <h1>{t.title}</h1>
        <input className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized wt-input wt-input--sheet" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} />
      </section>

      {error ? <div className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized wt-card">{error}</div> : null}
      {loading ? <p className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized wt-muted">{t.loading}</p> : null}
      {!loading && displayItems.length === 0 ? <div className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized wt-card">{t.empty}</div> : null}

      {grouped.map(([category, links]) => (
        <section className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized wt-list useful-links-page__list" key={category}>
          <h2>{category}</h2>
          {links.map((item) => (
            <a
              className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized wt-list__item useful-links-page__item useful-links-page__item--link"
              key={item.id}
              data-feature-key={item.id}
              href={item.url}
              aria-label={`${t.open} ${item.label}`}
              title={`${t.open} ${item.label}`}
            >
              <div className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized wt-list__main useful-links-page__main">
                <strong className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized wt-list__title useful-links-page__title">
                  <Link24Regular aria-hidden="true" />
                  <span>{item.label}</span>
                </strong>
                {item.description ? <span className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized wt-list__sub useful-links-page__sub">{item.description}</span> : null}
              </div>
              <span className="wmo-support-route wmo-rebuilt-route wmo-core-route wmo-route-normalized useful-links-page__open" aria-hidden="true">
                <ArrowUpRight24Regular aria-hidden="true" />
              </span>
            </a>
          ))}
        </section>
      ))}
    </main>
  );
}



// APEX_PHASE3E_SUPPORT_ROUTE_READY: next safe slice may wrap this route with WatanySupportRoute after component-specific review.
export default function UsefulLinksPage() {
  return (
    <WatanyFeatureTemplate
      category="general"
      eyebrow="WatanyBot unified surface"
      title="Useful Links"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.2."
      meta={[{ label: "Route", value: "/useful-links" }]}
      className="watany-template-batch-v142"
    >
      <div data-watany-template-batch="v1.4.2" data-watany-template-route="/useful-links">
        <UsefulLinksPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}


