import { useEffect, useState } from "react";
import { Bookmark24Regular, BookmarkMultiple24Regular } from "../theme/watany-v4/legacyIconBridge";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import InlineInfoButton from "../components/InlineInfoButton";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import { api } from "../lib/api";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/bookmarks-layout-fix.css";


import { WatanyFeatureTemplate } from "../components/template";

const BOOKMARK_DEMO_DETAILS: Record<number, { title: string; subtitle: string; description: string }> = {
  24110982: {
    title: "معاملة تجديد بطاقة المحارب",
    subtitle: "وزارة الدفاع الوطني",
    description: "طلب محفوظ لمتابعة متطلبات التجديد والمرفقات وخطوات التسليم.",
  },
  24108731: {
    title: "منحة التعليم الجامعي للأبناء",
    subtitle: "صندوق دعم العسكريين المتقاعدين",
    description: "مرجع محفوظ يضم شروط الاستحقاق وروابط التقديم ومواعيد الإقفال.",
  },
  24099844: {
    title: "ملف تعويض الإصابة أثناء الخدمة",
    subtitle: "مديرية الرعاية والتعويضات",
    description: "عنصر محفوظ لمراجعة المستندات الطبية ونموذج المطالبة وخطوات المتابعة.",
  },
  24091572: {
    title: "طلب ضم سنوات الخدمة الاحتياطية",
    subtitle: "هيئة شؤون المتقاعدين العسكريين",
    description: "إجراء محفوظ يوضح أهلية الضم وآلية احتساب السنوات والوثائق اللازمة.",
  },
};

function BookmarksPageLegacy() {
  const [items, setItems] = useState<number[]>([]);
  const [error, setError] = useState("");

  async function refreshBookmarks() {
    setError("");
    try {
      const data = await api.getBookmarks();
      setItems(data);
    } catch {
      setError("تعذّر تحميل الإشارات المرجعية.");
    }
  }

  useEffect(() => {
    refreshBookmarks();
  }, []);

  return (
    <div className="wmo-route-normalized panel utility-page watany-utility-page">
      <div className="wmo-route-normalized utility-header watany-utility-page__header">
        <UtilityHeaderTitleRow
          className="wmo-route-normalized"
          titleClassName="wmo-route-normalized utility-title"
          title="الإشارات المرجعية"
          infoText="استعرض العناصر المحفوظة للوصول السريع إليها."
          infoLabel="حول الإشارات المرجعية"
        />
      </div>

      <div className="watany-approved-home-icons wmo-route-normalized utility-action-grid utility-action-grid--compact">
        <button className="wmo-route-normalized utility-action-card" onClick={refreshBookmarks} style={{ "--utility-color": "#ca8a04" } as unknown as React.CSSProperties}>
          <UtilityActionIcon className="wmo-route-normalized" icon={<Bookmark24Regular aria-hidden />} />
          <span className="wmo-route-normalized utility-action-card__label">تحديث</span>
          <span className="wmo-route-normalized utility-action-card__desc">إعادة تحميل الإشارات المرجعية المحفوظة حالياً.</span>
        </button>
        <div className="wmo-route-normalized utility-action-card utility-action-card--static" style={{ "--utility-color": "#475569" } as unknown as React.CSSProperties}>
          <UtilityActionIcon className="wmo-route-normalized" icon={<BookmarkMultiple24Regular aria-hidden />} />
          <span className="wmo-route-normalized utility-action-card__label">الإجمالي</span>
          <span className="wmo-route-normalized utility-action-card__desc">{`${items.length} عنصر محفوظ في قائمة الإشارات المرجعية.`}</span>
        </div>
      </div>

      {error ? <div className="wmo-route-normalized panel-error">{error}</div> : null}
      <div className="wmo-route-normalized panel-hint">هذه الصفحة تعرض المعرفات المحفوظة حالياً إلى حين ربطها بعرض تفصيلي كامل.</div>
      <div className="wmo-route-normalized results watany-utility-page__results">
        {items.map((item) => (
          <div key={item} className="wmo-route-normalized card utility-list-card utility-list-card--compact">
            <div className="wmo-route-normalized utility-list-card__title-row">
              <div className="wmo-route-normalized utility-list-card__title-copy">
                <div className="wmo-route-normalized card-title">{BOOKMARK_DEMO_DETAILS[item]?.title ?? "مرجع محفوظ"}</div>
                <div className="wmo-route-normalized card-sub">{BOOKMARK_DEMO_DETAILS[item]?.subtitle ?? `معرّف الإشارة المرجعية: ${item}`}</div>
                <div className="wmo-route-normalized card-prev">{BOOKMARK_DEMO_DETAILS[item]?.description ?? `العنصر المرتبط بالمعرّف رقم ${item} محفوظ للوصول السريع.`}</div>
              </div>
              <div className="wmo-route-normalized utility-list-card__title-actions">
                <InlineInfoButton text={BOOKMARK_DEMO_DETAILS[item]?.description ?? `العنصر المرتبط بالمعرّف رقم ${item} محفوظ للوصول السريع.`} label={`عرض تفاصيل المرجع ${item}`} />
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? <div className="wmo-route-normalized muted">لا توجد إشارات مرجعية محفوظة حالياً.</div> : null}
      </div>
    </div>
  );
}
export default function BookmarksPage() {
  return (
    <WatanyFeatureTemplate
      category="general"
      eyebrow="WatanyBot unified surface"
      title="Bookmarks"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.1."
      meta={[{ label: "Route", value: "/bookmarks" }]}
      className="watany-template-batch-v141"
    >
      <div data-watany-template-batch="v1.4.1" data-watany-template-route="/bookmarks">
        <BookmarksPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}


