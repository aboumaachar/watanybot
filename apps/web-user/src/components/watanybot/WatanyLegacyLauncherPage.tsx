import { useEffect, useState } from "react";
import { SmartAttentionDashboardIcons } from "../../features/smart-attention-native";
import { useApp } from "../../store/app";
import "./watany-drawer.css";
import "./watany-drawer-overrides.css";
import { watanyDrawerItems, type WatanyDrawerItem } from "./watanyDrawerItems";
import { WatanyAppIcon } from "./WatanyAppIcon";
import { useInternalMail } from "../../lib/internal-mail";
import { cleanupRouteActivationChrome, clearRouteActivationOptIn } from "../../lib/publicRuntimeChrome";
import { applyKoudamaTheme, KOUDAMA_THEME_OPTIONS, readStoredKoudamaTheme, type KoudamaThemeId } from "../../lib/koudama-theme";

function guardedAccountRoute(route: string, isAuthed: boolean): string {
  return isAuthed ? route : `/login?next=${encodeURIComponent(route)}`;
}

const launcherQuickItems: ReadonlyArray<WatanyDrawerItem> = [
  { id: "settings", label: "Settings", labelAr: "الإعدادات", route: "/settings", icon: "settings", category: "account", color: "slate" },
  { id: "profile", label: "Profile", labelAr: "ملفي", route: "/profile", icon: "person", category: "account", color: "navy" },
  { id: "saved", label: "Favorites", labelAr: "المحفوظات", route: "/saved", icon: "bookmark", category: "account", color: "green" },
];

export default function WatanyLegacyLauncherPage() {
  const { profile } = useApp();
  useInternalMail(profile);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState<KoudamaThemeId>(() => readStoredKoudamaTheme());
  const quickItems = launcherQuickItems.map((item) => ({
    ...item,
    route: guardedAccountRoute(item.route || "/", profile.isAuthed),
  }));
  const launcherItems = [
    ...watanyDrawerItems,
    ...quickItems.filter((quickItem) => !watanyDrawerItems.some((drawerItem) => drawerItem.id === quickItem.id)),
  ];

  useEffect(() => {
    clearRouteActivationOptIn();
    cleanupRouteActivationChrome();

    const observer = new MutationObserver(() => {
      clearRouteActivationOptIn();
      cleanupRouteActivationChrome();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const syncTheme = () => setActiveTheme(readStoredKoudamaTheme());
    globalThis.addEventListener("watany-theme-change", syncTheme);
    globalThis.addEventListener("storage", syncTheme);
    return () => {
      globalThis.removeEventListener("watany-theme-change", syncTheme);
      globalThis.removeEventListener("storage", syncTheme);
    };
  }, []);

  return (
    <main className="watany-drawer-page" dir="rtl">
      <div className="watany-drawer-phone">
        {/* `watany-launcher-profile` removed */}

        <SmartAttentionDashboardIcons />

        <section className="watany-icon-grid" aria-label="WatanyBot services">
          {launcherItems.map((item) => (
            <WatanyAppIcon
              key={item.id}
              item={item}
              automationId={quickItems.some((quickItem) => quickItem.id === item.id) ? `watany-quick-${item.id}` : undefined}
            />
          ))}
        </section>
        {themeSheetOpen ? (
          <div
            className="watany-launcher-theme-backdrop"
            role="button"
            tabIndex={0}
            aria-label="إغلاق اختيار الثيم"
            onClick={() => setThemeSheetOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " " || event.key === "Spacebar" || event.key === "Escape") {
                setThemeSheetOpen(false);
              }
            }}
          >
            <section className="watany-launcher-theme-sheet" role="dialog" aria-modal="true" aria-label="اختيار الثيم" onClick={(event) => event.stopPropagation()}>
              <div className="watany-launcher-theme-sheet__head">
                <div className="watany-launcher-theme-sheet__copy">
                  <span className="watany-launcher-theme-sheet__chip">watany_theme_preference</span>
                  <h2>اختيار الثيم</h2>
                  <p>التغيير محلي وآمن، ولا يضيف اعتماداً جديداً على الصفحة الرئيسية.</p>
                </div>
                <button type="button" className="watany-launcher-theme-sheet__close" onClick={() => setThemeSheetOpen(false)} aria-label="إغلاق">
                  ×
                </button>
              </div>

              <div className="watany-launcher-theme-sheet__options">
                {KOUDAMA_THEME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`watany-launcher-theme-option${option.id === activeTheme ? " is-active" : ""}`}
                    onClick={() => {
                      applyKoudamaTheme(option.id);
                      setActiveTheme(option.id);
                    }}
                  >
                    <span className="watany-launcher-theme-option__swatch" style={{ ["--watany-launcher-swatch" as string]: option.swatch } as React.CSSProperties} />
                    <span className="watany-launcher-theme-option__meta">
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </span>
                  </button>
                ))}
              </div>

              <button type="button" className="watany-launcher-theme-sheet__done" onClick={() => setThemeSheetOpen(false)}>
                إغلاق والعودة للرئيسية
              </button>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}