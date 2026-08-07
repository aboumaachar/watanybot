import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MainHybridChatSurface } from "../../components/chat/MainHybridChatSurface";
import { resolveContextualChat } from "../chat/contextualChatRuntime";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type WatanyHybridDefaultChatProps = {
  surfaceId?: string;
  title?: string;
  endpoint?: string;
  preserveCommunityChat?: boolean;
  className?: string;
  [key: string]: unknown;
};

type WatanyHybridDefaultLocationState = {
  draft?: string;
  handoffMessage?: ChatMessage | null;
};

function extractAnswer(payload: unknown): string {
  const value = payload as Record<string, unknown> | null;
  if (!value) return "";
  const candidates = [value.answer, value.reply, value.message, value.text, value.content];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
  }
  const listing = value.listing as Record<string, unknown> | undefined;
  if (listing) {
    const listingCandidates = [listing.answer, listing.reply, listing.message, listing.text, listing.content];
    for (const candidate of listingCandidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
    }
  }
  return "لم أتمكن من قراءة الجواب من خدمة Hybrid KB. الرجاء المحاولة من جديد.";
}

export function WatanyHybridDefaultChat(props: Readonly<WatanyHybridDefaultChatProps>) {
  const location = useLocation();
  const navigate = useNavigate();
  const contextual = useMemo(() => resolveContextualChat(location.pathname), [location.pathname]);
  const endpoint = props.endpoint || "/api/kb/hybrid-chat";
  const title = props.title || "مساعد موطني";
  const surfaceId = props.surfaceId || "watany-hybrid-default";
  const quickChoices = useMemo(() => ["معاشي وتعويضاتي", "الطبابة والاستشفاء", "المدارس والمنح", "المعاملات والمستندات", "او شي تاني"], []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const appliedStateRef = useRef<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "أهلاً بك. اسألني عن التقاعد، المعاش، التعويضات، الطبابة، المدارس، أو المعاملات. سأجيب اعتماداً على قاعدة معرفة موطني قدر الإمكان.",
    },
  ]);

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setError("");
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          query: trimmed,
          surfaceId,
          locale: "ar-LB",
          source: "watany-hybrid-default",
          searchSnapshot: {
            query: `${trimmed} ${contextual.pageKeywords.slice(0, 6).join(" ")}`.trim(),
          },
          contextual: {
            originPath: location.pathname,
            pageContext: contextual.pageContext,
            chatMode: contextual.chatMode,
            searchScope: contextual.searchScope,
            pageKeywords: contextual.pageKeywords,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Hybrid chat request failed with HTTP ${response.status}`);
      }
      const payload = (await response.json()) as unknown;
      const answer = extractAnswer(payload);
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      setError(detail);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "تعذر الاتصال بخدمة Hybrid KB حالياً. تحقق من تشغيل بوابة API ثم حاول مجدداً.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(input);
  }

  // submitQuestion intentionally omitted from deps; safe to call by identity here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const state = (location.state as WatanyHybridDefaultLocationState | null) ?? null;
    const draft = typeof state?.draft === "string" ? state.draft.trim() : "";
    const handoffMessage = state?.handoffMessage ?? null;
    let handoffRole: ChatMessage["role"] | "" = "";
    if (handoffMessage?.role === "assistant") {
      handoffRole = "assistant";
    } else if (handoffMessage?.role === "user") {
      handoffRole = "user";
    }
    const handoffText = typeof handoffMessage?.text === "string" ? handoffMessage.text.trim() : "";
    const signature = JSON.stringify({ draft, handoffRole, handoffText });

    if ((!draft && !handoffText) || appliedStateRef.current === signature) {
      return;
    }

    appliedStateRef.current = signature;

    if (handoffRole === "assistant" && handoffText) {
      setError("");
      setMessages((current) => [...current, { role: "assistant", text: handoffText }]);
    } else if (handoffRole === "user" && handoffText) {
      void submitQuestion(handoffText);
    } else if (draft) {
      setInput(draft);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section
      data-hybrid-default-chat="true"
      data-hybrid-default-surface={surfaceId}
      data-community-preserved={props.preserveCommunityChat ? "true" : "false"}
      dir="rtl"
      className={props.className ? String(props.className) : "watany-hybrid-default-chat"}
      style={{
        width: "100%",
        maxWidth: "920px",
        margin: "0 auto",
        borderRadius: "24px",
        border: "1px solid rgba(15, 23, 42, 0.12)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
        boxShadow: "0 18px 55px rgba(15, 23, 42, 0.14)",
        overflow: "hidden",
      }}
    >
      <MainHybridChatSurface context="features/hybrid-chat/WatanyHybridDefaultChat.tsx" />
      <header style={{ padding: "18px 20px", borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
        <strong style={{ display: "block", fontSize: "1.18rem" }}>{title}</strong>
        <span style={{ display: "block", marginTop: "4px", color: "#475569", fontSize: "0.92rem" }}>
          Hybrid KB default assistant — Community Chat محفوظ كما هو
        </span>
      </header>

      <div data-hybrid-default-messages="true" style={{ display: "grid", gap: "12px", padding: "18px", minHeight: "280px" }}>
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            data-role={message.role}
            dir="auto"
            style={{
              justifySelf: message.role === "user" ? "start" : "end",
              maxWidth: "86%",
              padding: "12px 14px",
              borderRadius: message.role === "user" ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
              background: message.role === "user" ? "#e0f2fe" : "#f8fafc",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              color: "#0f172a",
              lineHeight: 1.75,
              whiteSpace: "pre-wrap",
            }}
          >
            {message.text}
          </article>
        ))}
        {loading ? <div style={{ color: "#475569" }}>جاري البحث في قاعدة المعرفة...</div> : null}
        {error ? <div data-hybrid-default-error="true" style={{ color: "#b91c1c" }}>{error}</div> : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "0 18px 14px" }}>
        {quickChoices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => void submitQuestion(choice)}
            style={{
              border: "1px solid rgba(15, 23, 42, 0.12)",
              borderRadius: "999px",
              background: "#ffffff",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            {choice}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px", padding: "14px 18px 18px", borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
        <input
          data-hybrid-default-input="true"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="اكتب سؤالك هنا..."
          aria-label="اكتب سؤالك إلى مساعد موطني"
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: "999px",
            border: "1px solid rgba(15, 23, 42, 0.16)",
            padding: "12px 14px",
            fontSize: "1rem",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{ border: 0, borderRadius: "999px", padding: "12px 18px", cursor: "pointer", fontWeight: 700 }}
        >
          إرسال
        </button>
      </form>
    </section>
  );
}

export default WatanyHybridDefaultChat;