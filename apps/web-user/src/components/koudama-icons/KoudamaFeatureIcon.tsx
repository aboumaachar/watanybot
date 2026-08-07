import type { ImgHTMLAttributes } from "react";
import { WATANY_V4_ICONS, type WatanyV4IconName } from "../../theme/watany-v4/iconRegistry";

export type KoudamaFeatureIconProps = {
  featureId?: string | null;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  renderMode?: "outline" | "filled";
};

const ICON_ALIASES: Record<string, WatanyV4IconName> = {
  main: "most-requested", home: "most-requested", shortcut: "most-requested",
  assistant: "ask-watany", search: "latest", questions: "faq", help: "faq",
  deaths: "deaths", notifications: "notifications", news: "news", fake_alerts: "fake-fact",
  procedures: "procedures", services: "most-requested", documents: "documents", cases: "documents",
  forms: "forms", assistance: "schools", school_grants: "schools", market: "marketplace",
  marketplace: "marketplace", jobs: "jobs", civilian_jobs: "jobs", taxi: "taxi",
  payment: "salary", pension: "salary", calculator: "salary", laws: "laws", legal: "laws",
  bookmarks: "profile", profile: "profile", admin: "administration", superadmin: "administration",
  install: "install", downloads: "install", fullscreen: "most-requested", logout: "login",
  chat: "messages", messagecircle: "messages", messagessquare: "messages", community: "community",
  network: "network", voting: "voting", world_cup: "world-cup", circulars: "circulars",
  voice: "voice", health: "health",
};

function resolveIconName(featureId?: string | null): WatanyV4IconName {
  const normalized = String(featureId || "most-requested").toLowerCase().replace(/\s+/gu, "_");
  if (normalized in WATANY_V4_ICONS) return normalized as WatanyV4IconName;
  return ICON_ALIASES[normalized] || "most-requested";
}

type V4IconProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { name: WatanyV4IconName };

function V4Icon({ name, className = "", alt = "", ...rest }: V4IconProps) {
  return <img {...rest} src={WATANY_V4_ICONS[name]} alt={alt} className={["watany-v4-icon", className].filter(Boolean).join(" ")} />;
}

export function KoudamaFeatureIcon({ featureId, label, size = "md", className = "" }: Readonly<KoudamaFeatureIconProps>) {
  const name = resolveIconName(featureId);
  const fallbackLabel = label || featureId || "خدمة";

  return (
    <span
      className={`koudama-feature-icon koudama-feature-icon--${size} ${className}`}
      title={fallbackLabel}
      data-koudama-feature-id={featureId || "most-requested"}
      data-watany-v4-icon={name}
      data-watany-icon-authority="v4"
    >
      <span className="koudama-feature-icon__tile" aria-hidden="true">
        <V4Icon name={name} className="koudama-feature-icon__raster" />
      </span>
    </span>
  );
}

export default KoudamaFeatureIcon;
