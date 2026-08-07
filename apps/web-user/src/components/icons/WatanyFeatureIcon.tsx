import { getWatanyIconEntry, type WatanyIconKey } from './watanyIconRegistry';
import { WatanyV4Icon, type WatanyV4IconName } from '../../theme/watany-v4';
import '../../styles/watany-icons.css';

export type WatanyFeatureIconProps = {
  iconKey?: WatanyIconKey | string;
  label?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
};

export function WatanyFeatureIcon({
  iconKey = 'default',
  label,
  size = 'lg',
  showLabel = true,
  className = ''
}: WatanyFeatureIconProps) {
  const entry = getWatanyIconEntry(iconKey);
  const visibleLabel = label || entry.labelAr;
  const iconNameByKey: Partial<Record<WatanyIconKey, WatanyV4IconName>> = {
    salary: 'salary', schoolAid: 'schools', procedures: 'procedures', home: 'most-requested', jobs: 'jobs',
    market: 'marketplace', network: 'network', community: 'community', chat: 'messages', settings: 'administration',
    documents: 'documents', laws: 'laws', announcements: 'circulars', deathNotices: 'deaths', voting: 'voting',
    profile: 'profile', help: 'faq', default: 'most-requested',
  };
  const iconName = iconNameByKey[entry.key] || 'most-requested';

  return (
    <span className={`watany-feature-icon watany-feature-icon--${size} ${className}`} dir="rtl">
      <span className={`watany-feature-icon__tile watany-feature-icon__tile--${entry.tone}`}>
        <span className="watany-feature-icon__shine" aria-hidden="true" />
        <span className="watany-feature-icon__symbol">
          <WatanyV4Icon name={iconName} aria-hidden="true" />
        </span>
      </span>
      {showLabel ? <span className="watany-feature-icon__label">{visibleLabel}</span> : null}
    </span>
  );
}

export default WatanyFeatureIcon;
