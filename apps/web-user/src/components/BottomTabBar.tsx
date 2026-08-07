import KoudamaFeatureIcon from './koudama-icons/KoudamaFeatureIcon';
import type { Mode } from "../store/app";
import { useFeatureFlags } from "../store/features";
import type { TabId } from "./bottom-tab-model";

type Tab = {
  id: TabId;
  label: string;
  mode: Mode;
  badge?: number;
};

const TABS: Tab[] = [
  { id: "home",       label: "الرئيسية",  mode: "home" },
  { id: "community",  label: "مجتمعي",   mode: "community" },
  { id: "services",   label: "الخدمات",   mode: "services" },
  { id: "documents",  label: "المستندات", mode: "documents" },
  { id: "profile",    label: "ملفي",     mode: "profile" },
];

type Props = Readonly<{
  activeTab: TabId;
  onTabChange: (mode: Mode) => void;
  notificationCount?: number;
}>;

export function BottomTabBar({ activeTab, onTabChange, notificationCount = 0 }: Props) {
  const { isEnabled } = useFeatureFlags();
  const visibleTabs = TABS.filter((tab) => {
    if (tab.mode === "documents") return isEnabled("documents");
    if (tab.mode === "profile") return isEnabled("profile");
    return true;
  });

  return (
    <nav data-wmo-duplicate-bottom-nav="true" className="tab-bar bottom-tab-bar" data-testid="bottom-tab-bar" aria-label="التنقل الرئيسي">
      {visibleTabs.map(tab => {
        const isActive = tab.id === activeTab;
        const badge = tab.id === "profile" && notificationCount > 0 ? notificationCount : undefined;
        return (
          <button
            type="button"
            key={tab.id}
            data-feature-key={tab.id}
            aria-current={isActive ? "page" : undefined}
            className={`tab-btn ${isActive ? "active" : ""}`}
            onClick={() => onTabChange(tab.mode)}
            title={tab.label}
          >
            <span data-wmo-duplicate-bottom-nav="true" className="tab-icon" data-testid="bottom-tab-bar">
              <KoudamaFeatureIcon featureId={tab.id} size="sm" className={isActive ? "koudama-feature-icon--active-tab" : ""} />
              {badge ? <span data-wmo-duplicate-bottom-nav="true" className="tab-badge" data-testid="bottom-tab-bar">{badge > 9 ? "9+" : badge}</span> : null}
            </span>
            <span data-wmo-duplicate-bottom-nav="true" className="tab-label" data-testid="bottom-tab-bar">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
// APEX_PHASE4D_NAV_DUPLICATE_REVIEW: verify whether this component is still needed under WatanyMobileShell.
// APEX_PHASE4E_BOTTOM_NAV_DEDUP: hidden only when rendered inside WatanyMobileShell route content.

