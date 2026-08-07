import React from "react";
import { getSchoolAidRequiredItem, schoolAidFormItems, schoolAidGuideItems, schoolAidRequiredItems, type SchoolAidRequiredItem } from "./schoolAidsRequiredItems";
import { openSchoolAidViewer } from "./openSchoolAidViewer";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./schoolAidsRequiredFormsPanel.css";

function statusLabel(status: SchoolAidRequiredItem["sourceStatus"]) {
  if (status === "OFFICIAL_FILE_ATTACHED") return "ملف رسمي مرفق";
  if (status === "LOCAL_GUIDE") return "دليل محلي";
  return "قالب محلي بانتظار رفع النموذج الرسمي";
}
function shareItem(item: SchoolAidRequiredItem) {
  const shareData = {
    title: item.titleAr,
    text: `${item.titleAr} - ${item.descriptionAr}`,
    url: item.previewUrl,
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {
      // Fallback: copy to clipboard
      const shareText = `${item.titleAr}\n${item.descriptionAr}\n${item.previewUrl}`;
      navigator.clipboard.writeText(shareText).catch(() => {
        alert("تعذر مشاركة الملف. يرجى المحاولة لاحقاً.");
      });
    });
  } else {
    // Fallback: copy to clipboard
    const shareText = `${item.titleAr}\n${item.descriptionAr}\n${item.previewUrl}`;
    navigator.clipboard.writeText(shareText).then(() => {
      alert("تم نسخ معلومات الملف إلى الحافظة");
    }).catch(() => {
      alert("تعذر مشاركة الملف. يرجى المحاولة لاحقاً.");
    });
  }
}

function SchoolAidItemCard({
  item,
  onBeforeOpenViewer,
  onOpenViewer,
}: Readonly<{
  item: SchoolAidRequiredItem;
  onBeforeOpenViewer?: () => void;
  onOpenViewer?: (item: SchoolAidRequiredItem) => void;
}>) {
  const openPreview = async () => {
    if (onOpenViewer) {
      onOpenViewer(item);
      return;
    }
    onBeforeOpenViewer?.();
    // Let parent popup close first to avoid stacked overlays behind the universal viewer.
    await new Promise((resolve) => globalThis.setTimeout(resolve, 60));
    void openSchoolAidViewer({
      titleAr: item.titleAr,
      previewUrl: item.previewUrl,
      downloadUrl: item.downloadUrl,
    });
  };

  return (
    <article className="school-aid-item-card" data-school-aid-item={item.id}>
      <div className="school-aid-item-card__top"><span>{item.order}</span><span>{item.type === "FORM" ? "نموذج" : "دليل"}</span></div>
      <h3>
        <button type="button" className="school-aid-item-card__title" onClick={openPreview} data-testid={`school-aid-title-${item.id}`}>{item.titleAr}</button>
      </h3>
      <p>{item.descriptionAr}</p>
      <dl>
        <div><dt>يُقدّم إلى</dt><dd>{item.submitToAr}</dd></div>
        <div><dt>مطلوب لـ</dt><dd>{item.requiredForAr}</dd></div>
        <div><dt>حالة الملف</dt><dd>{statusLabel(item.sourceStatus)}</dd></div>
      </dl>
      <div className="school-aid-item-card__actions">
        <button type="button" onClick={openPreview} data-testid={`school-aid-preview-${item.id}`} data-school-aid-preview-trigger="true">عرض</button>
        <a href={item.downloadUrl} target="_blank" rel="noreferrer" download data-testid={`school-aid-download-${item.id}`}>تحميل</a>
        <button type="button" onClick={() => shareItem(item)} data-testid={`school-aid-share-${item.id}`}>شارك</button>
      </div>
    </article>
  );
}

type SchoolAidsRequiredFormsPanelProps = Readonly<{
  mode?: "all" | "forms" | "terms" | "single";
  itemId?: string;
  showHeader?: boolean;
  showNotice?: boolean;
  onBeforeOpenViewer?: () => void;
  onOpenViewer?: (item: SchoolAidRequiredItem) => void;
}>;

function getFilteredItems(mode: string, itemId?: string) {
  const singleItem = mode === "single" && itemId ? getSchoolAidRequiredItem(itemId) : undefined;
  if (mode === "single") {
    return {
      formItems: singleItem?.type === "FORM" ? [singleItem] : [],
      guideItems: singleItem?.type === "GUIDE" ? [singleItem] : [],
    };
  }
  if (mode === "forms") {
    return { formItems: schoolAidFormItems, guideItems: [] };
  }
  if (mode === "terms") {
    return { formItems: [], guideItems: schoolAidGuideItems };
  }
  return { formItems: schoolAidFormItems, guideItems: schoolAidGuideItems };
}

export function SchoolAidsRequiredFormsPanel({
  mode = "all",
  itemId,
  showHeader = true,
  showNotice = true,
  onBeforeOpenViewer,
  onOpenViewer,
}: SchoolAidsRequiredFormsPanelProps) {
  const { formItems, guideItems } = getFilteredItems(mode, itemId)

  return (
    <section
      id="school-grants-forms"
      className="school-aids-required-panel"
      aria-labelledby="school-aids-required-title"
      dir="rtl"
      data-school-aids-panel-mode={mode}
    >
      {showHeader ? (
        <div className="school-aids-required-panel__header">
          <h2 id="school-aids-required-title">النماذج والأوراق المطلوبة</h2>
          <span>{mode === "all" ? schoolAidRequiredItems.length : formItems.length + guideItems.length} عناصر مطلوبة</span>
        </div>
      ) : null}
      {showNotice ? (
        <div className="school-aids-required-panel__notice">
          <strong>تنبيه:</strong> النماذج المحلية أدناه مخصصة للعرض والتنظيم داخل موطني. يجب استبدالها أو تثبيتها بالنسخ الرسمية المعتمدة من الشؤون عند توفرها.
        </div>
      ) : null}
      {formItems.length > 0 ? (
        <div className="school-aids-required-panel__section">
          <h3>{mode === "single" ? "النموذج" : "النماذج الأربعة"}</h3>
          <div className="school-aids-required-panel__grid">{formItems.map((item) => <SchoolAidItemCard key={item.id} item={item} onBeforeOpenViewer={onBeforeOpenViewer} onOpenViewer={onOpenViewer} />)}</div>
        </div>
      ) : null}
      {guideItems.length > 0 ? (
        <div id="school-grants-terms" className="school-aids-required-panel__section">
          <h3>الأوراق والشروط</h3>
          <div className="school-aids-required-panel__grid school-aids-required-panel__grid--single">{guideItems.map((item) => <SchoolAidItemCard key={item.id} item={item} onBeforeOpenViewer={onBeforeOpenViewer} onOpenViewer={onOpenViewer} />)}</div>
        </div>
      ) : null}
    </section>
  );
}
