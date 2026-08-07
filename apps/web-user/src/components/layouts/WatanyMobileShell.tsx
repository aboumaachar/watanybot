import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft24Regular, ArrowRight24Regular } from "../../theme/watany-v4/legacyIconBridge";
import UniversalFeatureMenu from "../../features/universal-feature-menu/UniversalFeatureMenu";
import watanyFeatureCards from "../../features/home/watanyFeatureCards";
import WatanyFeatureCardView from "../../features/home/WatanyFeatureCard";
import { getUniversalFeatureGroupForPath } from "../../features/universal-feature-menu/universalFeatureMenuRegistry";

type ShellHistory = {
  entries: string[];
  index: number;
};

const SHELL_HISTORY_KEY = "watany_shell_history_v1";
const UNIVERSAL_MENU_PREVIEW_ENABLED = ((import.meta.env.VITE_WATANY_UNIVERSAL_MENU_PREVIEW ?? "false").toLowerCase() === "true");

function routeToken(pathname: string, search: string) {
  return `${pathname}${search || ""}`;
}

function readHistory(current: string): ShellHistory {
  try {
    const raw = sessionStorage.getItem(SHELL_HISTORY_KEY);
    if (!raw) {
      return current === "/"
        ? { entries: ["/"], index: 0 }
        : { entries: ["/", current], index: 1 };
    }

    const parsed = JSON.parse(raw) as Partial<ShellHistory>;
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];

    if (!entries.length) {
      return current === "/"
        ? { entries: ["/"], index: 0 }
        : { entries: ["/", current], index: 1 };
    }

    const normalizedEntries = entries[0] === "/" ? entries : ["/", ...entries.filter((entry) => entry !== "/")];
    const parsedIndex = typeof parsed.index === "number" ? parsed.index : normalizedEntries.length - 1;
    const index = Math.max(0, Math.min(parsedIndex, normalizedEntries.length - 1));

    return { entries: normalizedEntries, index };
  } catch {
    return current === "/"
      ? { entries: ["/"], index: 0 }
      : { entries: ["/", current], index: 1 };
  }
}

type WatanyMobileShellProps = Readonly<{
  children: ReactNode;
}>;

function shouldHideUserShell(pathname: string) {
  return pathname === "/login" || pathname === "/register" || pathname.startsWith("/superadmin");
}

function shouldHideUniversalBackground(pathname: string) {
  // Exclude explicit auth routes and common fullscreen landing containers.
  if (pathname === "/login" || pathname === "/register") return true;
  if (pathname.startsWith("/superadmin")) return true;

  // Some welcome/splash screens are not separate routes but are rendered
  // as fullscreen containers; detect common selectors and hide background.
  if (typeof document !== "undefined") {
    try {
      const selector = '.motany-login-landing, .watany-welcome-screen, .watany-splash-screen, [data-watany-splash], .welcome-screen, .transition-screen';
      if (document.querySelector(selector)) return true;
    } catch {
      // ignore DOM access failures in non-browser environments
    }
  }

  return false;
}

function shouldHideUniversalMenu(pathname: string) {
  // Hide the universal menu on auth and admin routes only.
  // Previously this returned `true` unconditionally which prevented
  // the main menu from opening on routes like `/profile`.
  return pathname === "/login" || pathname === "/register" || pathname.startsWith("/superadmin");
}

export default function WatanyMobileShell({ children }: WatanyMobileShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [universalMenuOpen, setUniversalMenuOpen] = useState(false);
  const [focusActiveUniversalGroupOnOpen, setFocusActiveUniversalGroupOnOpen] = useState(false);
  const hideUserShell = shouldHideUserShell(location.pathname);
  const hideUniversalMenu = shouldHideUniversalMenu(location.pathname);
  const stickyRailRoutePrefixes = [
    "/world-cup",
    "/recruitment",
    "/faq",
    "/jobs",
    "/market",
    "/taxi",
    "/documents",
    "/freelance-services",
    "/chat-sessions",
  ];
  const allowStickyRoute = stickyRailRoutePrefixes.some((prefix) =>
    location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );
  const currentUniversalGroup = getUniversalFeatureGroupForPath(location.pathname);
  const currentRoute = routeToken(location.pathname, location.search);
  const [historyState, setHistoryState] = useState<ShellHistory>(() => readHistory(currentRoute));
  const isUniversalMenuPreviewRoute = location.pathname.startsWith("/demo/universal");

  useEffect(() => {
    setUniversalMenuOpen(false);
    setFocusActiveUniversalGroupOnOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handler = (event: Event) => {
      const nextEvent = event as CustomEvent<{ focusActiveGroup?: boolean }>;
      setFocusActiveUniversalGroupOnOpen(Boolean(nextEvent.detail?.focusActiveGroup));
      setUniversalMenuOpen(true);
    };

    globalThis.addEventListener("watany-open-main-menu", handler);
    return () => globalThis.removeEventListener("watany-open-main-menu", handler);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-watany-current-route", location.pathname);

    if (UNIVERSAL_MENU_PREVIEW_ENABLED && isUniversalMenuPreviewRoute) {
      document.documentElement.setAttribute("data-watany-universal-menu-preview", "true");
      document.body?.setAttribute("data-watany-universal-menu-preview", "true");
    } else {
      document.documentElement.removeAttribute("data-watany-universal-menu-preview");
      document.body?.removeAttribute("data-watany-universal-menu-preview");
    }

    return () => {
      document.documentElement.removeAttribute("data-watany-current-route");
      document.documentElement.removeAttribute("data-watany-universal-menu-preview");
      document.body?.removeAttribute("data-watany-universal-menu-preview");
    };
  }, [isUniversalMenuPreviewRoute, location.pathname]);

  useEffect(() => {
    if (location.pathname === "/") return;

    const rootShell = document.querySelector<HTMLElement>(
      ".watany-v1-home-height-published-icons-root, [data-watany-v1-home-height-published-icons]",
    );
    if (!rootShell) return;

    const clearLeakedHomeHeight = () => {
      rootShell.style.removeProperty("--watany-v1-home-published-icons-height");
      rootShell.style.removeProperty("height");
      rootShell.style.removeProperty("min-height");
      rootShell.style.removeProperty("max-height");
      rootShell.style.removeProperty("overflow");
      rootShell.style.removeProperty("box-sizing");
      rootShell.style.removeProperty("margin-bottom");
      rootShell.style.removeProperty("padding-bottom");
      rootShell.removeAttribute("data-watany-v1-home-height-published-icons");
      rootShell.removeAttribute("data-watany-home-height-inline-style");
      rootShell.removeAttribute("data-watany-home-height-inline-attr");
    };

    clearLeakedHomeHeight();

    const rafId = globalThis.requestAnimationFrame(() => {
      clearLeakedHomeHeight();
    });

    return () => {
      globalThis.cancelAnimationFrame(rafId);
    };
  }, [location.pathname]);

  useEffect(() => {
    const updateTopHeaderHeight = () => {
      const topHeader = document.querySelector<HTMLElement>(".watany-top-header");
      const height = Math.ceil(topHeader?.getBoundingClientRect().height ?? 96);
      document.documentElement.style.setProperty("--watany-top-header-height", `${height}px`);
    };

    updateTopHeaderHeight();
    globalThis.addEventListener("resize", updateTopHeaderHeight, { passive: true });
    return () => globalThis.removeEventListener("resize", updateTopHeaderHeight);
  }, [location.pathname, location.search]);

  useEffect(() => {
    setHistoryState((prev) => {
      if (prev.entries[prev.index] === currentRoute) return prev;

      const backIndex = prev.index > 0 && prev.entries[prev.index - 1] === currentRoute
        ? prev.index - 1
        : -1;
      if (backIndex >= 0) {
        return { ...prev, index: backIndex };
      }

      const forwardIndex = prev.index + 1 < prev.entries.length && prev.entries[prev.index + 1] === currentRoute
        ? prev.index + 1
        : -1;
      if (forwardIndex >= 0) {
        return { ...prev, index: forwardIndex };
      }

      const nextEntries = [...prev.entries.slice(0, prev.index + 1), currentRoute];
      return {
        entries: nextEntries,
        index: nextEntries.length - 1,
      };
    });
  }, [currentRoute]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SHELL_HISTORY_KEY, JSON.stringify(historyState));
    } catch {
      // ignore storage failures in private/locked environments
    }
  }, [historyState]);

  const canBack = historyState.index > 0;
  const canForward = historyState.index < historyState.entries.length - 1;

  function goBackInAppHistory() {
    if (!canBack) return;
    const nextIndex = historyState.index - 1;
    const target = historyState.entries[nextIndex] || "/";
    setHistoryState((prev) => ({ ...prev, index: nextIndex }));
    navigate(target);
  }

  function goForwardInAppHistory() {
    if (!canForward) return;
    const nextIndex = historyState.index + 1;
    const target = historyState.entries[nextIndex] || "/";
    setHistoryState((prev) => ({ ...prev, index: nextIndex }));
    navigate(target);
  }

  if (hideUserShell) {
    return <>{children}</>;
  }

  // Decide whether to render the universal background for this route.
  const hideUniversalBackground = shouldHideUniversalBackground(location.pathname);

  return (
    <div className={`watany-layout ${hideUniversalBackground ? 'watany-layout--background-hidden' : 'watany-layout--background-enabled'}`}>
      {!hideUniversalBackground && (
        <div className="watany-layout-background" aria-hidden="true" />
      )}

      <div className="watany-layout-content">
        <div className="watany-mobile-shell watany-smartphone-root" dir="rtl">
          <div className="watany-mobile-shell__viewport">
            <div className="watany-mobile-shell__surface">
              {hideUniversalMenu ? null : (
                <UniversalFeatureMenu
                  open={universalMenuOpen}
                  onToggle={() => {
                    setFocusActiveUniversalGroupOnOpen(false);
                    setUniversalMenuOpen((current) => !current);
                  }}
                  onClose={() => {
                    setUniversalMenuOpen(false);
                    setFocusActiveUniversalGroupOnOpen(false);
                  }}
                  activeGroupId={currentUniversalGroup.id}
                  focusActiveGroupOnOpen={focusActiveUniversalGroupOnOpen}
                />
              )}

              {/* Render audited feature cards on the home route */}
              {location.pathname === '/' && (
                <section className="watany-approved-home-icons home-icons-grid" aria-label="الميزات الموصى بها">
                  {watanyFeatureCards.map((c) => (
                    <WatanyFeatureCardView key={c.id} card={c} />
                  ))}
                </section>
              )}

              <main className="watany-mobile-shell__main">
                <div className="watany-mobile-shell__content">
                  <div className={`watany-mobile-shell__route-content${allowStickyRoute ? " wc-route-content--allow-sticky" : ""}`}>
                    {children}
                  </div>
                </div>
              </main>
            </div>
          </div>

          <div className="watany-mobile-shell__history-nav" aria-label={"/u0627/u0644/u062a/u0646/u0642/u0644 /u0628/u064a/u0646 /u0627/u0644/u0635/u0641/u062d/u0627/u062a"}>
            <button
              type="button"
              className="watany-mobile-shell__history-btn watany-mobile-shell__history-btn--back"
              onClick={goBackInAppHistory}
              aria-label={"/u0627/u0644/u0631/u062c/u0648/u0639 /u0644/u0644/u0635/u0641/u062d/u0629 /u0627/u0644/u0633/u0627/u0628/u0642/u0629"}
              title={"/u0631/u062c/u0648/u0639"}
              disabled={!canBack}
            >
              <ArrowRight24Regular aria-hidden="true" />
            </button>
            <button
              type="button"
              className="watany-mobile-shell__history-btn watany-mobile-shell__history-btn--forward"
              onClick={goForwardInAppHistory}
              aria-label={"/u0627/u0644/u0627/u0646/u062a/u0642/u0627/u0644 /u0644/u0644/u0635/u0641/u062d/u0629 /u0627/u0644/u062a/u0627/u0644/u064a/u0629"}
              title={"/u0627/u0644/u062a/u0627/u0644/u064a"}
              disabled={!canForward}
            >
              <ArrowLeft24Regular aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// APEX_PHASE4B_TRUE_SHELL_OWNER: this component is the intended app-wide Mobile OS visual shell owner.
// APEX_PHASE4C_VISUAL_SHELL_OWNER: WatanyMobileShell owns the citizen Mobile OS visual frame.
// APEX_PREVIEW_UNIVERSAL_LAYOUT_REPAIR_V1_1: restored valid JSX tree with preview UniversalFeatureMenu mount.

