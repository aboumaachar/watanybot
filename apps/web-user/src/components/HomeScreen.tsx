import { KoudamaGroupedDashboard } from './KoudamaGroupedDashboard';
import { IconShell } from './IconShell';
import KoudamaFeatureIcon from './koudama-icons/KoudamaFeatureIcon';
import type { Mode } from "../store/app";
import { useFeatureFlags } from "../store/features";
import type { FeatureId } from "../store/features";
import { useNavigate } from "react-router-dom";
import { SmartDashboardStageASection } from '../features/smart-dashboard/stage-a';
import { SmartAttentionDashboardIcons } from '../features/smart-attention-native';
// APEX_CSS_FREEZE_DISABLED_IMPORT import '../features/smart-dashboard/stage-a/smart-dashboard-stage-a.css';

type Props = Readonly<{ onNavigate: (mode: Mode) => void }>;

/* ── Quick tiles for home grid ──────────────────────────── */
type HomeTile = {
  id: string;
  iconFeatureId: string;
  label: string;
  color: string;
  mode?: Mode;
  externalUrl?: string;
  event?: string;
  eventDetail?: Record<string, unknown>;
  routePath?: string;
  featureId?: FeatureId;
};

const OFFICIAL_PENSION_SOURCE_URL = "https://eservices.finance.gov.lb/RetiredInfo.aspx";

const HOME_TILES: HomeTile[] = [
  { id: "salary",    iconFeatureId: "calculator", label: "حاسبة المعاش",       color: "green",  mode: "salary",        featureId: "salary" },
  { id: "install",   iconFeatureId: "install", label: "تثبيت التطبيق", color: "teal", event: "watany-open-install-prompt" },
  { id: "favorites", iconFeatureId: "saved", label: "المحفوظات", color: "purple", routePath: "/saved", featureId: "saved" },
  { id: "salary-attestation", iconFeatureId: "payment", label: "إفادة بالراتب", color: "orange", externalUrl: OFFICIAL_PENSION_SOURCE_URL, featureId: "salary" },
  { id: "grants",    iconFeatureId: "assistance", label: "المساعدات المدرسية", color: "blue",   mode: "school-grants", featureId: "school-grants" },
  { id: "phonebook", iconFeatureId: "phone", label: "الدليل",             color: "orange", event: "watany-open-directory" },
];

export function HomeScreen({ onNavigate }: Props) {
  const { isModeEnabled, isEnabled } = useFeatureFlags();
  const navigate = useNavigate();
  const formsEnabled = isEnabled('forms');

  function handleTile(tile: HomeTile) {
    if (tile.externalUrl) {
      globalThis.location.assign(tile.externalUrl);
      return;
    }
    if (tile.event) {
      globalThis.dispatchEvent(new CustomEvent(tile.event, { detail: tile.eventDetail ?? {} }));
      return;
    }
    if (tile.routePath) {
      navigate(tile.routePath);
      return;
    }
    if (tile.featureId && !isEnabled(tile.featureId)) return;
    if (tile.mode && !isModeEnabled(tile.mode)) return;
    if (tile.mode) onNavigate(tile.mode);
  }

  function isTileVisible(tile: HomeTile): boolean {
    if (tile.featureId && !isEnabled(tile.featureId)) return false;
    if (tile.mode && !isModeEnabled(tile.mode)) return false;
    return true;
  }

  return (
    <div className="home-screen-v2">
      <SmartDashboardStageASection apiBaseUrl="" />
      <SmartAttentionDashboardIcons />
      <KoudamaGroupedDashboard />

      {/* ── Hero ────────────────────────────────── */}
      <section className="hybrid-hero home-hero-v2">
        <span className="hybrid-hero__eyebrow"></span>
        <h1 className="hybrid-hero__title">شو بتريد تعمل هلأ؟</h1>

        <div className="hybrid-hero__actions">
          <button
            className="hybrid-hero__button hybrid-hero__button--primary hybrid-hero__button--wide"
            onClick={() => onNavigate("chat")}
          >
            <KoudamaFeatureIcon featureId="assistant" size="sm" renderMode="filled" />
          </button>
          <button className="hybrid-hero__button" onClick={() => navigate("/")}>
            <KoudamaFeatureIcon featureId="home" size="sm" renderMode="filled" /> جرّب Mobile OS
          </button>
          <button className="hybrid-hero__button" onClick={() => onNavigate("salary")}>
            <KoudamaFeatureIcon featureId="calculator" size="sm" renderMode="filled" /> حاسبة المعاش
          </button>
          {formsEnabled ? (
            <button className="hybrid-hero__button" onClick={() => navigate("/forms")}>
              <KoudamaFeatureIcon featureId="forms" size="sm" renderMode="filled" /> النماذج
            </button>
          ) : null}
        </div>
      </section>

      {/* ── Quick launcher grid (4×2) ────────────── */}
      <section>
        <div className="home-section-row">
          <span className="home-section-title">إجراءات سريعة</span>
          <button className="home-section-link" onClick={() => onNavigate("services")}>
            كل الخدمات ←
          </button>
        </div>
        <div className="home-quick-grid-4" style={{ marginTop: 8 }}>
          {HOME_TILES.filter(isTileVisible).map((tile) => (
            <button
              key={tile.id}
              data-feature-key={tile.id}
              className={`app-tile app-tile--${tile.color}`}
              onClick={() => handleTile(tile)}
            >
              <IconShell className="app-tile__icon koudama-icon-shell" aria-hidden="true">
                <KoudamaFeatureIcon featureId={tile.iconFeatureId} size="sm" renderMode="filled" />
              </IconShell>
              <span className="app-tile__label">{tile.label}</span>
            </button>
          ))}
        </div>
      </section>

    </div>
  );
}

