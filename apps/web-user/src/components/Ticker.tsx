import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import "../styles/ticker.css";

export type TickerItem = {
  kind: string;
  title: string;
  body?: string;
  url?: string;
  linkType?: string;
  linkId?: string;
};

const OFFICIAL_DEATHS_TICKER_PREFIX = "تم تحديث الوفيات الرسمية";
const LATEST_TICKER_REFRESH_MS = 30 * 1000;
const OFFICIAL_DEATHS_REFRESH_MS = 5 * 60 * 1000;
const DEFAULT_TICKER_CYCLE_MS = 240 * 1000;
const MIN_TICKER_CYCLE_MS = 60 * 1000;
const MAX_TICKER_CYCLE_MS = 300 * 1000;

const DEFAULT_TICKER_ITEMS: TickerItem[] = [
  { kind: "announce", title: "📢 آخر التحديثات والخدمات متاحة الآن عبر موطني" },
  { kind: "announce", title: "🍎 فرصة عمل موسمية: قطاف التفاح في عين الحفة - تنورين", linkType: "route", linkId: "/jobs/ainelhafeh" },
  { kind: "announce", title: "💼 تحقق من أحدث عروض العمل", linkType: "route", linkId: "/jobs" },
  { kind: "announce", title: "🛒 تحقق من إعلانات السوق", linkType: "route", linkId: "/marketplace" },
  { kind: "announce", title: "💰 تحقق من معاشك", linkType: "route", linkId: "/salary" },
  { kind: "announce", title: "🎓 تحقق من المنح المدرسية", linkType: "route", linkId: "/school-grants" },
  { kind: "tip", title: "💡 يمكنك حفظ أي رد لقراءته لاحقاً من المحفوظات" },
  { kind: "tip", title: "💡 استخدم حاسبة المعاش لمعرفة تقدير معاشك" },
];

function withOfficialDeathsTicker(items: TickerItem[], total: number): TickerItem[] {
  if (!Number.isFinite(total) || total <= 0) return items;

  const officialDeathsItem: TickerItem = {
    kind: "announce",
    title: `${OFFICIAL_DEATHS_TICKER_PREFIX} (${total})`,
    body: "تمت مزامنة الوفيات الرسمية. اضغط لعرض السجل الكامل.",
    linkType: "route",
    linkId: "/al-wafiyat",
  };
  const withoutPreviousOfficialDeaths = items.filter(
    (item) => !item.title?.includes(OFFICIAL_DEATHS_TICKER_PREFIX),
  );

  return [officialDeathsItem, ...withoutPreviousOfficialDeaths];
}

/** Extract the actual question text from a ticker string for pasting into composer */
function extractQuestion(text: string): string {
  // Strip leading emoji + label prefix like "🔥 سؤال متكرر: " or "❓ سؤال شائع: "
  return text.replace(/^[^\s]+\s*(سؤال (متكرر|شائع)|نصيحة اليوم)?:?\s*/i, "").trim();
}

/**
 * Horizontally scrolling ticker bar — shows tips, popular questions,
 * question-of-the-day, and announcements. Clicking a "suggest" or
 * "popular" item pastes the question text into the chat composer.
 */
export function Ticker({
  apiBaseUrl,
  onSuggest,
  onItemClick,
  disabledKinds = [],
  loop = true,
}: Readonly<{
  apiBaseUrl: string;
  onSuggest?: (text: string) => void;
  onItemClick?: (item: TickerItem) => void;
  disabledKinds?: string[];
  loop?: boolean;
}>) {
  const [items, setItems] = useState<TickerItem[]>(DEFAULT_TICKER_ITEMS);
  const [paused, setPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [tickerOffset, setTickerOffset] = useState(0);
  const [tickerCycleMs, setTickerCycleMs] = useState(DEFAULT_TICKER_CYCLE_MS);

  useEffect(() => {
    let cancelled = false;
    let tickerLoadInFlight = false;
    let officialDeathsTotal = 0;

    const loadTicker = async () => {
      if (tickerLoadInFlight) return;
      tickerLoadInFlight = true;
      try {
        const tickerRes = await api.getTicker(apiBaseUrl, { mode: "latest" });
        if (cancelled) return;
        const latestItems = tickerRes.items?.length ? tickerRes.items : DEFAULT_TICKER_ITEMS;
        const serverCycleMs = Number(tickerRes.settings?.cycleMs);
        if (Number.isFinite(serverCycleMs) && serverCycleMs >= MIN_TICKER_CYCLE_MS && serverCycleMs <= MAX_TICKER_CYCLE_MS) {
          setTickerCycleMs(serverCycleMs);
        }
        setItems(withOfficialDeathsTicker(latestItems, officialDeathsTotal));
      } catch {
        if (!cancelled) setItems(withOfficialDeathsTicker(DEFAULT_TICKER_ITEMS, officialDeathsTotal));
      } finally {
        tickerLoadInFlight = false;
      }
    };

    const loadOfficialDeaths = async () => {
      const deathsRes = await api.listAlWafiyat({ limit: 1 }, apiBaseUrl).catch(() => null);
      if (cancelled) return;
      officialDeathsTotal = Number(deathsRes?.total || 0);
      if (officialDeathsTotal > 0) {
        setItems((currentItems) => withOfficialDeathsTicker(currentItems, officialDeathsTotal));
      }
    };

    const refreshVisibleTicker = () => {
      if (document.visibilityState === "visible") void loadTicker();
    };

    void loadTicker();
    void loadOfficialDeaths();
    const tickerInterval = window.setInterval(() => void loadTicker(), LATEST_TICKER_REFRESH_MS);
    const deathsInterval = window.setInterval(() => void loadOfficialDeaths(), OFFICIAL_DEATHS_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshVisibleTicker);
    window.addEventListener("focus", refreshVisibleTicker);

    return () => {
      cancelled = true;
      window.clearInterval(tickerInterval);
      window.clearInterval(deathsInterval);
      document.removeEventListener("visibilitychange", refreshVisibleTicker);
      window.removeEventListener("focus", refreshVisibleTicker);
    };
  }, [apiBaseUrl]);

  const displayItems = items.filter(i => !disabledKinds.includes(i.kind));

  useEffect(() => {
    if (!loop || displayItems.length === 0) return undefined;

    const intervalId = window.setInterval(() => {
      if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setTickerOffset((offset) => {
        const loopWidth = (trackRef.current?.scrollWidth || 0) / 2;
        if (loopWidth <= 0) return offset;
        const ticksPerCycle = tickerCycleMs / 50;
        const pixelsPerTick = loopWidth / ticksPerCycle;
        const nextOffset = offset + pixelsPerTick;
        return nextOffset >= loopWidth ? 0 : nextOffset;
      });
    }, 50);

    return () => window.clearInterval(intervalId);
  }, [displayItems.length, loop, paused, tickerCycleMs]);

  useEffect(() => {
    if (loop || displayItems.length < 2) return undefined;
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % displayItems.length);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [displayItems.length, loop]);

  if (displayItems.length === 0) return null;
  const renderedItems = loop ? [...displayItems, ...displayItems] : [displayItems[activeIndex % displayItems.length]];

  return (
    <div
      role="marquee"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div ref={trackRef} style={loop ? { transform: `translate3d(${tickerOffset}px, 0, 0)` } : undefined} className={`ticker-track ${loop ? "ticker-manual-motion" : "ticker-single"} ${paused ? "ticker-paused" : ""}`}>
        {/* Duplicate items for seamless looping */}
        {renderedItems.map((item, idx) => {
          const isSuggestType = item.kind === "suggest" || item.kind === "popular" || item.kind === "qotd";
          const clickable = (isSuggestType && onSuggest) || (!isSuggestType && onItemClick);
          const handleClick = () => {
            if (isSuggestType && onSuggest) {
              onSuggest(extractQuestion(item.title));
            } else if (!isSuggestType && onItemClick) {
              onItemClick(item);
            }
          };

          return clickable ? (
            <button
              key={`${item.kind}-${item.title.slice(0, 20)}-${idx}`}
              className={`ticker-item ticker-${item.kind}`}
              type="button"
              onClick={handleClick}
              title={isSuggestType ? "انقر لطرح هذا السؤال" : "عرض التفاصيل"}
            >
              {item.title}
            </button>
          ) : (
            <span
              key={`${item.kind}-${item.title.slice(0, 20)}-${idx}`}
              className={`ticker-item ticker-${item.kind}`}
            >
              {item.title}
            </span>
          );
        })}
      </div>
    </div>
  );
}
