import { useRef } from "react";
import type { SmartPopupCampaign } from "../lib/smartPopupCampaigns";

type SmartActionPopupProps = {
  campaign: SmartPopupCampaign | null;
  onApply: () => void;
  onCancel: () => void;
};

export function SmartActionPopup({ campaign, onApply, onCancel }: SmartActionPopupProps) {
  const touchStartX = useRef<number>(0);

  if (!campaign) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (deltaX > 72) onCancel();
  }

  return (
    <div
      className="watany-smart-popup-backdrop"
      role="presentation"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <section className="watany-smart-popup-card" role="dialog" aria-modal="true" aria-labelledby="watany-smart-popup-title" dir="rtl">
        <button type="button" className="watany-smart-popup-close" onClick={onCancel} aria-label="إغلاق">×</button>
        <div className="watany-smart-popup-badge">موطني</div>
        <h2 id="watany-smart-popup-title">{campaign.titleAr}</h2>
        <p>{campaign.bodyAr}</p>
        <div className="watany-smart-popup-actions">
          <button type="button" className="watany-smart-popup-apply" onClick={onApply}>{campaign.applyLabelAr || "تطبيق"}</button>
          <button type="button" className="watany-smart-popup-cancel" onClick={onCancel}>{campaign.cancelLabelAr || "إلغاء"}</button>
        </div>
      </section>
    </div>
  );
}