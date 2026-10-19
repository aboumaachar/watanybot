import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { MainHybridChatSurface } from "../chat/MainHybridChatSurface";
import { PwaInstallController } from "../PwaInstallController";
import { Ticker, type TickerItem } from "../Ticker";
import { resolveTickerTarget } from "../../lib/ticker-targets";
import { WatanyV4Icon } from "../../theme/watany-v4/WatanyV4Icon";
import { useApp } from "../../store/app";
import { DRAWER_MENU_GROUPS } from "../../features/universal-feature-menu/universalFeatureMenuRegistry";

const menuGroups = DRAWER_MENU_GROUPS.map((group) => ({
  key: group.id,
  label: group.label,
  icon: group.iconFeatureId,
  drawerLevel: group.drawerLevel ?? "group",
  to: group.route,
  items: group.items.map((item) => ({ to: item.route, label: item.label })),
}));

const bottomItems = [
  { to: "/home", label: "الرئيسية", icon: "house" },
  { to: "/profile", label: "ملفي", icon: "profile" },
  { to: "/login", label: "الدخول", icon: "login" },
  { to: "/community", label: "مجتمعي", icon: "community" },
] as const;

export function WatanyPublicShellV20() {
  const { apiBaseUrl } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<string, boolean>>({ procedures: true, "daily-services": true });
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflowRef = useRef("");

  useEffect(() => {
    if (!menuOpen) {
      document.documentElement.classList.remove("watany-recovery-menu-open");
      document.body.classList.remove("watany-recovery-menu-open");
      document.body.style.overflow = previousBodyOverflowRef.current;
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousBodyOverflowRef.current = document.body.style.overflow;
    document.documentElement.classList.add("watany-recovery-menu-open");
    document.body.classList.add("watany-recovery-menu-open");
    document.body.style.overflow = "hidden";

    const focusableSelector = [
      'a[href]:not([aria-disabled="true"])',
      'button:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
      );

      if (focusables.length === 0) {
        event.preventDefault();
        drawerRef.current?.focus();
        return;
      }

      const firstFocusable = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === firstFocusable || activeElement === drawerRef.current) {
          event.preventDefault();
          lastFocusable.focus();
        }
        return;
      }

      if (activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const focusTarget = drawerRef.current?.querySelector<HTMLElement>(focusableSelector) ?? drawerRef.current;
    focusTarget?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.documentElement.classList.remove("watany-recovery-menu-open");
      document.body.classList.remove("watany-recovery-menu-open");
      document.body.style.overflow = previousBodyOverflowRef.current;
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setChatOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="watany-recovery-shell" data-watany-recovery-shell="true">
      <header className="watany-recovery-topbar" data-watany-topbar="true">
        <NavLink className="watany-recovery-logo-link" to="/home" aria-label="الصفحة الرئيسية">
          <img className="watany-recovery-logo" src="/logo.png" alt="شعار موطني" />
        </NavLink>
        <div className="watany-recovery-ticker" aria-label="شريط المعلومات">
          <Ticker
            apiBaseUrl={apiBaseUrl}
            onItemClick={(item: TickerItem) => {
              const target = resolveTickerTarget(item);
              if (target?.type === "internal") navigate(target.href);
              if (target?.type === "external") window.open(target.href, "_blank", "noopener,noreferrer");
            }}
          />
        </div>
        <button
          type="button"
          className="watany-recovery-menu-button"
          aria-label="فتح القائمة الرئيسية"
          aria-expanded={menuOpen}
          aria-controls="watany-main-drawer"
          data-watany-menu-trigger="true"
          ref={menuButtonRef}
          onClick={() => setMenuOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setMenuOpen((value) => !value);
            }
          }}
        >
          <span className="watany-recovery-menu-glyph" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </header>

      {menuOpen ? (
        <div className="watany-recovery-menu-layer" data-watany-recovery-menu-open="true">
          <button className="watany-recovery-menu-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} />
          <aside id="watany-main-drawer" ref={drawerRef} className="watany-recovery-menu-panel" data-watany-recovery-menu="true" role="dialog" aria-modal="true" aria-label="القائمة الرئيسية" tabIndex={-1}>
            <div className="watany-recovery-menu-title">
              <strong>القائمة الرئيسية</strong>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة">×</button>
            </div>
            <nav>
              <NavLink className="watany-recovery-menu-home-link" to="/home" end onClick={() => setMenuOpen(false)}>الرئيسية</NavLink>
              {menuGroups.map((group) => {
                if (group.drawerLevel === "top-level") {
                  return (
                    <NavLink className="watany-recovery-menu-home-link watany-recovery-menu-top-link" key={group.key} to={group.to} onClick={() => setMenuOpen(false)}>
                      <WatanyV4Icon name={group.icon as Parameters<typeof WatanyV4Icon>[0]["name"]} aria-hidden="true" width={20} height={20} />
                      <span>{group.label}</span>
                    </NavLink>
                  );
                }

                const isExpanded = openMenuGroups[group.key] ?? false;
                return (
                  <section className="watany-recovery-menu-group" key={group.key}>
                    <button
                      type="button"
                      className="watany-recovery-menu-group-toggle"
                      aria-expanded={isExpanded}
                      aria-controls={`watany-menu-group-${group.key}`}
                      onClick={() => setOpenMenuGroups((current) => ({ ...current, [group.key]: !isExpanded }))}
                    >
                      <WatanyV4Icon name={group.icon as Parameters<typeof WatanyV4Icon>[0]["name"]} aria-hidden="true" width={20} height={20} />
                      <span>{group.label}</span>
                      <span className={`watany-recovery-menu-group-chevron ${isExpanded ? "is-expanded" : ""}`} aria-hidden="true">⌄</span>
                    </button>
                    <div id={`watany-menu-group-${group.key}`} className="watany-recovery-menu-submenu" hidden={!isExpanded}>
                      {group.items.map((item) => (
                        <NavLink key={`${item.to}-${item.label}`} to={item.to} onClick={() => setMenuOpen(false)}>{item.label}</NavLink>
                      ))}
                    </div>
                  </section>
                );
              })}
            </nav>
            <NavLink className="watany-recovery-login-link" to="/login">تسجيل الدخول</NavLink>
          </aside>
        </div>
      ) : null}

      <main className="watany-recovery-main" data-watany-route-surface="true">
        <Outlet />
      </main>

      {chatOpen ? (
        <section className="watany-recovery-chat" data-watany-safe-chat="true" aria-label="المساعد">
          <MainHybridChatSurface context={`shell:${location.pathname}`} onClose={() => setChatOpen(false)} />
        </section>
      ) : null}

      <PwaInstallController />

      <nav className="watany-recovery-bottom" aria-label="التنقل السريع" data-watany-bottom-bar="true" data-watany-dock="true" data-watany-bottom-nav="true">
        {bottomItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/home"} aria-label={item.label} title={item.label}>
            {item.icon === "house" ? (
              <img className="watany-recovery-home-sign" src="/watany-v4/icons/home-sign.png" alt="" aria-hidden="true" width={22} height={22} />
            ) : (
              <WatanyV4Icon name={item.icon} aria-hidden="true" width={20} height={20} />
            )}
            <span className="watany-recovery-bottom__label">{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="watany-recovery-bottom__install"
          aria-label="تثبيت التطبيق"
          title="تثبيت التطبيق"
          onClick={() => globalThis.dispatchEvent(new Event("watany-open-install-prompt"))}
        >
          <WatanyV4Icon name="install" aria-hidden="true" width={20} height={20} />
          <span className="watany-recovery-bottom__label">تثبيت</span>
        </button>
        <button type="button" aria-label="فتح مساعد موطني" aria-expanded={chatOpen} onClick={() => setChatOpen((value) => !value)}>
          <WatanyV4Icon name="ask-watany" aria-hidden="true" width={20} height={20} />
          <span className="watany-recovery-bottom__label">المساعد</span>
        </button>
      </nav>
    </div>
  );
}
