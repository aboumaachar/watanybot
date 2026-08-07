import { useEffect, useState } from 'react';
import { loadSmartDashboardStageA } from './smart-dashboard-stage-a-client';
import type { SmartDashboardCard, SmartDashboardLoadState } from './smart-dashboard-stage-a-types';

type Props = {
  apiBaseUrl?: string;
  maxCards?: number;
};

function SmartCard({ card }: { card: SmartDashboardCard }) {
  return (
    <a
      href={card.route}
      className="smart-dashboard-stage-a-card"
      data-smart-dashboard-feature={card.feature_key}
      aria-label={card.title_ar}
    >
      <span className="smart-dashboard-stage-a-card-icon" aria-hidden="true">◆</span>
      <span className="smart-dashboard-stage-a-card-title">{card.title_ar}</span>
      {card.reason_label ? <span className="smart-dashboard-stage-a-card-reason">{card.reason_label}</span> : null}
    </a>
  );
}

export function SmartDashboardStageASection({ apiBaseUrl = '', maxCards = 7 }: Props) {
  const [state, setState] = useState<SmartDashboardLoadState>({ status: 'idle' });

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadSmartDashboardStageA(apiBaseUrl).then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, [apiBaseUrl]);

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <section className="smart-dashboard-stage-a" dir="rtl" aria-label="صفحتي الذكية">
        <h2>مختار لك</h2>
        <p>يتم تحميل الاقتراحات...</p>
      </section>
    );
  }

  if (state.status !== 'ready') {
    return null;
  }

  const cards = [
    ...(state.data.critical_zone || []),
    ...(state.data.personalized_zone || []),
    ...(state.data.default_zone || []),
  ].slice(0, maxCards);

  if (cards.length === 0) return null;

  return (
    <section className="smart-dashboard-stage-a" dir="rtl" aria-label="صفحتي الذكية">
      <h2>مختار لك</h2>
      <div className="smart-dashboard-stage-a-grid">
        {cards.map((card, index) => (
          <SmartCard key={card.feature_key || `${card.route}-${index}`} card={card} />
        ))}
      </div>
    </section>
  );
}

export default SmartDashboardStageASection;
