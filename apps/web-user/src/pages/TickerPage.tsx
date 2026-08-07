import { useState, useEffect, useCallback, useMemo, type ComponentType, type SVGProps, type CSSProperties } from "react";
import {
  Alert24Regular,
  LightbulbFilament24Regular,
  Megaphone24Regular,
  QuestionCircle24Regular,
  Warning24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import { MainHybridChatSurface } from "../components/chat/MainHybridChatSurface";
import { useApp } from "../store/app";
import { useFeatureFlags } from "../store/features";
import type { ChatMessage } from "../types/domain";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import { extractTickerQuestion, resolveTickerTarget, type TickerTarget } from "../lib/ticker-targets";
import { useNavigate, useSearchParams } from "react-router-dom";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/ticker.css";

interface TickerItemType {
  id: string;
  kind: "tip" | "faq" | "announcement" | "alert" | "update";
  title: string;
  text?: string;
  body?: string;
  timestamp?: number;
  icon?: string;
  lanes?: TickerLane[];
  url?: string;
  linkType?: string;
  linkId?: string;
}

type RawTickerItem = Omit<TickerItemType, "kind"> & { kind: string };

interface TickerPageProps {
  onAddMessage: (msg: ChatMessage) => void;
}

type TickerFilterKind = TickerItemType["kind"] | "all" | "highlight";
type TickerLane = "activity" | "statement";

function getTickerText(item: Pick<TickerItemType, "text" | "body">): string {
  return item.text?.trim() || item.body?.trim() || "";
}

function normalizeTickerText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .trim();
}

function inferTickerLanes(item: Pick<TickerItemType, "kind" | "title" | "text" | "body">): TickerLane[] {
  const content = normalizeTickerText(`${item.title} ${getTickerText(item)}`);
  const lanes = new Set<TickerLane>();

  if (
    item.kind === "announcement"
    || item.kind === "update"
    || /بيان|توضيح|تصريح|تحديث|جدول|قاعده المعرفه|قانون|مرسوم|نماذج رسميه|قرار|اعلان/.test(content)
  ) {
    lanes.add("statement");
  }

  if (
    item.kind === "tip"
    || item.kind === "alert"
    || /نشاط|فعاليه|جلسه|ورشه|دوره|مباشر|تطويع|فرصه|موعد|تابع|استخدم|ابدأ|افتح|احسب|اختر/.test(content)
  ) {
    lanes.add("activity");
  }

  return [...lanes];
}

function enrichTickerItem(item: TickerItemType): TickerItemType {
  return { ...item, lanes: inferTickerLanes(item) };
}

function buildFilterStyle(color?: string): CSSProperties | undefined {
  if (!color) {
    return undefined;
  }
  const style: CSSProperties & Record<"--filter-color", string> = { "--filter-color": color };
  return style;
}

function buildItemStyle(color: string): CSSProperties {
  const style: CSSProperties & Record<"--item-color", string> = { "--item-color": color };
  return style;
}

function includesTickerLane(item: TickerItemType, lane: TickerLane): boolean {
  return item.lanes?.includes(lane) ?? false;
}

function normalizeTickerKind(kind: string): TickerItemType["kind"] | null {
  switch (kind) {
    case "announce":
      return "announcement";
    case "case_update":
      return "update";
    case "tip":
    case "faq":
    case "alert":
    case "update":
    case "announcement":
      return kind;
    default:
      return null;
  }
}

export default function TickerPage({ onAddMessage }: Readonly<TickerPageProps>) {
  const { apiBaseUrl } = useApp();
  const { isEnabled } = useFeatureFlags();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<TickerItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeKind, setActiveKind] = useState<TickerFilterKind | TickerLane>("all");

  const enabledKinds = useMemo(() => {
    const kinds: Array<TickerItemType["kind"]> = [];
    if (isEnabled("ticker_bar")) {
      kinds.push("tip", "faq", "announcement", "alert", "update");
    }
    if (isEnabled("ticker_highlights")) {
      kinds.push("tip", "alert");
    }
    if (isEnabled("ticker_faq")) {
      kinds.push("faq");
    }
    if (isEnabled("ticker_announcements")) {
      kinds.push("announcement");
    }
    if (isEnabled("ticker_case_updates")) {
      kinds.push("update");
    }
    return Array.from(new Set(kinds));
  }, [isEnabled]);

  useEffect(() => {
    const requestedKind = searchParams.get("kind");
    if (requestedKind === "activity") {
      setActiveKind("activity");
      return;
    }
    if (requestedKind === "statement" || requestedKind === "data") {
      setActiveKind("statement");
      return;
    }
    if (requestedKind === "announcement" && enabledKinds.includes("announcement")) {
      setActiveKind("announcement");
      return;
    }
    if (requestedKind === "update" && enabledKinds.includes("update")) {
      setActiveKind("update");
      return;
    }
    if (requestedKind === "faq" && enabledKinds.includes("faq")) {
      setActiveKind("faq");
      return;
    }
    if (requestedKind === "highlight") {
      if (enabledKinds.includes("alert") || enabledKinds.includes("tip")) {
        setActiveKind("highlight");
        return;
      }
    }
    setActiveKind("all");
  }, [searchParams, enabledKinds]);
  

  const executeTickerTarget = useCallback((target: TickerTarget) => {
    if (target.type === "draft") {
      navigate("/hybrid-kb-chat", { state: { draft: target.draft } });
      return;
    }

    if (target.type === "internal") {
      navigate(target.href);
      return;
    }

    globalThis.location.assign(target.href);
  }, [navigate]);

  const loadTicker = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, annResp] = await Promise.all([api.getTicker(apiBaseUrl), api.getAnnouncements(apiBaseUrl)]);
      // Merge announcements into ticker items, mapping to expected shape
      const announcementItems: RawTickerItem[] = (annResp?.announcements || []).map((a) => ({
        id: a.id,
        kind: "announcement",
        title: a.title,
        body: a.body,
        url: a.url,
        // attach timestamp as number when present
        timestamp: a.timestamp as any,
      } as RawTickerItem));
      // combine ticker items and announcements (dedupe by id)
      const combinedItemsSource = ([...(data.items || [])] as RawTickerItem[]).concat(announcementItems);
      const dedupedById = new Map<string, RawTickerItem>();
      for (const it of combinedItemsSource) {
        if (!it || !it.id) continue;
        if (!dedupedById.has(it.id)) dedupedById.set(it.id, it);
      }
      const combined = Array.from(dedupedById.values());
      if (data.items.length > 0) {
        const normalized = (combined as RawTickerItem[])
          .map((item) => {
            const mappedKind = normalizeTickerKind(item.kind);
            if (!mappedKind) return null;
            return {
              ...item,
              kind: mappedKind,
              text: item.text ?? item.body ?? "",
              body: item.body,
              url: item.url,
              linkType: item.linkType,
              linkId: item.linkId,
              timestamp: (item as any).timestamp,
            };
          })
          .filter(Boolean) as TickerItemType[];
        setItems(normalized.map(enrichTickerItem));
      } else {
        // Fallback to mock ticker data
        const fallbackItems: TickerItemType[] = [
          // تحديثات (Updates)
          {
            id: "ticker_kb_update",
            kind: "update",
            title: "🌟 تم تحديث قاعدة المعرفة",
            text: "تم إضافة 743 مقطع قانوني جديد متاح للبحث. يتضمن آخر التعديلات على القوانين والتشريعات.",
            timestamp: Date.now() - 86400000,
          },
          {
            id: "ticker_job_update",
            kind: "update",
            title: "💼 وظائف شاغرة جديدة",
            text: "تم إضافة 50 فرصة عمل جديدة في قسم 'فرص العمل'. تصفح الفرص بحسب التخصص والموقع الجغرافي.",
            timestamp: Date.now() - 172800000,
          },
          {
            id: "ticker_case_update",
            kind: "update",
            title: "📋 تحديث حالة القضايا",
            text: "جميع القضايا المعلقة تم تحديث حالتها. تابع معاملاتك من قسم 'معاملاتي'.",
            timestamp: Date.now() - 259200000,
          },
          // إعلانات (Announcements)
          {
            id: "ticker_forms_announce",
            kind: "announcement",
            title: "📋 النماذج الرسمية متاحة",
            text: "تم تفعيل 25 نموذج رسمي حكومي يمكنك ملؤها وتحميلها مباشرة من التطبيق.",
            timestamp: Date.now() - 345600000,
          },
          {
            id: "ticker_kb_announce",
            kind: "announcement",
            title: "📢 إعلان: قاعدة المعرفة الشاملة",
            text: "قاعدة المعرفة الجديدة تحتوي على 743 مقطع قانوني شامل. استخدم البحث المتقدم للعثور على ما تحتاجه.",
            timestamp: Date.now() - 432000000,
          },
          {
            id: "ticker_sidebar_announce",
            kind: "announcement",
            title: "🔔 تابع حالة قضاياك",
            text: "استخدم الشريط الجانبي لمتابعة حالة قضاياك ومستنداتك بشكل فوري.",
            timestamp: Date.now() - 518400000,
          },
          // نصائح (Tips)
          {
            id: "ticker_tip_save",
            kind: "tip",
            title: "💡 نصيحة اليوم: احفظ الردود",
            text: "يمكنك حفظ أي رد من البوت بالنقر على زر المحفوظات لقراءته لاحقاً دون الحاجة للبحث.",
            timestamp: Date.now() - 604800000,
          },
          {
            id: "ticker_tip_voice",
            kind: "tip",
            title: "💡 هل تعلم؟ التحدث الصوتي",
            text: "يمكنك التحدث صوتياً مع موطني بالضغط على 🎧 في شريط الإدخال. استخدم اللغة العربية الفصيحة.",
            timestamp: Date.now() - 691200000,
          },
          {
            id: "ticker_tip_salary",
            kind: "tip",
            title: "💡 اطلب ",
            text: "انتقل إلى '' لطلب الوثيقة الرسمية مباشرة من خدمة وزارة المالية.",
            timestamp: Date.now() - 777600000,
          },
          {
            id: "ticker_tip_search",
            kind: "tip",
            title: "💡 البحث الذكي",
            text: "استخدم خاصية البحث المتقدم للعثور على المعاملات والقوانين والمستندات بسهولة.",
            timestamp: Date.now() - 864000000,
          },
          // أسئلة شائعة (FAQs)
          {
            id: "ticker_faq_pension",
            kind: "faq",
            title: "❓ سؤال شائع: شروط التقاعد",
            text: "ما هي شروط الإحالة على التقاعد؟ اكمل 20 سنة خدمة، أو الوصول لسن محددة، أو حسب قرار من القيادة.",
            timestamp: Date.now() - 950400000,
          },
          {
            id: "ticker_faq_pension_calc",
            kind: "faq",
            title: "❓ سؤال شائع: إفادة الراتب",
            text: "كيف أطلب إفادة راتبي الرسمية؟ استخدم خدمة إفادة الراتب وأدخل الاسم واسم الأب والشهرة ورقم التقاعد كما هي في وزارة المالية.",
            timestamp: Date.now() - 1036800000,
          },
          {
            id: "ticker_faq_widow",
            kind: "faq",
            title: "❓ سؤال شائع: حقوق الأسرة",
            text: "ما هي حقوق ذوي العسكري المتوفى؟ تشمل معاش الأرملة، مساعدات الأيتام، ومساعدات الدراسة.",
            timestamp: Date.now() - 1123200000,
          },
          {
            id: "ticker_faq_assistance",
            kind: "faq",
            title: "❓ سؤال شائع: مساعدة مدرسية",
            text: "كيف أقدم طلب مساعدة مدرسية؟ اختر المساعدة من قسم 'معاملاتي' وأرفق شهادات الدراسة والدخل.",
            timestamp: Date.now() - 1209600000,
          },
          {
            id: "ticker_faq_marriage",
            kind: "faq",
            title: "❓ سؤال شائع: معاملات الزواج",
            text: "ما هي إجراءات تسجيل الزواج؟ قدّم طلب رسمي مع شهادات البكالوريا وتقرير طبي والموافقة الإدارية.",
            timestamp: Date.now() - 1296000000,
          },
          // تنبيهات (Alerts)
          {
            id: "ticker_alert_deadline",
            kind: "alert",
            title: "⚠️ تنبيه: موعد نهائي",
            text: "آخر موعد لتقديم طلبات الترقية هو 15 مارس 2026. لا تفوّت الفرصة.",
            timestamp: Date.now() - 1382400000,
          },
        ];
        setItems(fallbackItems.map(enrichTickerItem));
      }
    } catch {
      setError("تعذّر تحميل التحديثات");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadTicker();
  }, [loadTicker]);

  const visibleItems = useMemo(() => items.filter((item) => enabledKinds.includes(item.kind)), [items, enabledKinds]);
  const highlightCount = useMemo(
    () => visibleItems.filter((item) => item.kind === "tip" || item.kind === "alert").length,
    [visibleItems],
  );

  const filteredItems = useMemo(() => {
    if (activeKind === "all") {
      return visibleItems;
    }
    if (activeKind === "highlight") {
      return visibleItems.filter((item) => item.kind === "tip" || item.kind === "alert");
    }
    if (activeKind === "activity" || activeKind === "statement") {
      return visibleItems.filter((item) => includesTickerLane(item, activeKind));
    }
    return visibleItems.filter((item) => item.kind === activeKind);
  }, [activeKind, visibleItems]);

  const kindIcons: Record<TickerItemType["kind"], ComponentType<SVGProps<SVGSVGElement>>> = {
    tip: LightbulbFilament24Regular,
    faq: QuestionCircle24Regular,
    announcement: Megaphone24Regular,
    alert: Warning24Regular,
    update: Alert24Regular,
  };

  const kindLabels: Record<TickerItemType["kind"], string> = {
    tip: "نصائح",
    faq: "أسئلة شائعة",
    announcement: "إعلانات",
    alert: "تنبيهات",
    update: "تحديثات",
  };

  const kindColors: Record<TickerItemType["kind"], string> = {
    tip: "#6366F1",
    faq: "#3B82F6",
    announcement: "#F59E0B",
    alert: "#EF4444",
    update: "#10B981",
  };

  const laneLabels: Record<TickerLane, string> = {
    activity: "النشاطات",
    statement: "البيانات",
  };

  const laneColors: Record<TickerLane, string> = {
    activity: "#0F766E",
    statement: "#475569",
  };

  const formatTime = relativeTime;

  if (loading) {
    return (
      <div className="ticker-page">
      <MainHybridChatSurface context="pages/TickerPage.tsx" />
        <div className="ticker-loading">جاري تحميل التحديثات...</div>
      </div>
    );
  }

  return (
    <div className="ticker-page">
      <MainHybridChatSurface context="pages/TickerPage.tsx" />
      <div className="ticker-page__header">
        <h2>التحديثات</h2>
        <p>آخر الإعلانات والتنبيهات والنصائح المهمة</p>
      </div>

      {error && <div className="ticker-page__error">{error}</div>}

      <div className="ticker-page__filters">
        <button
          className={`ticker-filter-btn ${activeKind === "all" ? "active" : ""}`}
          onClick={() => setActiveKind("all")}
        >
          الكل {visibleItems.length > 0 && `(${visibleItems.length})`}
        </button>
        {(enabledKinds.includes("tip") || enabledKinds.includes("alert")) && (
          <button
            className={`ticker-filter-btn ${activeKind === "highlight" ? "active" : ""}`}
            onClick={() => setActiveKind("highlight")}
          >
            النقاط البارزة {highlightCount > 0 && `(${highlightCount})`}
          </button>
        )}
        {(["activity", "statement"] as const).map((lane) => {
          const count = visibleItems.filter((item) => includesTickerLane(item, lane)).length;
          if (count === 0) return null;

          return (
            <button
              key={lane}
              className={`ticker-filter-btn ${activeKind === lane ? "active" : ""}`}
              onClick={() => setActiveKind(lane)}
              style={buildFilterStyle(activeKind === lane ? laneColors[lane] : undefined)}
            >
              {laneLabels[lane]} {count > 0 && `(${count})`}
            </button>
          );
        })}
        {(["tip", "faq", "announcement", "alert", "update"] as const)
          .filter((kind) => enabledKinds.includes(kind))
          .map(kind => {
          const count = visibleItems.filter(i => i.kind === kind).length;
          return (
            <button
              key={kind}
              className={`ticker-filter-btn ${activeKind === kind ? "active" : ""}`}
              onClick={() => setActiveKind(kind)}
              style={buildFilterStyle(activeKind === kind ? kindColors[kind] : undefined)}
            >
              {kindLabels[kind]} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      <div className="ticker-page__list">
        {filteredItems.length === 0 ? (
          <div className="ticker-page__empty">لا توجد تحديثات في هذه الفئة</div>
        ) : (
          filteredItems.map((item, itemIndex) => {
            const activeLane = activeKind === "activity" || activeKind === "statement" ? activeKind : null;
            const cardColor = activeLane && includesTickerLane(item, activeLane)
              ? laneColors[activeLane]
              : kindColors[item.kind];
            const badgeLabel = activeLane && includesTickerLane(item, activeLane)
              ? laneLabels[activeLane]
              : kindLabels[item.kind];
            const tickerText = getTickerText(item);
            const target = resolveTickerTarget(item);
            const faqPrompt = extractTickerQuestion(item.title);

            return (
            <div
              key={`${item.id}-${item.kind}-${itemIndex}`}
              className={`ticker-item-card${target ? " ticker-item-card--clickable" : ""}`}
              style={buildItemStyle(cardColor)}
            >
              <div className="ticker-item-card__icon">
                {(() => { const KindIcon = kindIcons[item.kind]; return <KindIcon aria-hidden="true" />; })()}
              </div>
              <div className="ticker-item-card__content">
                <div className="ticker-item-card__header">
                  <h3 className="ticker-item-card__title">{item.title}</h3>
                  <span className="ticker-item-card__kind">{badgeLabel}</span>
                </div>
                {tickerText ? <p className="ticker-item-card__text">{tickerText}</p> : null}
                <div className="ticker-item-card__footer">
                  <span className="ticker-item-card__time">{formatTime(item.timestamp)}</span>
                  <div className="watany-approved-home-icons ticker-item-card__actions">
                    {target && (
                      <button
                        className="ticker-item-card__action"
                        onClick={(event) => {
                          event.stopPropagation();
                          executeTickerTarget(target);
                        }}
                        type="button"
                      >
                        {target.actionLabel}
                      </button>
                    )}
                    {item.kind === "faq" && faqPrompt && (
                      <button
                        className="ticker-item-card__action"
                        onClick={(event) => {
                          event.stopPropagation();
                          onAddMessage({
                            id: Math.random().toString(36).slice(2, 11),
                            role: "user",
                            text: faqPrompt,
                            ts: Date.now(),
                          });
                        }}
                        type="button"
                      >
                        اسأل عن هذا
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );})
        )}
      </div>
    </div>
  );
}


