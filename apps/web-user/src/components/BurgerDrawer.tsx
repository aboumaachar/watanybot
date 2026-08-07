import { useEffect, useRef } from "react";
import { useApp } from "../store/app";
import { useFeatureFlags } from "../store/features";
import { useNavigateMode } from "../lib/routes";
import { useLocation, useNavigate } from "react-router-dom";
import { SERVICE_CATEGORIES } from "../lib/service-catalog";
import type { ServiceTile } from "../lib/service-catalog";
import { IconShell } from "./IconShell";
import KoudamaFeatureIcon from "./koudama-icons/KoudamaFeatureIcon";

function resolveDrawerTileFeatureId(tile: ServiceTile): string {
  return tile.featureId ?? tile.id;
}

function DrawerCategorySection({
  category,
  tiles,
  onTileClick,
}: Readonly<{
  category: (typeof SERVICE_CATEGORIES)[number];
  tiles: ServiceTile[];
  onTileClick: (tile: ServiceTile) => void;
}>) {
  return (
    <section className="launcher-section">
      <span className="launcher-section__label">{category.label}</span>
      <div className="launcher-grid launcher-grid--2col">
        {tiles.map((tile) => (
          <DrawerTileButton key={tile.id} tile={tile} onClick={() => onTileClick(tile)} />
        ))}
      </div>
    </section>
  );
}

function DrawerTileButton({
  tile,
  onClick,
}: Readonly<{
  tile: ServiceTile;
  onClick: () => void;
}>) {
  return (
    <button
      className={`app-tile app-tile--${tile.color}${tile.future ? " app-tile--future" : ""}`}
      onClick={onClick}
      title={tile.future ? "قريباً" : tile.label}
      aria-disabled={tile.future}
    >
      <IconShell className="app-tile__icon koudama-icon-shell" aria-hidden="true">
        <KoudamaFeatureIcon featureId={resolveDrawerTileFeatureId(tile)} size="sm" />
      </IconShell>
      <span className="app-tile__label">{tile.shortLabel ?? tile.label}</span>
    </button>
  );
}

/* ── Component ────────────────────────────────────────────── */
type Props = Readonly<{ open: boolean; onClose: () => void }>;

export function BurgerDrawer({ open, onClose }: Props) {
  const { hasRole } = useApp();
  const { isEnabled, isModeEnabled } = useFeatureFlags();
  const navigateMode = useNavigateMode();
  const navigate = useNavigate();
  const location = useLocation();
  const lastPathRef = useRef(`${location.pathname}${location.search}`);
  const drawerRef = useRef<HTMLDialogElement | null>(null);

  function resetShellScrollPosition() {
    const scrollTargets = [
      globalThis.document.scrollingElement,
      globalThis.document.documentElement,
      globalThis.document.body,
      globalThis.document.querySelector<HTMLElement>(".watany-mobile-shell__route-content"),
      globalThis.document.querySelector<HTMLElement>(".watany-mobile-shell__content"),
      globalThis.document.querySelector<HTMLElement>(".watany-mobile-shell__viewport"),
    ].filter((node): node is HTMLElement | Element => Boolean(node));

    for (const target of scrollTargets) {
      if ("scrollTo" in target) {
        (target as HTMLElement).scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      } else if ("scrollTop" in target) {
        (target as HTMLElement).scrollTop = 0;
        (target as HTMLElement).scrollLeft = 0;
      }
    }
  }

  function isVisible(tile: ServiceTile): boolean {
    if (tile.adminOnly && !hasRole(["admin", "superadmin"])) return false;
    if (tile.featureId && !isEnabled(tile.featureId)) return false;
    if (tile.action.kind === "mode" && !isModeEnabled(tile.action.mode)) return false;
    return true;
  }

  function handleTile(tile: ServiceTile) {
    if (tile.future) return;
    onClose();
    switch (tile.action.kind) {
      case "mode":
        navigateMode(tile.action.mode);
        break;
      case "route":
        navigate(tile.action.path);
        break;
      case "event":
        globalThis.dispatchEvent(new CustomEvent(tile.action.name, { detail: tile.action.detail ?? {} }));
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    if (!open) {
      lastPathRef.current = `${location.pathname}${location.search}`;
      return;
    }

    const currentPath = `${location.pathname}${location.search}`;
    if (lastPathRef.current !== currentPath) {
      lastPathRef.current = currentPath;
      onClose();
    }
  }, [location.pathname, location.search, onClose, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    resetShellScrollPosition();
    document.documentElement.classList.add("wmo-drawer-open");
    document.body.classList.add("wmo-drawer-open");
    globalThis.addEventListener("keydown", handleKeyDown);
    globalThis.requestAnimationFrame(resetShellScrollPosition);
    drawerRef.current?.focus();
    drawerRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });

    return () => {
      document.documentElement.classList.remove("wmo-drawer-open");
      document.body.classList.remove("wmo-drawer-open");
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="launcher-drawer__backdrop"
        onClick={onClose}
        aria-label="إغلاق القائمة"
      />
      <dialog
        ref={drawerRef}
        className="launcher-drawer"
        data-wmo-shell-drawer="true"
        open
        aria-label="جميع الخدمات"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className="launcher-drawer__header">
          <button className="launcher-drawer__logo" onClick={onClose} aria-label="إغلاق القائمة">
            <KoudamaFeatureIcon featureId="services" size="sm" />
            <span>جميع الخدمات</span>
          </button>
          <button className="launcher-drawer__close" onClick={onClose} aria-label="إغلاق">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="launcher-drawer__body">
          {SERVICE_CATEGORIES.filter((cat) => cat.showInServices !== false).map((cat) => {
            const tiles = cat.tiles.filter(isVisible);
            if (tiles.length === 0) return null;
            return (
              <DrawerCategorySection
                key={cat.id}
                category={cat}
                tiles={tiles}
                onTileClick={handleTile}
              />
            );
          })}
        </div>
      </dialog>
    </>
  );
}
// APEX_PHASE4D_NAV_DUPLICATE_REVIEW: verify whether this component is still needed under WatanyMobileShell.

