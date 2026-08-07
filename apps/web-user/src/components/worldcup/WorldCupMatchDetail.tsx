import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Video24Regular } from "../../theme/watany-v4/legacyIconBridge";
import { ReliableWebSocketClient } from "@watany/shared/reliable-websocket";
import type { WorldCupMatch } from "../../data/worldCupMatches";
import { getWorldCupMatchStatus } from "../../data/worldCupMatches";
import { api, type WorldCupMatchChatMessage, type WorldCupMatchDto, type WorldCupMatchEvent } from "../../lib/api";
import { getCandidateApiBaseUrls } from "../../lib/api-base";
import { getWorldCupSnapshotNewestTimestamp, markWorldCupMatchSeen, type WorldCupSocketEvent } from "../../lib/worldcup-live";
import { useApp } from "../../store/app";

type Props = {
  matchId: string;
  match?: WorldCupMatch;
};

export function WorldCupMatchDetail({ matchId, match }: Readonly<Props>) {
  const { apiBaseUrl, profile } = useApp();
  const fallbackStatus = match ? getWorldCupMatchStatus(match) : "scheduled";
  const [backendMatch, setBackendMatch] = useState<WorldCupMatchDto | null>(null);
  const [feedStatus, setFeedStatus] = useState<"scheduled" | "live" | "finished">(fallbackStatus);
  const [updates, setUpdates] = useState<WorldCupMatchEvent[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<WorldCupMatchChatMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [loadError, setLoadError] = useState("");

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

  const wsUrl = useMemo(() => {
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

  const status = backendMatch?.status ?? feedStatus;
  const score = backendMatch?.score ?? null;
  const displayMatch = backendMatch ?? match ?? null;
  const sourceUrl = displayMatch?.officialSourceUrl;
  const kickoff = displayMatch ? new Date(displayMatch.dateTime) : null;

  useEffect(() => {
    let active = true;

    async function loadMatch() {
      try {
        const [found, feed, chat] = await Promise.all([
          api.getWorldCupMatchById(matchId, apiBaseUrl),
          api.getWorldCupMatchEvents(matchId, apiBaseUrl),
          api.getWorldCupMatchChat(matchId, apiBaseUrl),
        ]);
        if (!active) {
          return;
        }

        setBackendMatch(found);
        setFeedStatus(feed.status);
        setUpdates(feed.events);
        setMessages(chat);
        setLoadError("");
      } catch {
        if (!active) {
          return;
        }

        setLoadError("تعذر تحميل تفاصيل المباراة حالياً.");
      }
    }

    void loadMatch();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, matchId]);

  useEffect(() => {
    if (!wsUrl) {
      return;
    }

    const socket = new ReliableWebSocketClient(wsUrl, {
      onOpen: () => {
        socket.sendJSON({ type: "world-cup.subscribe", matchIds: [matchId] });
      },
      onMessage: (event) => {
        try {
          const message = JSON.parse(event.data as string) as WorldCupSocketEvent;
          if (message.type === "world-cup.snapshot" && message.matchId === matchId) {
            setBackendMatch(message.snapshot.match);
            setFeedStatus(message.snapshot.status);
            setUpdates(message.snapshot.events);
            setMessages(message.snapshot.messages);
            setChatError("");

            if (document.visibilityState === "visible") {
              markWorldCupMatchSeen(matchId, getWorldCupSnapshotNewestTimestamp(message.snapshot));
            }
          }

          if (message.type === "world-cup.error" && message.matchId === matchId) {
            setChatError("تعذر تحديث بث المباراة الحي.");
          }
        } catch {
          setChatError("تعذر تحديث بث المباراة الحي.");
        }
      },
    });

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [matchId, wsUrl]);

  useEffect(() => {
    const newestTimestamp = getWorldCupSnapshotNewestTimestamp({ events: updates, messages, generatedAt: new Date().toISOString() });

    function markSeenIfVisible() {
      if (document.visibilityState === "visible") {
        markWorldCupMatchSeen(matchId, newestTimestamp);
      }
    }

    markSeenIfVisible();
    document.addEventListener("visibilitychange", markSeenIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", markSeenIfVisible);
    };
  }, [matchId, messages, updates]);

  const statusLabel =
    status === "live"
      ? "مباشرة الآن"
      : status === "finished"
        ? "انتهت المباراة"
        : "لم تبدأ بعد";

  const watchLabel = status === "finished" ? "مشاهدة الإعادة" : status === "live" ? "مشاهدة البث المباشر" : "متابعة البث عند الانطلاق";

  function submitChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) {
      return;
    }

    const userId = profile.email || profile.phone || profile.name || "anonymous";
    const author = profile.name || "مشجع";

    void api.postWorldCupMatchChat(matchId, { userId, author, text }, apiBaseUrl)
      .then((created) => {
        setMessages((previous) => previous.some((message) => message.id === created.id) ? previous : [...previous, created]);
        setChatInput("");
        setChatError("");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "تعذر إرسال الرسالة حالياً.";
        setChatError(message);
      });
  }

  if (!displayMatch) {
    return <section className="wc-match-detail" dir="rtl"><div className="wc-empty-state">{loadError || "جارٍ تحميل المباراة..."}</div></section>;
  }

  return (
    <section className="wc-match-detail" dir="rtl">
      <header className="wc-match-detail__hero">
        <div>
          <p className="wc-match-detail__eyebrow">صفحة المباراة</p>
          <h3>{displayMatch.teamA} × {displayMatch.teamB}</h3>
          <p className="wc-match-detail__meta">
            {displayMatch.stage} · {kickoff?.toLocaleString("ar-LB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <p className="wc-match-detail__meta">{displayMatch.venue}</p>
        </div>

        <div className={`wc-match-detail__state wc-match-detail__state--${status}`}>
          <strong>{statusLabel}</strong>
          {score ? <span>{score}</span> : null}
        </div>
      </header>

      <div className="wc-match-detail__actions">
        <a className="wc-match-watch" href={sourceUrl || "/world-cup/live"} target="_blank" rel="noopener noreferrer">
          <Video24Regular aria-hidden />
          <span>{watchLabel}</span>
        </a>
        <Link className="wc-match-back" to="/world-cup/matches">الرجوع إلى قائمة المباريات</Link>
      </div>

      {status === "finished" ? (
        <section className="wc-match-info">
          <h4>ملخص ونتيجة المباراة</h4>
          <p>
            انتهت المواجهة بنتيجة {score ?? "غير متاحة"}. يعرض القسم التالي الأحداث الرئيسية التي غيرت مجرى المباراة.
          </p>
        </section>
      ) : null}

      {status === "scheduled" ? (
        <section className="wc-match-info">
          <h4>معلومات ما قبل المباراة</h4>
          <p>ستظهر التحديثات الفورية عند بداية المباراة، ويمكنك الآن متابعة حالة البث والتحضيرات الرسمية.</p>
        </section>
      ) : null}

      <section className="wc-match-feed">
        <h4>{status === "live" ? "تغذية لحظية لتقدم المباراة" : "أخبار وتفاصيل المباراة"}</h4>
        <div className="wc-match-feed__list">
          {updates.map((update) => (
            <article key={update.id} className={`wc-match-feed__item wc-match-feed__item--${update.kind}`}>
              <header>
                <strong>{update.title}</strong>
                {typeof update.minute === "number" ? <span>د {update.minute}</span> : null}
              </header>
              <p>{update.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="wc-match-chat">
        <h4>دردشة المجموعة الخاصة بالمباراة</h4>
        <p>شارك انطباعاتك هنا. هذه الدردشة مرتبطة بهذه المباراة فقط.</p>

        <div className="wc-match-chat__messages" role="log" aria-live="polite">
          {chatError ? <div className="wc-vote-error">{chatError}</div> : null}
          {messages.length === 0 ? <div className="wc-match-chat__empty">لا توجد رسائل بعد. ابدأ أول تعليق.</div> : null}
          {messages.map((message) => (
            <article key={message.id} className="wc-match-chat__msg">
              <header>
                <strong>{message.author}</strong>
                <span>{new Date(message.createdAt).toLocaleTimeString("ar-LB", { hour: "2-digit", minute: "2-digit" })}</span>
              </header>
              <p>{message.text}</p>
            </article>
          ))}
        </div>

        <form className="wc-match-chat__composer" onSubmit={submitChatMessage}>
          <input
            type="text"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="اكتب تعليقك حول مجريات المباراة"
            aria-label="اكتب تعليقك"
          />
          <button type="submit">إرسال</button>
        </form>
      </section>
    </section>
  );
}


