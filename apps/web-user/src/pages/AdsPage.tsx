import { useEffect, useMemo, useState } from "react";
import { WatanyFeatureTemplate } from "../components/template";
import { api } from "../lib/api";
import { useApp } from "../store/app";

type PublicAnnouncement = { id: string; title: string; body?: string; timestamp?: number; source?: string; url?: string };

function formatTimestamp(value?: number): string {
  if (!value) return "تاريخ غير محدد";
  return new Intl.DateTimeFormat("ar-LB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdsPage() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<PublicAnnouncement[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getAnnouncements(apiBaseUrl)
      .then((response) => {
        if (!active) return;
        setItems(response.announcements || []);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
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
    return items.filter((item) => [item.title, item.body, item.source].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery));
  }, [items, query]);

  return (
    <WatanyFeatureTemplate category="updates" title="الإعلانات">
      <section data-watany-feature-route="ads" className="official-services-page" dir="rtl">
        <header className="official-services-hero official-services-hero--compact">
          <h1>الإعلانات</h1>
          <div className="official-services-search">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في الإعلانات" aria-label="ابحث في الإعلانات" />
          </div>
        </header>

        {loading ? <div className="official-info">جار تحميل الإعلانات...</div> : null}
        {!loading && visibleItems.length === 0 ? <div className="official-warning">لا توجد إعلانات مطابقة حالياً.</div> : null}

        <section className="official-services-grid" aria-label="لائحة الإعلانات">
          {visibleItems.map((item) => (
            <article key={item.id} className="official-service-card">
              <div className="official-service-head">
                <div className="official-service-head__title-wrap">
                  <h2>{item.title}</h2>
                  <p className="official-service-head__meta">{item.source || formatTimestamp(item.timestamp)}</p>
                </div>
              </div>
              {item.body ? <p>{item.body}</p> : null}
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer">فتح الإعلان</a> : null}
            </article>
          ))}
        </section>
      </section>
    </WatanyFeatureTemplate>
  );
}