import { useEffect, useMemo, useState } from "react";

type Broadcast = {
  id?: string;
  title_lb?: string;
  message_lb?: string;
  severity?: string;
  starts_at?: string;
  ends_at?: string;
  updated_at?: string;
};

type Props = {
  apiBaseUrl: string;
};

/**
 * BroadcastBanner (KB-first):
 * Shows "question of the day" / urgent announcements pushed by admin.
 * It tries a few likely endpoints and fails silently if not available.
 */
export function BroadcastBanner({ apiBaseUrl }: Props) {
  const [item, setItem] = useState<Broadcast | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const cacheKey = useMemo(() => "watany_broadcast_dismiss_v1", []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) setDismissed(true);
    } catch {}
  }, [cacheKey]);

  useEffect(() => {
    let alive = true;

    async function tryFetch(url: string) {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error("bad");
      return (await res.json()) as any;
    }

    async function load() {
      const candidates = [
        `${apiBaseUrl}/api/v2/broadcast/active`,
        `${apiBaseUrl}/api/broadcast/active`,
        `${apiBaseUrl}/api/v2/broadcasts/active`,
        `${apiBaseUrl}/api/broadcasts/active`,
      ];

      for (const url of candidates) {
        try {
          const data = await tryFetch(url);
          const b = (data?.broadcast ?? data?.active ?? data) as Broadcast | null;
          if (!alive) return;
          if (b && (b.message_lb || b.title_lb)) {
            setItem(b);
            return;
          }
        } catch {
          // try next
        }
      }
    }

    load();
    // refresh every 90s (cheap)
    const t = setInterval(load, 90_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [apiBaseUrl]);

  if (!item || dismissed) return null;

  const title = item.title_lb || "سؤال/تنبيه اليوم";
  const msg = item.message_lb || "";

  return (
    <div className="wt-banner" role="status">
      <div className="wt-banner__text">
        <div className="wt-banner__title">{title}</div>
        {msg ? <div className="wt-banner__msg">{msg}</div> : null}
      </div>

      <button
        className="wt-banner__btn"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(cacheKey, "1");
          } catch {}
          window.dispatchEvent(new Event("watany-focus-chat"));
        }}
        aria-label="إخفاء"
        title="إخفاء"
      >
        ✕
      </button>
    </div>
  );
}
