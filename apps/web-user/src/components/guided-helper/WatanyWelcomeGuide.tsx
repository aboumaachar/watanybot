import React, { useRef } from 'react';
import { WATANY_WELCOME_GUIDES } from './watanyGuideRegistry';
import { recordWatanyGuideEvent } from './watanyGuideTracker';
import WatanyFeatureIcon from '../icons/WatanyFeatureIcon';
import '../../styles/watany-guided-helper.css';

export type WatanyWelcomeGuideProps = {
  open: boolean;
  onClose: () => void;
  onNavigate?: (route: string) => void;
};

function iconKeyForFeature(featureKey: string) {
  if (featureKey === 'school_aid') return 'schoolAid';
  if (featureKey === 'home') return 'home';
  if (featureKey === 'procedures') return 'procedures';
  if (featureKey === 'salary') return 'salary';
  return 'default';
}

export function WatanyWelcomeGuide({ open, onClose, onNavigate }: WatanyWelcomeGuideProps) {
  const touchStartX = useRef<number>(0);

  if (!open) return null;

  function selectGuide(guide: typeof WATANY_WELCOME_GUIDES[number]) {
    recordWatanyGuideEvent({
      guideKey: guide.guideKey,
      featureKey: guide.featureKey,
      status: 'clicked_cta',
      targetRoute: guide.targetRoute
    });

    if (onNavigate) onNavigate(guide.targetRoute);
    else if (typeof window !== 'undefined') window.location.href = guide.targetRoute;
  }

  function dismiss() {
    recordWatanyGuideEvent({
      guideKey: 'watany_first_entry_welcome',
      featureKey: 'welcome',
      status: 'dismissed'
    });
    onClose();
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) dismiss();
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (deltaX > 72) dismiss();
  }

  return (
    <div
      className="watany-guide-overlay"
      dir="rtl"
      role="presentation"
      onClick={handleOverlayClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <section className="watany-guide-card" role="dialog" aria-modal="true" aria-labelledby="watanyWelcomeTitle">
        <button className="watany-guide-close" type="button" onClick={dismiss} aria-label="إغلاق">×</button>
        <div className="watany-guide-brand">موطني</div>
        <h1 id="watanyWelcomeTitle">أهلاً وسهلاً في موطني 👋</h1>
        <p className="watany-guide-subtitle">مساعدك الذكي<br />من أين تحب أن تبدأ؟</p>

        <div className="watany-guide-grid">
          {WATANY_WELCOME_GUIDES.map((guide) => (
            <button key={guide.guideKey} className="watany-guide-cta" type="button" onClick={() => selectGuide(guide)}>
              <WatanyFeatureIcon iconKey={iconKeyForFeature(guide.featureKey)} label={guide.ctaLabelAr} size="xl" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default WatanyWelcomeGuide;
