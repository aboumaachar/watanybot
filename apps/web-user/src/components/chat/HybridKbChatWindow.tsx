import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getHybridKbGatewayBaseUrl, useLiveKbSearch } from "../../hooks/useLiveKbSearch";
import { mergeFeatureAndKbDocuments, useCurrentFeatureSearch } from "../../hooks/useCurrentFeatureSearch";
import { useConfig } from "../../store/app";
import { LiveKbResultPanel, type HybridKbSelectableResult } from "./LiveKbResultPanel";
import { resolveContextualChat, type ResolvedContextualChat } from "../../features/chat/contextualChatRuntime";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./hybrid-kb-chat.css";

type ChatAction = {
  kind?: string;
  label?: string;
  targetId?: string;
  route?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "context";
  content: string;
  sources?: Array<{ title?: string; chunkId?: string; id?: string; sourceType?: string }>;
  actions?: ChatAction[];
};

type SubmitMessageEvent = {
  preventDefault: () => void;
};

type HybridKbChatLocationState = Readonly<{
  draft?: string;
  selectedResult?: HybridKbSelectableResult | null;
  originPath?: string;
  chatContext?: ResolvedContextualChat;
}>;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildOpenSelectedMessage(result: HybridKbSelectableResult): string {
  return `اعرض معلومات ${result.label}`;
}

function getResultTags(result: HybridKbSelectableResult | null): string[] {
  if (!result) return [];
  const fromResult = Array.isArray(result.tags) ? result.tags : [];
  if (result.kind === "tag" && result.id) {
    return Array.from(new Set([result.id, ...fromResult].filter(Boolean)));
  }
  return Array.from(new Set(fromResult.filter(Boolean)));
}

function getResultKbIds(result: HybridKbSelectableResult | null): string[] {
  if (!result) return [];
  const fromResult = Array.isArray(result.kbIds) ? result.kbIds : [];
  return Array.from(new Set(fromResult.filter(Boolean)));
}

function getResultOriginLabel(result: HybridKbSelectableResult | null): string {
  if (!result?.sourceType) {
    return "نتيجة هجينة";
  }

  switch (result.sourceType) {
    case "form":
      return "من النماذج";
    case "service":
      return "من الخدمات الرسمية";
    case "job":
      return "من الوظائف";
    case "listing":
      return "من السوق";
    case "useful-link":
      return "من الروابط المفيدة";
    case "document-item":
      return "من المستندات";
    case "procedure":
      return "من المعاملات";
    case "faq":
      return "من الأسئلة الشائعة";
    default:
      return "من قاعدة المعرفة";
  }
}

export type HybridKbChatWindowProps = Readonly<{
  onClose?: () => void;
}>;

export function HybridKbChatWindow({ onClose }: HybridKbChatWindowProps) {
  const location = useLocation();
  const { apiBaseUrl } = useConfig();
  const [input, setInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [selectedResult, setSelectedResult] = useState<HybridKbSelectableResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [resultInfoDismissed, setResultInfoDismissed] = useState(false);
  const [originPathname, setOriginPathname] = useState<string>(location.pathname);
  const [chatContext, setChatContext] = useState<ResolvedContextualChat>(resolveContextualChat(location.pathname));
  const appliedLocationStateRef = useRef(false);

  const contextQuerySuffix = chatContext.pageKeywords.slice(0, 6).join(" ");
  const searchInput = contextQuerySuffix
    ? `${input} ${contextQuerySuffix}`.trim()
    : input;
  const liveSearch = useLiveKbSearch(searchInput, 8, 1, apiBaseUrl);
  const currentFeatureSearch = useCurrentFeatureSearch(input, originPathname, chatContext.pageContext, apiBaseUrl, 1);
  const mergedDocuments = useMemo(
    () => mergeFeatureAndKbDocuments(currentFeatureSearch.documents, liveSearch.documents),
    [currentFeatureSearch.documents, liveSearch.documents],
  );
  const debugSummary = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
    return isLocal ? {
      pageContext: chatContext.pageContext,
      originPath: originPathname,
      featureCount: currentFeatureSearch.documents.length,
      kbCount: liveSearch.documents.length,
      mergedCount: mergedDocuments.length,
    } : null;
  }, [chatContext.pageContext, currentFeatureSearch.documents.length, liveSearch.documents.length, mergedDocuments.length, originPathname]);

  const isExpanded = input.trim().length >= liveSearch.minChars || Boolean(selectedResult) || messages.length > 0 || isAnswering || Boolean(chatError);

  useEffect(() => {
    if (appliedLocationStateRef.current) {
      return;
    }

    const state = location.state as HybridKbChatLocationState | null;
    const nextDraft = typeof state?.draft === "string" ? state.draft.trim() : "";
    const nextResult = state?.selectedResult || null;
    const nextOriginPath = typeof state?.originPath === "string" && state.originPath.trim()
      ? state.originPath.trim().toLowerCase()
      : location.pathname;
    const nextContext = state?.chatContext || resolveContextualChat(nextOriginPath);

    setOriginPathname(nextOriginPath);
    setChatContext(nextContext);

    if (nextDraft) {
      setInput(nextDraft);
    }

    if (nextResult) {
      const nextTags = getResultTags(nextResult);
      const nextKbIds = getResultKbIds(nextResult);
      setSelectedResult(nextResult);
      setSelectedTags(nextTags);
      setSelectedKbIds(nextKbIds);
      setMessages((current) => [
        ...current,
        {
          id: makeId("context"),
          role: "context",
          content: `تم اختيار: ${nextResult.label}`,
        },
      ]);
    }

    appliedLocationStateRef.current = true;
  // location.pathname intentionally not included; this effect applies only once per location state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  function handleResultSelect(result: HybridKbSelectableResult) {
    const nextTags = getResultTags(result);
    const nextKbIds = getResultKbIds(result);
    setSelectedResult(result);
    setSelectedTags(nextTags);
    setSelectedKbIds(nextKbIds);
    setInput("");
    setChatError(null);
    setMessages((current) => [
      ...current,
      {
        id: makeId("context"),
        role: "context",
        content: `تم اختيار: ${result.label}`,
      },
    ]);
  }

  function clearSelectedContext() {
    setSelectedResult(null);
    setSelectedTags([]);
    setSelectedKbIds([]);
  }

  async function submitMessage(event: SubmitMessageEvent) {
    event.preventDefault();
    const typedMessage = input.trim();
    if (!typedMessage && !selectedResult) {
      return;
    }

    const intent = selectedResult && !typedMessage ? "open_selected_context" : "ask";
    const messageToSend = typedMessage || (selectedResult ? buildOpenSelectedMessage(selectedResult) : "");
    const visibleUserMessage = intent === "open_selected_context" && selectedResult
      ? `فتح موضوع: ${selectedResult.label}`
      : messageToSend;

    setMessages((current) => [...current, { id: makeId("user"), role: "user", content: visibleUserMessage }]);
    setInput("");
    setIsAnswering(true);
    setChatError(null);

    try {
      const gatewayBaseUrl = getHybridKbGatewayBaseUrl(apiBaseUrl);
      const response = await fetch(`${gatewayBaseUrl}/api/chat/hybrid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          intent,
          selectedTags,
          selectedKbIds,
          selectedResult,
          searchSnapshot: {
            query: selectedResult?.label || input || messageToSend,
            topTags: selectedTags,
            selectedLabel: selectedResult?.label,
            currentFeatureResults: currentFeatureSearch.documents.slice(0, 5).map((document) => ({
              title: document.title,
              sourceUrl: document.sourceUrl,
              tags: document.tags || [],
            })),
          },
          contextual: {
            originPath: originPathname,
            pageContext: chatContext.pageContext,
            chatMode: chatContext.chatMode,
            searchScope: chatContext.searchScope,
            pageKeywords: chatContext.pageKeywords,
          },
          conversationId: "hybrid-kb-ui",
        }),
      });

      if (!response.ok) {
        throw new Error(`hybrid chat failed with HTTP ${response.status}`);
      }

      const payload = await response.json();
      const answer = typeof payload.answer === "string" ? payload.answer : "تم تجهيز السياق من قاعدة المعرفة. اختر اقتراحاً أو اطرح سؤالك.";
      const sources = Array.isArray(payload.sources) ? payload.sources : [];
      const actions = Array.isArray(payload.actions) ? payload.actions : [];
      setMessages((current) => [...current, { id: makeId("assistant"), role: "assistant", content: answer, sources, actions }]);
    } catch (error_) {
      const messageText = error_ instanceof Error ? error_.message : "hybrid chat failed";
      setChatError(messageText);
      setMessages((current) => [
        ...current,
        {
          id: makeId("assistant-error"),
          role: "assistant",
          content: "تعذر إرسال السؤال الآن. تأكد أن خدمة موطني تعمل ثم حاول مجدداً.",
        },
      ]);
    } finally {
      setIsAnswering(false);
    }
  }

  return (
    <div
      className="hybrid-kb-chat-window"
      data-hybrid-kb-chat-window="true"
      data-hybrid-kb-expanded={isExpanded ? "true" : "false"}
      dir="auto"
    >
      {isExpanded ? (
        <LiveKbResultPanel
          query={input}
          visibleLength={liveSearch.visibleLength}
          minChars={liveSearch.minChars}
          tags={liveSearch.tags}
          documents={mergedDocuments}
          suggestedQuestions={liveSearch.suggestedQuestions}
          selectedTags={selectedTags}
          selectedResultId={selectedResult?.id}
          isSearching={liveSearch.isSearching || currentFeatureSearch.isSearching}
          error={currentFeatureSearch.error || liveSearch.error}
          resultInfoDismissed={resultInfoDismissed}
          onDismissResultInfo={() => setResultInfoDismissed(true)}
          onResultSelect={handleResultSelect}
          onUseQuestion={(question) => {
            setInput(question);
            setChatError(null);
          }}
          debugSummary={debugSummary}
        />
      ) : null}

      {isExpanded && selectedResult ? (
        <div className="hybrid-kb-selected-context" data-hybrid-kb-selected-context="true" data-hybrid-kb-selected-id={selectedResult.id}>
          <div>
            <span>{selectedResult.label}</span>
          </div>
          <button type="button" onClick={clearSelectedContext}>
            إلغاء الاختيار
          </button>
        </div>
      ) : null}

      <form className="hybrid-kb-composer" onSubmit={submitMessage}>
        <label className="hybrid-kb-input-label">
          <div className="hybrid-kb-input-row">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="اكتب كلمة للبحث أو سؤالاً"
              aria-label="سؤال موطني"
            />
            <button
              type="submit"
              className="hybrid-kb-icon-button"
              aria-label="إرسال"
              title="إرسال"
              disabled={isAnswering || (!input.trim() && !selectedResult)}
            >
              <span aria-hidden="true">{isAnswering ? "…" : "➤"}</span>
            </button>
            {onClose ? (
              <button type="button" className="hybrid-kb-icon-button hybrid-kb-close-button" onClick={onClose} aria-label="إغلاق المساعد" title="إغلاق">
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </div>
        </label>
      </form>

      {isExpanded ? (
        <div className="hybrid-kb-messages" data-hybrid-kb-messages="true">
          {messages.map((message) => (
            <article key={message.id} className={`hybrid-kb-message hybrid-kb-message--${message.role}`}>
              <p>{message.content}</p>
              {message.sources?.length ? (
                <ul className="hybrid-kb-sources">
                  {message.sources.map((source, index) => (
                    <li key={`${message.id}-source-${index}`}>{source.title || source.chunkId || source.id || "KB source"}</li>
                  ))}
                </ul>
              ) : null}
              {message.actions?.length ? (
                <div className="hybrid-kb-actions" data-hybrid-kb-actions="true">
                  {message.actions.map((action, index) => (
                    <button key={`${message.id}-action-${index}`} type="button" disabled>
                      {action.label || "متابعة"}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {isAnswering ? <div className="hybrid-kb-answering">جاري تحضير الجواب...</div> : null}
          {chatError ? <div className="hybrid-kb-chat-error">{chatError}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export default HybridKbChatWindow;
