import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { AlWafiyatNotice } from "./alWafiyat.types";
import "./AlWafiyatCompactListing.css";

type ViewNotice = {
  id: string;
  name: string;
  date: string;
  details: Array<{ label: string; value: string }>;
};

const titleForbiddenText = [
  "منشور بعد الاعتماد الإداري",
  "معتمد",
  "وفيات الجيش اللبناني",
  "وفيات قوى الأمن الداخلي",
  "وفيات قوى الامن الداخلي",
  "وفيات المديرية العامة للأمن العام"
];

const detailForbiddenText = [
  "منشور بعد الاعتماد الإداري",
  "معتمد"
];

function cleanText(value?: string | null, forbiddenText: string[] = detailForbiddenText) {
  let text = (value || "").replace(/\s+/g, " ").trim();
  for (const forbidden of forbiddenText) {
    text = text.split(forbidden).join("").replace(/\s+/g, " ").trim();
  }
  return text.replace(/^[-–—:|]+|[-–—:|]+$/g, "").trim();
}

function formatDate(value: string) {
  if (!value) return "تاريخ غير متوفر";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ar-LB", { year: "numeric", month: "long", day: "numeric" }).format(parsed);
}

function addDetail(details: ViewNotice["details"], label: string, value?: string | null) {
  const cleaned = cleanText(value, detailForbiddenText);
  if (cleaned && !details.some((detail) => detail.value === cleaned)) {
    details.push({ label, value: cleaned });
  }
}

function toViewNotice(item: AlWafiyatNotice, index: number): ViewNotice {
  const name = cleanText(item.title, titleForbiddenText) || `وفيات رقم ${index + 1}`;
  const details: Array<{ label: string; value: string }> = [];
  addDetail(details, "الرتبة", item.rank);
  addDetail(details, "الجهة", item.apparatus);
  const rawText = cleanText(item.rawText, detailForbiddenText);
  if (rawText && rawText !== name && !details.some((detail) => detail.value === rawText)) {
    details.push({ label: "التفاصيل", value: rawText });
  }

  return {
    id: item.id || `approved-notice-${index + 1}`,
    name,
    date: formatDate(item.noticeDate),
    details
  };
}

const fallbackNotices: ViewNotice[] = [];

export default function AlWafiyatPage() {
  const [items, setItems] = useState<ViewNotice[]>(fallbackNotices);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await api.listAlWafiyat({ limit: 100 });
        const normalized = (Array.isArray(response.items) ? response.items : [])
          .map((item, index) => toViewNotice(item, index))
          .filter((item) => item.name);
        if (active) setItems(normalized);
      } catch {
        if (active) setItems(fallbackNotices);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const sortedItems = useMemo(() => items, [items]);

  return (
    <main dir="rtl" className="wafiyat-page">
      <header className="wafiyat-hero">
        <h1>الوفيات</h1>
      </header>

      {loading && <div className="wafiyat-empty">جارٍ تحميل الوفيات...</div>}

      {!loading && sortedItems.length === 0 && (
        <div className="wafiyat-empty">لا توجد وفيات معتمدة للعرض حالياً.</div>
      )}

      <section className="wafiyat-list" aria-label="قائمة الوفيات">
        {sortedItems.map((notice) => (
          <details className="wafiyat-card" key={notice.id}>
            <summary className="wafiyat-summary">
              <span className="wafiyat-name">{notice.name}</span>
              <time className="wafiyat-date">{notice.date}</time>
            </summary>

            <div className="wafiyat-details">
              {notice.details.length > 0 ? (
                notice.details.map((detail) => (
                  <div className="wafiyat-detail-row" key={`${detail.label}-${detail.value}`}>
                    <strong>{detail.label}</strong>
                    <span>{detail.value}</span>
                  </div>
                ))
              ) : (
                <p className="wafiyat-muted">لا توجد تفاصيل إضافية متاحة.</p>
              )}
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}
