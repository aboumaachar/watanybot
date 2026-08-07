import KoudamaFeatureIcon from "../koudama-icons/KoudamaFeatureIcon";
import { NAV_ITEMS, BOTTOM_TAB_IDS } from "./navItems";

function mapNavItemToFeatureId(id: string): string {
  switch (id) {
    case 'chat':
      return 'assistant';
    case 'search':
      return 'global_search';
    case 'salary':
      return 'calculator';
    case 'pension':
      return 'payment';
    case 'cases':
      return 'documents';
    case 'notifications':
      return 'notifications';
    case 'jobs':
      return 'jobs';
    case 'marketplace':
      return 'market';
    case 'alerts':
      return 'fake_alerts';
    case 'profile':
      return 'profile';
    case 'saved':
      return 'documents';
    case 'bookmarks':
      return 'laws';
    case 'procedures':
      return 'procedures';
    default:
      return id;
  }
}

/**
 * BottomTabRailNav — Desktop: slim icon rail on the side, expandable on hover.
 *                    Mobile: 5-tab bar at the bottom.
 */
export function BottomTabRailNav({
  activeMode,
  onSelect,
  badgeCounts,
}: {
  readonly activeMode: string;
  readonly onSelect: (id: string) => void;
  readonly badgeCounts?: Record<string, number>;
}) {
  return (
    <div data-wmo-duplicate-bottom-nav="true" className="nav-bottom-tab-rail">
      {/* Desktop Rail */}
      <nav data-wmo-duplicate-bottom-nav="true" className="nav-rail ds-card">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            data-feature-key={item.id}
            className={`rail-item ${activeMode === item.id ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
            title={item.label}
          >
            <span data-wmo-duplicate-bottom-nav="true" className="rail-icon"><KoudamaFeatureIcon featureId={mapNavItemToFeatureId(item.id)} size="sm" className={activeMode === item.id ? 'koudama-feature-icon--active-rail' : ''} /></span>
            <span data-wmo-duplicate-bottom-nav="true" className="rail-label">{item.label}</span>
            {badgeCounts?.[item.id] ? (
              <span data-wmo-duplicate-bottom-nav="true" className="ds-badge" style={{ marginInlineStart: "auto" }}>{badgeCounts[item.id]}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* Mobile Bottom Tabs */}
      <nav data-wmo-duplicate-bottom-nav="true" className="nav-bottom-tabs ds-card">
        {NAV_ITEMS.filter((i) => BOTTOM_TAB_IDS.includes(i.id)).map((item) => (
          <button
            key={item.id}
            data-feature-key={item.id}
            className={`tab-item ${activeMode === item.id ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <span data-wmo-duplicate-bottom-nav="true" className="tab-icon" style={{ position: "relative" }}>
              <KoudamaFeatureIcon featureId={mapNavItemToFeatureId(item.id)} size="sm" className={activeMode === item.id ? 'koudama-feature-icon--active-tab' : ''} />
              {badgeCounts?.[item.id] ? <span data-wmo-duplicate-bottom-nav="true" className="tab-badge">{badgeCounts[item.id]}</span> : null}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
// APEX_PHASE4D_NAV_DUPLICATE_REVIEW: verify whether this component is still needed under WatanyMobileShell.
// APEX_PHASE4E_BOTTOM_NAV_DEDUP: hidden only when rendered inside WatanyMobileShell route content.

