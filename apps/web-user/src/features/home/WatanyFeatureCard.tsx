import React from 'react';
import type { WatanyFeatureCard } from './watanyFeatureCards';
import { RoyalGoldFrame, WatanyV4Icon } from '../../theme/watany-v4';
import { getWatanyV4IconName } from '../../theme/watany-v4/featureIconMap';

export default function WatanyFeatureCardView({ card }: { card: WatanyFeatureCard }) {
  const iconName = getWatanyV4IconName(card.iconKey === 'market' ? 'marketplace' : card.iconKey);
  return (
    <a href={card.route} className="watany-feature-card" aria-label={card.titleAr}>
      <RoyalGoldFrame className="watany-feature-card__tile">
        <WatanyV4Icon name={iconName} alt="" aria-hidden="true" />
      </RoyalGoldFrame>
      <div className="watany-feature-card__meta">
        <div className="watany-feature-card__title">{card.titleAr}</div>
        {card.descriptionAr && <div className="watany-feature-card__desc">{card.descriptionAr}</div>}
      </div>
    </a>
  );
}
