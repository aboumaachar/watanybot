import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { resolveNotificationBadgeFeatureKey } from "../../features/notification-badges/notification-badge-types";
import { WatanyFluentIcon, type WatanyIconName } from "../icons/WatanyFluentIcon";
import type { WatanyDrawerItem } from "./watanyDrawerItems";
import { RoyalGoldFrame, SchoolFormIcon, WatanyV4Icon, type SchoolFormIconName, type WatanyV4IconName } from "../../theme/watany-v4";

export type { WatanyDrawerItem };

type WatanyAppIconProps = {
  item: WatanyDrawerItem;
  asButton?: boolean;
  onClick?: () => void;
  automationId?: string;
  schoolFormIcon?: SchoolFormIconName;
};

type IconRouteKind = {
  useAnchor: boolean;
  isFileRoute: boolean;
};

type WatanyAppIconSignStyle = CSSProperties & {
  "--watany-icon-sign"?: string;
};

type WatanyIconElementProps = {
  className: string;
  "aria-label": string;
  "data-watany-icon-render"?: "sign";
  "data-watany-asset-render"?: "exact-viewer";
  "data-sign"?: string;
  style?: WatanyAppIconSignStyle;
  "data-notification-feature-key"?: string;
};

type WatanyAppIconRenderState = {
  label: string;
  disabled: boolean;
  elementProps: WatanyIconElementProps;
  sign: string | undefined;
  schoolFormIcon: SchoolFormIconName | undefined;
};

function getIconRouteKind(route: string): IconRouteKind {
  const isExternalRoute = /^https?:\/\//i.test(route);
  const isFileRoute = /\.(pdf|html?)$/i.test(route);
  const isHashRoute = route.includes("#");
  return {
    useAnchor: isExternalRoute || isFileRoute || isHashRoute,
    isFileRoute,
  };
}

function getWatanyNotificationFeatureKey(item: WatanyDrawerItem): string | undefined {
  const byId: Record<string, string> = {
    marketplace: "market",
    laws: "legal",
    "official-tools": "official-services",
    "world-cup": "worldcup",
  };

  const candidate = byId[item.id] || item.id;
  const normalized = resolveNotificationBadgeFeatureKey(candidate);
  return normalized.length > 0 ? normalized : undefined;
}

function getWatanyAppIconAsset(item: WatanyDrawerItem): WatanyV4IconName | undefined {
  const assetByFeatureId: Record<string, WatanyV4IconName> = {
    "sg-calculator": "calculator",
    "sg-tariff": "tariff",
    login: "login",
    bookmarks: "profile",
    "saved-chats": "messages",
    settings: "profile",
    documents: "documents",
    news: "news",
    "fake-fact": "fake-fact",
    circulars: "circulars",
    marketplace: "marketplace",
    jobs: "jobs",
    salary: "salary",
    forms: "forms",
    schools: "schools",
    network: "network",
    taxi: "taxi",
    voting: "voting",
    faq: "faq",
    laws: "laws",
    procedures: "procedures",
    "world-cup": "world-cup",
    community: "community",
    voice: "voice",
    "chat-sessions": "messages",
    deaths: "deaths",
    health: "health",
  };

  return assetByFeatureId[item.id];
}

function renderIconFace(item: WatanyDrawerItem, label: string, sign: string | undefined, schoolFormIcon: SchoolFormIconName | undefined) {
  const asset = getWatanyAppIconAsset(item);
  return (
    <>
      <RoyalGoldFrame className="watany-app-icon__tile" data-sign={sign}>
        <span className="watany-app-icon__glyph" aria-hidden="true">
          {schoolFormIcon ? <SchoolFormIcon className="watany-app-icon__asset" name={schoolFormIcon} aria-hidden="true" /> : asset ? <WatanyV4Icon className="watany-app-icon__asset" name={asset} aria-hidden="true" /> : <WatanyFluentIcon name={item.icon as WatanyIconName} />}
        </span>
        {item.badgeCount ? <span className="watany-app-icon__badge">{item.badgeCount}</span> : null}
      </RoyalGoldFrame>
      <span className="watany-app-icon__label">{label}</span>
    </>
  );
}

export function getWatanyAppIconSign(_item: WatanyDrawerItem): string | undefined {
  return undefined;
}

function getWatanyIconRenderState(item: WatanyDrawerItem, schoolFormIcon: SchoolFormIconName | undefined): WatanyAppIconRenderState {
  const label = item.labelAr || item.label;
  const disabled = Boolean(item.disabled);
  const sign = getWatanyAppIconSign(item);
  const asset = getWatanyAppIconAsset(item);
  const notificationFeatureKey = getWatanyNotificationFeatureKey(item);
  const signStyle: WatanyAppIconSignStyle | undefined = sign ? { "--watany-icon-sign": `"${sign}"` } : undefined;
  return {
    label,
    disabled,
    sign,
    schoolFormIcon,
    elementProps: {
      className: `watany-app-icon watany-app-icon--${item.color || "navy"}${disabled ? " is-disabled" : ""}`,
      "aria-label": item.labelAr ? `${item.label} - ${item.labelAr}` : item.label,
      "data-watany-icon-render": sign ? "sign" : undefined,
      "data-watany-asset-render": asset ? "exact-viewer" : undefined,
      "data-sign": sign,
      "data-notification-feature-key": notificationFeatureKey,
      style: signStyle,
    },
  };
}

function renderRouterLinkIcon(item: WatanyDrawerItem, state: WatanyAppIconRenderState, automationId: string | undefined, focusLast = false) {
  const linkState = focusLast ? { focusLast: true } : undefined;
  return (
    <Link
      {...state.elementProps}
      to={item.route}
      state={linkState}
      data-testid={automationId}
      data-watany-shortcut-id={automationId}
    >
      {renderIconFace(item, state.label, state.sign, state.schoolFormIcon)}
    </Link>
  );
}

function renderAnchorIcon(item: WatanyDrawerItem, state: WatanyAppIconRenderState, automationId: string | undefined, isFileRoute: boolean) {
  const anchorTarget = isFileRoute ? "_blank" : undefined;
  const anchorRel = isFileRoute ? "noopener noreferrer" : undefined;
  return (
    <a
      {...state.elementProps}
      href={item.route}
      target={anchorTarget}
      rel={anchorRel}
      data-testid={automationId}
      data-watany-shortcut-id={automationId}
    >
      {renderIconFace(item, state.label, state.sign, state.schoolFormIcon)}
    </a>
  );
}

function renderButtonIcon(item: WatanyDrawerItem, state: WatanyAppIconRenderState, onClick: (() => void) | undefined, automationId: string | undefined) {
  return (
    <button
      {...state.elementProps}
      type="button"
      onClick={onClick}
      aria-disabled={state.disabled ? "true" : undefined}
      disabled={state.disabled}
      data-testid={automationId}
      data-watany-shortcut-id={automationId}
    >
      {renderIconFace(item, state.label, state.sign, state.schoolFormIcon)}
    </button>
  );
}

export function WatanyAppIcon({ item, asButton = false, onClick, automationId, schoolFormIcon }: Readonly<WatanyAppIconProps>) {
  const state = getWatanyIconRenderState(item, schoolFormIcon);
  const { useAnchor, isFileRoute } = getIconRouteKind(item.route);
  const resolvedAutomationId = automationId || `watany-shortcut-${item.id}`;

  if (state.disabled || asButton) {
    return renderButtonIcon(item, state, onClick, resolvedAutomationId);
  }

  if (item.id === "chat") {
    return renderRouterLinkIcon(item, state, resolvedAutomationId, true);
  }

  if (!useAnchor) {
    return renderRouterLinkIcon(item, state, resolvedAutomationId);
  }

  return renderAnchorIcon(item, state, resolvedAutomationId, isFileRoute);
}
