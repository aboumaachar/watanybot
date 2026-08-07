import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarCheckmark24Regular } from "../../theme/watany-v4/legacyIconBridge";
import { ReliableWebSocketClient } from "@watany/shared/reliable-websocket";
import { useApp } from "../../store/app";
import { useFeatureFlags } from "../../store/features";
import { api, type NewsItem, type WorldCupMatchDto } from "../../lib/api";
import { getCandidateApiBaseUrls } from "../../lib/api-base";
import { countUnreadWorldCupItems, getWorldCupLastSeen, type WorldCupSocketEvent } from "../../lib/worldcup-live";
import { applyKoudamaTheme, KOUDAMA_THEME_OPTIONS, readStoredKoudamaTheme, type KoudamaThemeId } from "../../lib/koudama-theme";
import { IconShell } from "../IconShell";
import { WatanyFluentIcon, type WatanyIconName } from "../icons/WatanyFluentIcon";
import "./koudama-homepage.css";
import { watanyDrawerItems, type WatanyDrawerItem } from "./watanyDrawerItems";
import { getWatanyAppIconSign } from "./WatanyAppIcon";
import { useInternalMail } from "../../lib/internal-mail";

const RUNTIME_DEBUG_LOCALHOSTS = new Set(["127.0.0.1", "localhost"]);
const RUNTIME_DEBUG_STORAGE_KEYS = [
  "watany_api_base_force",
  "watany_api_base_url",
  "watany_channel",
  "watany_contrast_mode",
  "watany_design",
  "watany_dictation",
  "watany_feature_flags",
  "watany_fontsize",
  "watany_show_sources",
  "watany_speak_replies",
  "watany_theme_mode",
  "watany_theme_preference",
];

type HomeCategoryId = "circulars" | "services" | "tools" | "entertainment" | "support" | "account";
type HomeItem = WatanyDrawerItem & {
  categoryId: HomeCategoryId;
  summary: string;
  action?: "theme";
};

const CATEGORY_CONFIG: ReadonlyArray<{
  id: HomeCategoryId;
  title: string;
  description: string;
}> = [
  { id: "circulars", title: "التعاميم", description: "الأخبار والتنبيهات والوفيات" },
  { id: "services", title: "الخدمات", description: "أهم الخدمات والطلبات اليومية" },
  { id: "tools", title: "ادوات", description: "الوصول السريع والبحث وتخصيص الواجهة" },
  { id: "entertainment", title: "يجري الان", description: "المحتوى الخفيف والمساحات التفاعلية" },
  { id: "support", title: "الدعم", description: "الأسئلة والقوانين والإفادة والروابط" },
  { id: "account", title: "ملفي", description: "الملف والإعدادات والوصول الشخصي" },
];

const SUPPLEMENTAL_ITEMS: ReadonlyArray<HomeItem> = [
  {
    id: "chat",
    label: "Chat",
    labelAr: "محادثة وطني",
    route: "/chat",
    icon: "chat",
    color: "green",
    categoryId: "tools",
    summary: "ابدأ المحادثة المباشرة مع وطني",
  },
  {
    id: "search",
    label: "Search",
    labelAr: "البحث",
    route: "/search",
    icon: "search",
    color: "navy",
    categoryId: "tools",
    summary: "ابحث في الأدلة والخدمات بسرعة",
  },
  {
    id: "themes",
    label: "Themes",
    labelAr: "الألوان",
    route: "#theme",
    icon: "settings",
    color: "slate",
    categoryId: "tools",
    summary: "بدّل ثيم وطني واحفظه تلقائياً",
    action: "theme",
  },
];

const HOME_CATEGORY_OVERRIDES: Partial<Record<string, HomeCategoryId>> = {
  "the-network": "services",
  news: "circulars",
  "fake-news": "circulars",
  "al-wafiyat": "circulars",
  salary: "services",
  procedures: "services",
  forms: "services",
  jobs: "services",
  recruitment: "services",
  marketplace: "services",
  taxi: "services",
  "school-grants": "services",
  vote: "entertainment",
  "world-cup": "entertainment",
  faq: "support",
  pension: "support",
  laws: "support",
  official: "support",
  profile: "account",
  settings: "account",
};

function canShowRuntimeDebugPanel() {
  if (globalThis.location === undefined) {
    return false;
  }

  if (RUNTIME_DEBUG_LOCALHOSTS.has(globalThis.location.hostname)) {
    return true;
  }

  return new URLSearchParams(globalThis.location.search).get("runtimeDebug") === "1";
}

function readStorageSnapshot(storage: Storage | undefined, keys: readonly string[]) {
  if (!storage) {
    return {} as Record<string, string>;
  }

  return keys.reduce<Record<string, string>>((snapshot, key) => {
    const value = storage.getItem(key);
    if (value !== null) {
      snapshot[key] = value;
    }
    return snapshot;
  }, {});
}

function formatNewsDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ar-LB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function replaceWorldCupMatch(
  matches: WorldCupMatchDto[],
  matchId: string,
  nextMatch: WorldCupMatchDto,
): WorldCupMatchDto[] {
  let updated = false;
  const nextMatches: WorldCupMatchDto[] = [];

  for (const match of matches) {
    if (match.id === matchId) {
      nextMatches.push(nextMatch);
      updated = true;
      continue;
    }

    nextMatches.push(match);
  }

  return updated ? nextMatches : matches;
}

function summarizeCategory(items: HomeItem[]) {
  return items.slice(0, 3).map((item) => item.labelAr || item.label);
}

function resolveHomeCategory(item: WatanyDrawerItem): HomeCategoryId {
  return HOME_CATEGORY_OVERRIDES[item.id] || "services";
}

function buildHomeItem(item: WatanyDrawerItem): HomeItem {
  return {
    ...item,
    categoryId: resolveHomeCategory(item),
    summary: item.labelAr || item.label,
  };
}

export default function WatanyDrawerPage() {
  const navigate = useNavigate();
  const {
    profile,
    apiBaseUrl,
    themeMode,
    contrastMode,
    fontSize,
    showSources,
    speakReplies,
    dictationEnabled,
    channel,
    design,
  } = useApp();
  const { flags, isHydrated } = useFeatureFlags();
  useInternalMail(profile);
  const [todayMatches, setTodayMatches] = useState<WorldCupMatchDto[]>([]);
  const [todayMatchUnread, setTodayMatchUnread] = useState<Record<string, number>>({});
  const [latestNews, setLatestNews] = useState<NewsItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<HomeCategoryId | null>(null);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState<KoudamaThemeId>(() => readStoredKoudamaTheme());
  const showRuntimeDebugPanel = useMemo(() => canShowRuntimeDebugPanel(), []);

  const resolvedDrawerItems = useMemo(
    () => watanyDrawerItems.map((item) => {
      if (item.id === "procedures" && !flags.procedures) {
        return { ...item, route: "/chat?draft=أريد معرفة الإجراءات الرسمية خطوة بخطوة" };
      }

      if (item.id === "forms" && !flags.forms) {
        return { ...item, route: "/chat?draft=أحتاج النماذج الرسمية المعتمدة" };
      }

      if (item.id === "faq" && !flags.ticker_faq) {
        return { ...item, route: "/chat?draft=ما هي أكثر الأسئلة الشائعة حالياً؟" };
      }

      return item;
    }),
    [flags.forms, flags.procedures, flags.ticker_faq],
  );

  const landingItems = useMemo<HomeItem[]>(() => {
    return [...resolvedDrawerItems.filter((item) => item.id !== "jobs").map(buildHomeItem), ...SUPPLEMENTAL_ITEMS];
  }, [resolvedDrawerItems]);

  const categories = useMemo(
    () => CATEGORY_CONFIG.map((category) => ({
      ...category,
      items: landingItems.filter((item) => item.categoryId === category.id),
    })),
    [landingItems],
  );

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) || null;
  const activeThemeOption = KOUDAMA_THEME_OPTIONS.find((option) => option.id === activeTheme) || KOUDAMA_THEME_OPTIONS[0];

  const worldCupSocketUrlFromBase = useMemo(() => {
    const bases = [apiBaseUrl, ...getCandidateApiBaseUrls()];
    const seen = new Set<string>();
    const dedupedBases = bases.filter((base) => {
      const normalized = String(base || "").trim();
      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });

    const sameOrigin = globalThis.location?.origin || "";
    const preferredBase = dedupedBases.find((base) => {
      try {
        return new URL(base).origin !== sameOrigin;
      } catch {
        return false;
      }
    }) || dedupedBases[0];

    return preferredBase || "";
  }, [apiBaseUrl]);

  const worldCupWsUrl = useMemo(() => {
    try {
      const url = new URL(worldCupSocketUrlFromBase);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = "/ws/world-cup";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  }, [worldCupSocketUrlFromBase]);

  const enabledFeatureIds = useMemo(
    () => Object.entries(flags)
      .filter(([, enabled]) => enabled)
      .map(([featureId]) => featureId)
      .sort((left, right) => left.localeCompare(right)),
    [flags],
  );

  const storageSnapshot = useMemo(() => {
    if (!showRuntimeDebugPanel) {
      return { local: {}, session: {} };
    }

    return {
      local: readStorageSnapshot(globalThis.localStorage, RUNTIME_DEBUG_STORAGE_KEYS),
      session: readStorageSnapshot(globalThis.sessionStorage, ["watany_shell_history_v1", "watany_chat_session_id"]),
    };
  }, [showRuntimeDebugPanel]);

  const runtimeSummary = useMemo(
    () => ({
      effectiveApiBaseUrl: apiBaseUrl,
      forcedApiBaseOverride: storageSnapshot.local.watany_api_base_force ?? null,
      storedApiBaseOverride: storageSnapshot.local.watany_api_base_url ?? null,
      themeMode,
      activeTheme,
      contrastMode,
      fontSize,
      channel,
      showSources,
      speakReplies,
      dictationEnabled,
      design,
      featureFlagsHydrated: isHydrated,
      enabledFeatureIds,
    }),
    [activeTheme, apiBaseUrl, channel, contrastMode, design, dictationEnabled, enabledFeatureIds, fontSize, isHydrated, showSources, speakReplies, storageSnapshot, themeMode],
  );

  const runtimeDebugIssues = useMemo(() => {
    if (!showRuntimeDebugPanel) {
      return [] as string[];
    }

    const issues: string[] = [];

    if (!runtimeSummary.featureFlagsHydrated) {
      issues.push("Feature flags are not hydrated yet.");
    }

    if (
      runtimeSummary.forcedApiBaseOverride
      && runtimeSummary.forcedApiBaseOverride !== runtimeSummary.effectiveApiBaseUrl
    ) {
      issues.push("Forced API base does not match the effective API base.");
    }

    if (
      runtimeSummary.storedApiBaseOverride
      && runtimeSummary.storedApiBaseOverride !== runtimeSummary.effectiveApiBaseUrl
    ) {
      issues.push("Stored API base does not match the effective API base.");
    }

    return issues;
  }, [runtimeSummary, showRuntimeDebugPanel]);

  const handleResetRuntimeCache = React.useCallback(() => {
    for (const key of RUNTIME_DEBUG_STORAGE_KEYS) {
      globalThis.localStorage?.removeItem(key);
    }

    globalThis.sessionStorage?.removeItem("watany_shell_history_v1");
    globalThis.sessionStorage?.removeItem("watany_chat_session_id");
    globalThis.location.reload();
  }, []);

  const handleForceLocalGateway = React.useCallback(() => {
    const forcedBase = import.meta.env.DEV && globalThis.location
      ? `${globalThis.location.protocol}//${globalThis.location.host}`
      : "http://127.0.0.1:8010";
    globalThis.localStorage?.setItem("watany_api_base_force", forcedBase);
    globalThis.location.reload();
  }, []);

  useEffect(() => {
    const syncTheme = () => setActiveTheme(readStoredKoudamaTheme());
    syncTheme();
    globalThis.addEventListener("watany-theme-change", syncTheme as EventListener);
    globalThis.addEventListener("storage", syncTheme);
    return () => {
      globalThis.removeEventListener("watany-theme-change", syncTheme as EventListener);
      globalThis.removeEventListener("storage", syncTheme);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadTodayMatches() {
      try {
        const matches = await api.getWorldCupTodayHomeMatches(apiBaseUrl);
        if (!active) {
          return;
        }

        setTodayMatches(matches);
      } catch {
        if (!active) {
          return;
        }

        setTodayMatches([]);
      }
    }

    void loadTodayMatches();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let active = true;

    async function loadLatestNews() {
      try {
        const items = await api.getNews(apiBaseUrl);
        if (!active) {
          return;
        }

        const seen = new Set<string>();
        const deduped = items.filter((item) => {
          const key = `${item.title}|${item.source_url ?? ""}`.trim().toLowerCase();
          if (!key || seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });

        setLatestNews(deduped.slice(0, 4));
      } catch {
        if (!active) {
          return;
        }

        setLatestNews([]);
      }
    }

    void loadLatestNews();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!worldCupWsUrl || todayMatches.length === 0) {
      return;
    }

    const socket = new ReliableWebSocketClient(worldCupWsUrl, {
      onOpen: () => {
        socket.sendJSON({ type: "world-cup.subscribe", matchIds: todayMatches.map((match) => match.id) });
      },
      onMessage: (event) => {
        try {
          const message = JSON.parse(event.data as string) as WorldCupSocketEvent;
          if (message.type !== "world-cup.snapshot") {
            return;
          }

          setTodayMatches((current) => replaceWorldCupMatch(current, message.matchId, message.snapshot.match));
          setTodayMatchUnread((current) => ({
            ...current,
            [message.matchId]: countUnreadWorldCupItems(message.snapshot, getWorldCupLastSeen(message.matchId)),
          }));
        } catch {
          // ignore malformed socket payloads
        }
      },
    });

    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [todayMatches, worldCupWsUrl]);

  function openHomeItem(item: HomeItem) {
    if (item.action === "theme") {
      setThemeSheetOpen(true);
      return;
    }

    setSelectedCategoryId(null);
    navigate(item.route);
  }

  return (
    <main className="watany-drawer-page" dir="rtl">
      <div className="watany-drawer-phone">
        <section className="koudama-home__hero" aria-label="واجهة وطني الرئيسية">
          <div className="koudama-home__status">
            <span className="koudama-home__badge">{profile.isAuthed ? "الحساب مفعل" : "وضع الزائر"}</span>
            <button type="button" className="koudama-home__theme-chip" onClick={() => setThemeSheetOpen(true)}>
              الثيم الحالي: {activeThemeOption.label}
            </button>
          </div>

          <div className="koudama-home__hero-copy">
            <h1>الرئيسية الجديدة لوطني تجمع الخدمات والتحديثات والمحادثة في سطح واحد.</h1>
            <p>افتح أي مجموعة لتظهر البطاقات الفرعية، وغيّر الثيم من أدوات الصفحة مع حفظ الاختيار في هذا المتصفح.</p>
          </div>

          <div className="koudama-home__hero-actions">
            <Link className="koudama-home__action koudama-home__action--primary" to="/chat">
              ابدأ المحادثة
            </Link>
            <button type="button" className="koudama-home__action koudama-home__action--ghost" onClick={() => setSelectedCategoryId("services")}>
              تصفح الخدمات
            </button>
          </div>
        </section>

        <section className="koudama-home__section" aria-label="مجموعات الصفحة الرئيسية">
          <div className="koudama-home__section-head">
            <div>
              <h2>المجموعات</h2>
              <p>نفس المسارات الحقيقية للتطبيق، لكن بواجهة Koudama على الصفحة الرئيسية فقط.</p>
            </div>
            <span className="koudama-home__theme-chip">{categories.reduce((sum, category) => sum + category.items.length, 0)} بطاقة</span>
          </div>

          <div className="koudama-home__categories">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="koudama-home__category"
                onClick={() => setSelectedCategoryId(category.id)}
              >
                <div className="koudama-home__category-top">
                  <div className="koudama-home__category-title">
                    <strong>{category.title}</strong>
                    <span>{category.description}</span>
                  </div>
                  <span className="koudama-home__count">{category.items.length}</span>
                </div>
                <div className="koudama-home__preview">
                  {summarizeCategory(category.items).map((label) => (
                    <span key={label} className="koudama-home__preview-chip">{label}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="koudama-home__section" aria-label="بؤر الوصول السريع">
          <div className="koudama-home__section-head">
            <div>
              <h2>وصول سريع</h2>
              <p>مؤشرات الحساب والتحديث والثيم في مكان واحد.</p>
            </div>
          </div>

          <div className="koudama-home__focus-grid">
            <div className="koudama-home__focus-card">
              <strong>{profile.isAuthed ? (profile.name || "مرحباً بعودتك") : "أكمل تفعيل حسابك"}</strong>
              <p>{profile.isAuthed ? "ملفك وإعداداتك متاحة من قسم الحساب." : "التسجيل يفتح المستندات والحالات والإشعارات الشخصية."}</p>
              <Link className="koudama-home__action koudama-home__action--ghost" to={profile.isAuthed ? "/profile" : "/login"}>
                {profile.isAuthed ? "فتح الملف" : "تسجيل الدخول"}
              </Link>
            </div>

            <div className="koudama-home__focus-card">
              <strong>الثيم المحفوظ: {activeThemeOption.label}</strong>
              <p>{activeThemeOption.description}</p>
              <button type="button" className="koudama-home__action koudama-home__action--ghost" onClick={() => setThemeSheetOpen(true)}>
                تبديل الثيم
              </button>
            </div>
          </div>
        </section>

        {todayMatches.length > 0 ? (
          <section className="koudama-home__section" aria-label="مباريات اليوم">
            <div className="koudama-home__section-head">
              <div>
                <h2>مباريات اليوم</h2>
                <p>المسار يبقى كما هو، والعرض فقط صار جزءاً من الواجهة الجديدة.</p>
              </div>
              <Link className="koudama-home__action koudama-home__action--ghost" to="/world-cup/today">عرض الكل</Link>
            </div>
            <div className="koudama-home__matches-grid">
              {todayMatches.map((match) => (
                <Link key={match.id} className="koudama-home__match-link" to={match.route ?? `/world-cup/match/${match.id}`}>
                  <div className="koudama-home__match-copy">
                    <strong>{match.teamA} × {match.teamB}</strong>
                    <span className="koudama-home__match-meta">
                      <CalendarCheckmark24Regular aria-hidden="true" /> {new Date(match.dateTime).toLocaleTimeString("ar-LB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {todayMatchUnread[match.id] ? <em className="koudama-home__match-badge">{todayMatchUnread[match.id] > 99 ? "99+" : todayMatchUnread[match.id]}</em> : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="koudama-home__section" aria-label="آخر الأخبار والتحديثات">
          <div className="koudama-home__section-head">
            <div>
              <h2>آخر الأخبار والتحديثات</h2>
              <p>شريط التحديثات العلوي ما زال يعمل، وهذه معاينة مختصرة داخل الرئيسية.</p>
            </div>
            <Link className="koudama-home__action koudama-home__action--ghost" to="/news">عرض الكل</Link>
          </div>

          <div className="koudama-home__news-list">
            {latestNews.length > 0 ? (
              latestNews.map((item) => (
                item.source_url ? (
                  <a key={item.id} href={item.source_url} target="_blank" rel="noreferrer noopener" className="koudama-home__news-link">
                    <div className="koudama-home__news-copy">
                      <strong>{item.title}</strong>
                      <time dateTime={new Date(item.published_at).toISOString()}>{formatNewsDateTime(item.published_at)}</time>
                    </div>
                    <span className="koudama-home__news-tag">خارجي</span>
                  </a>
                ) : (
                  <Link key={item.id} to="/news" className="koudama-home__news-link">
                    <div className="koudama-home__news-copy">
                      <strong>{item.title}</strong>
                      <time dateTime={new Date(item.published_at).toISOString()}>{formatNewsDateTime(item.published_at)}</time>
                    </div>
                    <span className="koudama-home__news-tag">داخلي</span>
                  </Link>
                )
              ))
            ) : (
              <div className="koudama-home__focus-card">
                <strong>لا توجد تحديثات متاحة حالياً.</strong>
                <p>يبقى الشريط العلوي هو المصدر الأسرع عند وصول تحديثات جديدة.</p>
              </div>
            )}
          </div>
        </section>

        {showRuntimeDebugPanel && runtimeDebugIssues.length > 0 ? (
          <details className="watany-runtime-debug" open>
            <summary className="watany-runtime-debug__summary">تشخيص اختلاف الصفحة الرئيسية محلياً</summary>
            <p className="watany-runtime-debug__note">هذا اللوح يظهر محلياً فقط عندما توجد إعدادات تشغيل تؤثر على سلوك الصفحة الرئيسية.</p>
            <ul className="watany-runtime-debug__note">
              {runtimeDebugIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            <div className="watany-runtime-debug__actions">
              <button type="button" className="watany-runtime-debug__btn" onClick={handleResetRuntimeCache}>
                مسح كاش التشغيل المحلي
              </button>
              <button type="button" className="watany-runtime-debug__btn watany-runtime-debug__btn--secondary" onClick={handleForceLocalGateway}>
                فرض API المحلي 8010
              </button>
            </div>
            <pre className="watany-runtime-debug__pre">{JSON.stringify(runtimeSummary, null, 2)}</pre>
            <pre className="watany-runtime-debug__pre">{JSON.stringify(storageSnapshot, null, 2)}</pre>
          </details>
        ) : null}

        {selectedCategory ? (
          <div
            className="koudama-home__panel-backdrop"
            role="button"
            tabIndex={0}
            aria-label="إغلاق اللوحة"
            onClick={() => setSelectedCategoryId(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape') {
                setSelectedCategoryId(null);
              }
            }}
          >
            <section className="koudama-home__panel" role="dialog" aria-modal="true" aria-label={selectedCategory.title} onClick={(event) => event.stopPropagation()}>
              <div className="koudama-home__panel-head">
                <div className="koudama-home__panel-copy">
                  <span className="koudama-home__panel-chip">{selectedCategory.items.length} بطاقة</span>
                  <h3>{selectedCategory.title}</h3>
                  <p>{selectedCategory.description}</p>
                </div>
                <button type="button" className="koudama-home__panel-close" onClick={() => setSelectedCategoryId(null)} aria-label="إغلاق">
                  ×
                </button>
              </div>

              <div className="koudama-home__panel-grid">
                {selectedCategory.items.map((item) => {
                  const sign = getWatanyAppIconSign(item);
                  return (
                    <button key={item.id} type="button" className="koudama-home__tile" data-feature-key={item.id} data-sign={sign} onClick={() => openHomeItem(item)}>
                      <IconShell className="koudama-home__tile-icon koudama-icon-shell" data-koudama-color={item.color || "navy"} data-sign={sign} aria-hidden="true">
                        <WatanyFluentIcon name={item.icon as WatanyIconName} aria-hidden={true} />
                      </IconShell>
                      <div className="koudama-home__tile-title">
                        <strong>{item.labelAr || item.label}</strong>
                        <small>{item.summary}</small>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="koudama-home__panel-actions">
                <button type="button" className="koudama-home__action koudama-home__action--ghost koudama-home__action--full" onClick={() => setSelectedCategoryId(null)}>
                  العودة للرئيسية
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {themeSheetOpen ? (
          <div
            className="koudama-home__panel-backdrop"
            role="button"
            tabIndex={0}
            aria-label="إغلاق اختيار الثيم"
            onClick={() => setThemeSheetOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape') {
                setThemeSheetOpen(false);
              }
            }}
          >
            <section className="koudama-home__panel" role="dialog" aria-modal="true" aria-label="اختيار الثيم" onClick={(event) => event.stopPropagation()}>
              <div className="koudama-home__panel-head">
                <div className="koudama-home__panel-copy">
                  <span className="koudama-home__panel-chip">watany_theme_preference</span>
                  <h3>اختيار الثيم</h3>
                  <p>يتم حفظ الاختيار محلياً ويستمر بعد إعادة تحميل الصفحة.</p>
                </div>
                <button type="button" className="koudama-home__panel-close" onClick={() => setThemeSheetOpen(false)} aria-label="إغلاق">
                  ×
                </button>
              </div>

              <div className="koudama-home__themes">
                {KOUDAMA_THEME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    data-feature-key={option.id}
                    type="button"
                    className={`koudama-home__theme-option${option.id === activeTheme ? " is-active" : ""}`}
                    onClick={() => {
                      applyKoudamaTheme(option.id);
                      setActiveTheme(option.id);
                    }}
                  >
                    <span className="koudama-home__swatch" style={{ ["--koudama-swatch" as string]: option.swatch } as React.CSSProperties} />
                    <span className="koudama-home__theme-meta">
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="koudama-home__panel-actions">
                <button type="button" className="koudama-home__action koudama-home__action--primary koudama-home__action--full" onClick={() => setThemeSheetOpen(false)}>
                  إغلاق والعودة للرئيسية
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}


