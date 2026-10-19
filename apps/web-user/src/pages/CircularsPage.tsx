import { useEffect, useMemo, useState } from "react";
import { WatanyFeatureTemplate } from "../components/template";
import { api } from "../lib/api";
import { useApp } from "../store/app";
import type { RecruitmentAnnouncement } from "../types/domain";

function formatDate(value?: string): string {
  if (!value) return "غير محدد";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ar-LB", { dateStyle: "medium" }).format(parsed);
}

export default function CircularsPage() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<RecruitmentAnnouncement[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api.getRecruitmentAnnouncements(apiBaseUrl)
      .then((announcements) => {
        if (!active) return;
        setItems(announcements);
      })
      .catch((nextError) => {
        if (!active) return;
        setItems([]);
        setError(nextError instanceof Error ? nextError.message : "تعذر تحميل التعاميم.");
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
    return items.filter((item) => [item.title, item.apparatusName, item.announcementNumber, item.sourceName, item.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery));
  }, [items, query]);

  return (
    <WatanyFeatureTemplate category="updates" title="التعاميم">
      <section data-watany-feature-route="circulars" className="jobs-page" dir="rtl">
        <header className="jobs-hero">
          <span className="jobs-eyebrow">التعاميم الرسمية</span>
          <h1>تعاميم التطويع والمباريات</h1>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في التعاميم" aria-label="ابحث في التعاميم" />
        </header>

        {loading ? <div className="jobs-empty">جار تحميل التعاميم...</div> : null}
        {!loading && error ? <div className="jobs-empty" role="alert">{error}</div> : null}
        {!loading && !error && visibleItems.length === 0 ? <div className="jobs-empty">لا توجد تعاميم مطابقة حالياً.</div> : null}

        <section className="jobs-grid" aria-label="لائحة التعاميم">
          {visibleItems.map((item) => (
            <article className="jobs-card" key={item.id}>
              <div className="jobs-card__header"><span className="jobs-badge jobs-badge--veteran">{item.status}</span></div>
              <h2>{item.title}</h2>
              <p className="jobs-card__employer">{item.apparatusName}</p>
              <div className="jobs-card__meta">
                <span>{formatDate(item.startDate || item.createdAt)}</span>
                {item.announcementNumber ? <span>{item.announcementNumber}</span> : null}
              </div>
              {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">فتح المصدر</a> : null}
            </article>
          ))}
        </section>
      </section>
    </WatanyFeatureTemplate>
  );
}