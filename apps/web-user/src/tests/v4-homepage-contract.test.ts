import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  watanyV4HomepageItems,
} from "../data/watanyFeatureRegistryV4";
import { DRAWER_MENU_GROUPS } from "../features/universal-feature-menu/universalFeatureMenuRegistry";
import { getWatanyV4IconName } from "../theme/watany-v4/featureIconMap";
import { WATANY_V4_ICONS } from "../theme/watany-v4/iconRegistry";

const expectedIds = [
  "for-you",
  "latest",
  "popular",
  "marketplace",
  "jobs",
  "schools",
  "procedures",
  "salary",
  "taxi",
  "circulars",
  "network",
  "forms",
  "useful-links",
  "deaths",
  "community",
  "voting",
  "news",
  "laws",
  "faq",
  "fake-fact",
  "profile",
  "settings",
  "children",
  "sports",
] as const;

describe("V4 authorized homepage contract", () => {
  it("exposes exactly the authorized 24 entries in order", () => {
    expect(watanyV4HomepageItems).toHaveLength(24);
    expect(watanyV4HomepageItems.map((item) => item.id)).toEqual(expectedIds);
    expect(new Set(watanyV4HomepageItems.map((item) => item.id)).size).toBe(24);
    expect(new Set(watanyV4HomepageItems.map((item) => item.route)).size).toBe(24);
    expect(watanyV4HomepageItems.map((item) => item.id)).not.toContain("voice");
    expect(watanyV4HomepageItems.map((item) => item.labelAr)).not.toContain("كأس العالم 2026");
    expect(watanyV4HomepageItems.map((item) => item.labelAr)).not.toContain("خدمات موطني");
    expect(watanyV4HomepageItems.at(-4)).toEqual(
      expect.objectContaining({
        id: "profile",
        labelAr: "الحساب",
        route: "/profile",
      }),
    );
    expect(watanyV4HomepageItems.at(-3)).toEqual(
      expect.objectContaining({
        id: "settings",
        labelAr: "الإعدادات",
        route: "/settings",
      }),
    );
    expect(watanyV4HomepageItems.at(-2)).toEqual(
      expect.objectContaining({
        id: "children",
        labelAr: "الأبناء",
        route: "/children",
      }),
    );
    expect(watanyV4HomepageItems.at(-1)).toEqual(
      expect.objectContaining({
        id: "sports",
        labelAr: "الرياضة",
        route: "/sports",
      }),
    );
    expect(getWatanyV4IconName("children")).toBe("users");
    expect(WATANY_V4_ICONS.users).toBe("/watany-v4/icons/users.png");
    expect(getWatanyV4IconName("sports")).toBe("world-cup");
    expect(WATANY_V4_ICONS["world-cup"]).toBe("/watany-v4/icons/world-cup.png");
    expect(watanyV4HomepageItems.every((item) => getWatanyV4IconName(item.id))).toBe(true);
    expect(WATANY_V4_ICONS["for-you"]).toBe("/watany-v4/icons/for-you.png");
    expect(WATANY_V4_ICONS.latest).toBe("/watany-v4/icons/latest.png");
    expect(WATANY_V4_ICONS["most-requested"]).toBe("/watany-v4/icons/most-requested.png");
    expect(watanyV4HomepageItems.find((item) => item.id === "useful-links")).toEqual(
      expect.objectContaining({
        labelAr: "روابط",
        route: "/services/official",
      }),
    );
    expect(getWatanyV4IconName("useful-links")).toBe("links");
    expect(WATANY_V4_ICONS.links).toBe("/watany-assets/icons/links.svg");
    expect(watanyV4HomepageItems.find((item) => item.id === "profile")).toEqual(
      expect.objectContaining({ labelAr: "الحساب", route: "/profile" }),
    );
    expect(watanyV4HomepageItems.find((item) => item.id === "settings")).toEqual(
      expect.objectContaining({ labelAr: "الإعدادات", route: "/settings" }),
    );
    expect(WATANY_V4_ICONS.settings).toBe("/watany-v4/icons/settings.svg");
  });

  it("keeps forbidden homepage headings and spacing removed", () => {
    const homepageSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/WatanyV4Homepage.tsx"),
      "utf8",
    );

    expect(homepageSource).not.toContain("خدمات موطني");
    expect(homepageSource).not.toContain("اختر مسارك");
    expect(homepageSource).not.toContain("watany-v4-homepage__attention");
    expect(homepageSource).toContain('aria-label="الميزات النشطة"');
  });

  it("keeps the shared shell bottom navigation at five canonical items", () => {
    const shellSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/layouts/WatanyPublicShellV20.tsx"),
      "utf8",
    );

    expect(shellSource).toContain('{ to: "/home", label: "الرئيسية", icon: "house" }');
    expect(shellSource).toContain('{ to: "/profile", label: "ملفي", icon: "profile" }');
    expect(shellSource).toContain('{ to: "/login", label: "الدخول", icon: "login" }');
    expect(shellSource).toContain('{ to: "/community", label: "مجتمعي", icon: "community" }');
    expect(shellSource).toContain('aria-label="فتح مساعد موطني"');
    expect(shellSource).toContain('aria-controls="watany-main-drawer"');
    expect(shellSource).toContain('event.key === "Enter" || event.key === " "');
    expect(shellSource).toContain('className="watany-recovery-menu-glyph"');
    expect(shellSource).toContain('className="watany-recovery-home-sign"');
    expect(shellSource).toContain('src="/watany-v4/icons/home-sign.png"');
    expect(shellSource).not.toContain('label: "الإعدادات"');
    expect(shellSource).not.toContain("bottomItems.slice");
  });

  it("restores live Smart Attention owners for discovery tiles", () => {
    const appShellSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/AppShell.tsx"),
      "utf8",
    );

    expect(appShellSource).toContain("SmartAttentionFeaturePage");
    expect(appShellSource).toContain('path="/for-you" element={<SmartAttentionFeaturePage featureKey="for-you" />}');
    expect(appShellSource).toContain('path="/latest" element={<SmartAttentionFeaturePage featureKey="latest" />}');
    expect(appShellSource).toContain('path="/popular" element={<SmartAttentionFeaturePage featureKey="most-requested" />}');
    expect(appShellSource).toContain('path="/most-requested" element={<SmartAttentionFeaturePage featureKey="most-requested" />}');
    expect(appShellSource).toContain('path="school-grants" element={<SchoolGrantsPage />}');
  });

  it("keeps Smart Attention actions on active application routes", () => {
    const smartAttentionDataSource = fs.readFileSync(
      path.join(process.cwd(), "src/features/smart-attention-native/smartAttentionNativeData.ts"),
      "utf8",
    );

    expect(smartAttentionDataSource).toContain('href: "/marketplace"');
    expect(smartAttentionDataSource).not.toContain('href: "/market",');
  });

  it("keeps the public drawer structure and route bindings complete", () => {
    expect(DRAWER_MENU_GROUPS).toHaveLength(5);
    expect(DRAWER_MENU_GROUPS.map((group) => group.label)).toEqual([
      "الإجراءات",
      "الخدمات والفرص",
      "المعلومات والمراجع",
      "المجتمع والإعلام",
      "الحساب والإعدادات",
    ]);
    expect(DRAWER_MENU_GROUPS[0].id).toBe("procedures");
    expect(DRAWER_MENU_GROUPS[1]).toEqual(expect.objectContaining({ id: "daily-services" }));
    expect(DRAWER_MENU_GROUPS[1]).not.toHaveProperty("drawerLevel", "top-level");
    expect(DRAWER_MENU_GROUPS.reduce((total, group) => total + group.items.length, 0)).toBe(21);
    expect(DRAWER_MENU_GROUPS.every((group) => group.items.every((item) => item.route.startsWith("/")))).toBe(true);
    expect(DRAWER_MENU_GROUPS.at(-1)?.id).toBe("account");
  });

  it("keeps visible theme and guest interaction owners wired", () => {
    const tickerSource = fs.readFileSync(path.join(process.cwd(), "src/components/Ticker.tsx"), "utf8");
    const welcomeSource = fs.readFileSync(path.join(process.cwd(), "src/pages/WatanyGuidedHelperSmokePage.tsx"), "utf8");
    const frameSource = fs.readFileSync(path.join(process.cwd(), "src/theme/watany-v4/royalGoldFrame.css"), "utf8");
    const upgradeSource = fs.readFileSync(path.join(process.cwd(), "src/theme/watany-v4/royalGoldUpgrade.css"), "utf8");
    const themeIndexSource = fs.readFileSync(path.join(process.cwd(), "src/theme/watany-v4/index.css"), "utf8");

    expect(tickerSource).toContain("tickerOffset");
    expect(tickerSource).toContain("setTickerOffset");
    expect(welcomeSource).toContain("navigate('/home')");
    expect(frameSource).not.toContain("0 7px 0 #765000");
    expect(upgradeSource).toContain("--watany-royal-frame-depth: 9px");
    expect(upgradeSource).toContain("--watany-royal-gold-dark: #684100");
    expect(upgradeSource).toMatch(/0\s+var\(--watany-royal-frame-depth\)\s+0\s+var\(--watany-royal-gold-dark\)/);
    expect(upgradeSource).toContain("0 0 24px var(--watany-royal-gold-glow)");
    expect(upgradeSource).toContain("0 19px 36px var(--watany-royal-green-shadow)");
    expect(upgradeSource).toContain("background: transparent !important");
    expect(upgradeSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(themeIndexSource.match(/royalGoldUpgrade\.css/g)).toHaveLength(1);
    expect(themeIndexSource.indexOf("royalGoldFrame.css")).toBeLessThan(themeIndexSource.indexOf("royalGoldUpgrade.css"));
  });
});