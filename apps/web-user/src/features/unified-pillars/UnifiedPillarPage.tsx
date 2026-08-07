/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { WatanyLandingBodyTemplate } from "../../components/template";
import { WatanyAppIcon } from "../../components/watanybot/WatanyAppIcon";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../../components/watanybot/watany-drawer.css";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../../components/watanybot/watany-drawer-overrides.css";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./unified-pillars.css";
import {
  getUnifiedPillarConfig,
  type UnifiedPillarConfig,
  type UnifiedPillarId,
} from "./pillar-config";
import { WORLD_CUP_FEATURES, type WorldCupFeatureId } from "../../components/worldcup/worldCupFeatures";
import { worldCupMatches } from "../../data/worldCupMatches";
import { WorldCupAgendaSection } from "../../components/worldcup/WorldCupAgendaSection";
import { WorldCupResultsSection } from "../../components/worldcup/WorldCupResultsSection";
import { WorldCupTeamsSection } from "../../components/worldcup/WorldCupTeamsSection";
import { WorldCupPredictionPolls } from "../../components/worldcup/WorldCupPredictionPolls";
import { WorldCupNewsSection } from "../../components/worldcup/WorldCupNewsSection";
import { WorldCupLiveLinks } from "../../components/worldcup/WorldCupLiveLinks";
import { WorldCupBracketChart } from "../../components/worldcup/WorldCupBracketChart";
import { WorldCupMatchCard } from "../../components/worldcup/WorldCupMatchCard";
import { WorldCupMatchDetail } from "../../components/worldcup/WorldCupMatchDetail";
import { api, type WorldCupMatchDto } from "../../lib/api";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../../styles/world-cup.css";

const WORLD_CUP_FEATURES_UNIQUE = WORLD_CUP_FEATURES.filter((item, index, all) => {
  return all.findIndex((candidate) => candidate.path === item.path) === index;
});

function renderIcon(icon: string | React.ComponentType<React.SVGProps<SVGSVGElement>>) {
  if (typeof icon === "string" || typeof icon === "number") {
    return icon;
  }
  return React.createElement(icon, { "aria-hidden": "true" });
}

function WorldCupTodaySection() {
  const [todayMatches, setTodayMatches] = useState<WorldCupMatchDto[] | null>(null);

  useEffect(() => {
    let active = true;

    void api
      .getWorldCupTodayHomeMatches()
      .then((matches) => {
        if (active) {
          setTodayMatches(matches);
        }
      })
      .catch(() => {
        if (active) {
          setTodayMatches([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const displayMatches = todayMatches ?? [];

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm wc-today-section" dir="rtl">
      <h2 className="mb-4 text-xl font-bold">مباريات اليوم</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {displayMatches.length > 0 ? (
          displayMatches.map((match) => <WorldCupMatchCard key={match.id} match={match} />)
        ) : (
          <p className="text-sm text-slate-600 md:col-span-2">
            {todayMatches === null ? "جارٍ تحميل مباريات اليوم." : "لا توجد مباريات اليوم."}
          </p>
        )}
      </div>
    </section>
  );
}

function WorldCupRouteContent({ pathname }: Readonly<{ pathname: string }>) {
  if (pathname.startsWith("/world-cup/match/")) {
    const matchId = pathname.split("/").filter(Boolean).at(2) ?? "";
    const match = worldCupMatches.find((item) => item.id === matchId);
    return <WorldCupMatchDetail matchId={matchId} match={match} />;
  }

  if (pathname === "/world-cup/today") return <WorldCupTodaySection />;
  if (pathname === "/world-cup/matches") return <WorldCupAgendaSection />;
  if (pathname === "/world-cup/results") return <WorldCupResultsSection />;
  if (pathname === "/world-cup/race") return <WorldCupResultsSection />;
  if (pathname === "/world-cup/teams") return <WorldCupTeamsSection />;
  if (pathname === "/world-cup/polls") return <WorldCupPredictionPolls />;
  if (pathname === "/world-cup/news") return <WorldCupNewsSection />;
  if (pathname === "/world-cup/live") return <WorldCupLiveLinks />;
  if (pathname === "/world-cup/bracket") return <WorldCupBracketChart />;
  if (pathname === "/world-cup/agenda") return <WorldCupAgendaSection />;

  return null;
}

function isWorldCupFeatureActive(pathname: string, path: string, id: WorldCupFeatureId) {
  return pathname === path || pathname.startsWith(`${path}/`) || (pathname === "/world-cup" && id === "today");
}

const WORLD_CUP_ICON_ITEMS = [
  { id: "wc-home",    label: "Home",      labelAr: "الرئيسية",    route: "/",                   icon: "home",     color: "navy"  as const },
  { id: "wc-today",   label: "Today",     labelAr: "مباريات اليوم", route: "/world-cup/today",  icon: "calendar", color: "green" as const },
  { id: "wc-matches", label: "Matches",   labelAr: "الجدول",      route: "/world-cup/matches",  icon: "list",     color: "navy"  as const },
  { id: "wc-results", label: "Results",   labelAr: "النتائج",     route: "/world-cup/results",  icon: "check",    color: "slate" as const },
  { id: "wc-teams",   label: "Teams",     labelAr: "المنتخبات",   route: "/world-cup/teams",    icon: "people",   color: "navy"  as const },
  { id: "wc-bracket", label: "Bracket",   labelAr: "شجرة البطولة", route: "/world-cup/bracket", icon: "star",     color: "green" as const },
  { id: "wc-polls",   label: "Polls",     labelAr: "التصويتات",   route: "/world-cup/polls",    icon: "poll",     color: "slate" as const },
  { id: "wc-live",    label: "Live",      labelAr: "البث",        route: "/world-cup/live",     icon: "video",    color: "red"   as const },
  { id: "wc-news",    label: "News",      labelAr: "الأخبار",     route: "/world-cup/news",     icon: "news",     color: "slate" as const },
];

function WorldCupLaunchers(_props: { readonly pathname: string }) {
  return (
    <section className="watany-icon-grid" aria-label="روابط كأس العالم">
      {WORLD_CUP_ICON_ITEMS.map((item) => (
        <WatanyAppIcon key={item.id} item={item} />
      ))}
    </section>
  );
}

function WorldCupPillarView({ title, _subtitle, pathname }: { readonly title: string; readonly _subtitle: string; readonly pathname: string }) {
  const isRoot = pathname === "/world-cup" || pathname === "/world-cup/";

  if (!isRoot) return <WorldCupRouteContent pathname={pathname} />;

  return (
    <>
      <section className="unified-pillar__hero" aria-labelledby="world-cup-title">
        <div className="unified-pillar__hero-copy">
          <h1 id="world-cup-title">{title}</h1>
        </div>
      </section>
      <WorldCupLaunchers pathname={pathname} />
      <WorldCupTodaySection />
    </>
  );
}

type StandardPillarViewProps = Readonly<{
  readonly config: UnifiedPillarConfig;
  readonly query: string;
  readonly setQuery: React.Dispatch<React.SetStateAction<string>>;
  readonly activeFilter: string;
  readonly setActiveFilter: React.Dispatch<React.SetStateAction<string>>;
}>;

function StandardPillarView({
  config,
  query,
  setQuery,
  activeFilter,
  setActiveFilter,
}: StandardPillarViewProps) {
  const filteredNavItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized === "") return config.navItems;
    return config.navItems.filter((item) => {
      const combined = `${item.label} ${item.description}`.toLowerCase();
      return combined.includes(normalized);
    });
  }, [config.navItems, query]);

  const showEmptyState = filteredNavItems.length === 0;

  return (
    <>
      <section className="unified-pillar__hero" aria-labelledby={`${config.id}-title`}>
        <div className="unified-pillar__hero-copy">
          <span className="unified-pillar__eyebrow">موطني · تصميّم موحد</span>
          <h1 id={`${config.id}-title`}>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="unified-pillar__hero-icon" aria-hidden="true">
          {renderIcon(config.icon)}
        </div>
      </section>

      <section className="unified-pillar__search" aria-label="البحث والتصفية">
        <label className="unified-pillar__search-box">
          <span>بحث</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={config.searchPlaceholder} />
        </label>

        <div className="unified-pillar__filters" aria-label="الترتيب والتصفية">
          {config.filters.map((filter) => (
            <label key={filter.id}>
              <span>{filter.label}</span>
              <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
                {filter.options.map((option) => (
                  <option key={`${filter.id}-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="unified-pillar__widgets" aria-label="ملخص سريع">
        {config.widgets.map((widget) => (
          <article key={`${config.id}-${widget.label}`} className="unified-pillar__widget">
            <span>{widget.label}</span>
            <strong>{widget.value}</strong>
            <small>{widget.detail}</small>
          </article>
        ))}
      </section>

      <section className="unified-pillar__grid" aria-label="أقسام الخدمة">
        {filteredNavItems.map((item) => (
          <Link key={item.id} to={item.route} className="unified-pillar__card" data-feature-key={item.id}>
            <span className="unified-pillar__card-icon" aria-hidden="true">
              {renderIcon(item.icon)}
            </span>
            <span className="unified-pillar__nav-label">{item.label}</span>
            <p>{item.description}</p>
          </Link>
        ))}
      </section>
      {showEmptyState ? (
        <section className="unified-pillar__empty" aria-live="polite">{config.emptyState}</section>
      ) : null}
    </>
  );
}

function UnifiedPillarPage({ pillarId }: Readonly<{ pillarId: UnifiedPillarId }>) {
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const config = getUnifiedPillarConfig(pillarId);
  const isWorldCup = pillarId === "world-cup";

  const body: React.ReactNode = isWorldCup ? (
    <WorldCupPillarView title={config.title} _subtitle={config.subtitle} pathname={location.pathname} />
  ) : (
    <StandardPillarView
      config={config}
      query={query}
      setQuery={setQuery}
      activeFilter={activeFilter}
      setActiveFilter={setActiveFilter}
    />
  );

  return (
    <WatanyLandingBodyTemplate>
      <main className={`unified-pillar unified-pillar-${config.accent}${isWorldCup ? " wc-page" : ""}`} dir="rtl">
        {body}
      </main>
    </WatanyLandingBodyTemplate>
  );
}
export { UnifiedPillarPage };
export default UnifiedPillarPage;
