import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { useLiveKbSearch, type LiveKbDocumentResult } from "../../hooks/useLiveKbSearch";
import { mergeFeatureAndKbDocuments, useCurrentFeatureSearch } from "../../hooks/useCurrentFeatureSearch";
import { useApp, useConfig } from "../../store/app";
import { LiveKbResultPanel, type HybridKbSelectableResult } from "./LiveKbResultPanel";
import { resolveContextualChat } from "../../features/chat/contextualChatRuntime";
import KoudamaFeatureIcon from "../koudama-icons/KoudamaFeatureIcon";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./sticky-hybrid-chat-launcher.css";

type BrowserSpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognitionErrorEvent = {
  error?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type LauncherSubmitEvent = {
  preventDefault: () => void;
};

const HIDDEN_ROUTE_PREFIXES = [
  "/hybrid-kb-chat",
  "/chat",
  "/assistant",
  "/fake-news",
  "/news",
  "/login",
  "/register",
] as const;
const UTILITY_RAIL_HIDDEN_ROUTE_PREFIXES = [
  "/hybrid-kb-chat",
  "/chat",
  "/assistant",
  "/login",
  "/register",
  "/superadmin",
] as const;
const PROCEDURES_FILTER_EVENT = "watany-procedures-filter";
const BOTTOM_CHROME_CLEARANCE = "calc(184px + env(safe-area-inset-bottom, 0px))";

function buildInlinePreview(result: HybridKbSelectableResult): string {
  switch (result.id) {
    case "hybrid-fallback-salary-calculator":
      return "الجواب الأنسب هنا هو حاسبة المعاش نفسها. افتحها لحساب المعاش التقديري بسرعة، ثم أدخل الراتب أو المعطيات المطلوبة للحصول على نتيجة مباشرة. يمكنك أيضاً المتابعة بسؤال مثل: كيف أستخدم الحاسبة؟ أو ما الذي يدخل في احتساب المعاش؟";
    case "hybrid-fallback-pension-benefits":
      return "يشمل هذا الموضوع حساب المعاش الأساسي والتعويضات والاستحقاقات المرتبطة بالتقاعد. اكتب سؤالك بصيغة أدق مثل: كيف أحسب معاشي؟ أو ما هي التعويضات التي أستفيد منها؟";
    case "hybrid-fallback-healthcare":
      return "هذا المسار يغطي الطبابة والاستشفاء والتغطية الصحية والمراجعات الطبية. يمكنك المتابعة بسؤال مباشر عن الشروط أو التغطية أو المستندات المطلوبة.";
    case "hybrid-fallback-schools-grants":
      return "هنا ستجد ما يخص المدارس والمنح والمساعدات التعليمية للأبناء. تابع بسؤال عن الشروط أو قيمة المساعدة أو طريقة التقديم.";
    case "hybrid-fallback-procedures-documents":
      return "هذا العنوان يوجّهك إلى المعاملات والمستندات والنماذج المطلوبة. اكتب اسم المعاملة أو نوع المستند لتحصل على نتيجة أدق.";
    case "hybrid-fallback-alerts-followup":
      return "هذا القسم يجمع التنبيهات والإشعارات ومتابعة الطلبات الجارية. يمكنك السؤال عن آخر تنبيه أو طريقة متابعة حالة محددة.";
    case "hybrid-fallback-jobs-market":
      return "هذا الموضوع يغطي الوظائف والسوق والخدمات المتاحة. تابع بسؤال عن وظيفة، خدمة، أو فرصة مناسبة لك.";
    default: {
      const topTags = result.tags.filter(Boolean).slice(0, 3).join("، ");
      const sourceLabel = result.sourceType || "الموضوع";
      return topTags
        ? `تم اختيار ${result.label}. هذا ${sourceLabel} مرتبط بـ ${topTags}. تابع بكتابة سؤال قصير ومباشر للحصول على جواب أدق داخل نفس النافذة.`
        : `تم اختيار ${result.label}. تابع بكتابة سؤال قصير ومباشر للحصول على جواب أدق داخل نفس النافذة.`;
    }
  }
}

function buildInlinePreviewLinkLabel(result: HybridKbSelectableResult): string {
  switch (result.id) {
    case "hybrid-fallback-salary-calculator":
      return "افتح حاسبة المعاش";
    case "hybrid-fallback-pension-benefits":
      return "افتح تفاصيل المعاش والتعويضات";
    case "hybrid-fallback-healthcare":
      return "افتح قسم الطبابة والاستشفاء";
    case "hybrid-fallback-schools-grants":
      return "افتح المدارس والمنح";
    case "hybrid-fallback-procedures-documents":
      return "افتح المعاملات والمستندات";
    case "hybrid-fallback-alerts-followup":
      return "افتح التنبيهات والإشعارات";
    case "hybrid-fallback-jobs-market":
      return "افتح الوظائف والسوق";
    default:
      return `افتح ${result.label}`;
  }
}

function mapDocumentToSelectableResult(document: LiveKbDocumentResult): HybridKbSelectableResult {
  const tags = Array.isArray(document.tags) ? document.tags.filter(Boolean) : [];
  const kbIds = document.kbId ? [document.kbId] : tags;
  return {
    kind: "document",
    id: document.id,
    label: document.title || document.id,
    title: document.title || document.id,
    tags,
    kbIds,
    sourceUrl: document.sourceUrl,
    sourceType: document.sourceType,
    score: document.score,
  };
}

export function shouldHideLauncher(pathname: string): boolean {
  return HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function shouldHideUtilityRail(pathname: string): boolean {
  return UTILITY_RAIL_HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

type PopupStateSetters = {
  setPopupOpen: Dispatch<SetStateAction<boolean>>;
  setResultInfoDismissed: Dispatch<SetStateAction<boolean>>;
};

type DraftLaunchArgs = PopupStateSetters & {
  draft: string;
  inputRef: MutableRefObject<HTMLInputElement | null>;
  isProceduresRoute: boolean;
  mergedDocuments: LiveKbDocumentResult[];
  setSelectedResult: Dispatch<SetStateAction<HybridKbSelectableResult | null>>;
};

type UtilityAction = {
  id: string;
  label: string;
  featureId: string;
  active: boolean;
  onClick: () => void;
};

function focusLauncherInput(inputRef: MutableRefObject<HTMLInputElement | null>): void {
  inputRef.current?.focus();
}

function closeLauncherInlineUi({ setPopupOpen, setResultInfoDismissed }: PopupStateSetters): void {
  setPopupOpen(false);
  setResultInfoDismissed(true);
}

function showLauncherPopup(inputRef: MutableRefObject<HTMLInputElement | null>, { setPopupOpen, setResultInfoDismissed }: PopupStateSetters): void {
  setPopupOpen(true);
  setResultInfoDismissed(true);
  focusLauncherInput(inputRef);
}

function buildLauncherDebugSummary(
  pathname: string,
  pageContext: string,
  featureCount: number,
  kbCount: number,
  mergedCount: number,
) {
  const browserWindow = globalThis.window;
  if (browserWindow === undefined) {
    return null;
  }

  const host = browserWindow.location.hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    return null;
  }

  return {
    pageContext,
    originPath: pathname,
    featureCount,
    kbCount,
    mergedCount,
  };
}

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  const speechWindow = globalThis as typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function getMicActionLabel(dictationEnabled: boolean, isListening: boolean): string {
  if (!dictationEnabled) {
    return "الميكروفون";
  }

  return isListening ? "إيقاف الإملاء الصوتي" : "بدء الإملاء الصوتي";
}

function navigateToAccount(
  isAuthed: boolean,
  loginNextRoute: string,
  navigate: NavigateFunction,
  popupState: PopupStateSetters,
): void {
  closeLauncherInlineUi(popupState);
  if (!isAuthed) {
    navigate(`/login?next=${encodeURIComponent(loginNextRoute)}`);
    return;
  }

  navigate("/profile");
}

function launchDraftForState({
  draft,
  inputRef,
  isProceduresRoute,
  mergedDocuments,
  setSelectedResult,
  setPopupOpen,
  setResultInfoDismissed,
}: DraftLaunchArgs): void {
  const trimmedDraft = draft.trim();
  const popupState = { setPopupOpen, setResultInfoDismissed };

  if (!trimmedDraft) {
    setPopupOpen(true);
    focusLauncherInput(inputRef);
    return;
  }

  if (isProceduresRoute) {
    globalThis.dispatchEvent(new CustomEvent(PROCEDURES_FILTER_EVENT, { detail: { query: trimmedDraft } }));
    setPopupOpen(true);
    setResultInfoDismissed(false);
    focusLauncherInput(inputRef);
    return;
  }

  if (mergedDocuments.length > 0) {
    setSelectedResult(mapDocumentToSelectableResult(mergedDocuments[0]));
  }

  showLauncherPopup(inputRef, popupState);
}

function buildUtilityActions(args: {
  pathname: string;
  isAuthed: boolean;
  openAccount: () => void;
  openNotifications: () => void;
  openMarket: () => void;
  triggerInstallFlow: () => void;
  openCommunity: () => void;
}): UtilityAction[] {
  const { pathname, isAuthed, openAccount, openNotifications, openMarket, triggerInstallFlow, openCommunity } = args;

  return [
    {
      id: "account",
      label: isAuthed ? "حسابي" : "تسجيل الدخول",
      featureId: isAuthed ? "profile" : "login",
      active: isAuthed
        ? pathname === "/profile" || pathname.startsWith("/profile/")
        : pathname === "/login",
      onClick: openAccount,
    },
    {
      id: "notifications",
      label: "الإشعارات",
      featureId: "notifications",
      active: pathname === "/notifications" || pathname.startsWith("/notifications/"),
      onClick: openNotifications,
    },
    {
      id: "market",
      label: "السوق",
      featureId: "marketplace",
      active: pathname === "/market" || pathname.startsWith("/market/") || pathname === "/marketplace" || pathname.startsWith("/marketplace/"),
      onClick: openMarket,
    },
    {
      id: "install",
      label: "التثبيت",
      featureId: "install",
      active: false,
      onClick: triggerInstallFlow,
    },
    {
      id: "community",
      label: "المجتمع",
      featureId: "community",
      active: pathname === "/community" || pathname.startsWith("/community/") || pathname === "/groups" || pathname.startsWith("/groups/"),
      onClick: openCommunity,
    },
  ];
}

// Removed unused InstallLauncherIcon to satisfy eslint no-unused-vars rule

function MicLauncherIcon() {
  return (
    <span className="sticky-hybrid-chat-launcher__install-glyph" aria-hidden="true">
      <KoudamaFeatureIcon featureId="voice" size="sm" />
    </span>
  );
}

function SendLauncherIcon() {
  return (
    <span className="sticky-hybrid-chat-launcher__send-glyph" aria-hidden="true">
      <KoudamaFeatureIcon featureId="ask-watany" size="sm" />
    </span>
  );
}

export default function StickyHybridChatLauncher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { apiBaseUrl } = useConfig();
  const { profile, dictationEnabled } = useApp();
  const [draft, setDraft] = useState("");
  const [popupOpen, setPopupOpen] = useState(false);
  const [resultInfoDismissed, setResultInfoDismissed] = useState(true);
  const [selectedResult, setSelectedResult] = useState<HybridKbSelectableResult | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const micStartFallbackTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const pathname = location.pathname.toLowerCase();
  const isProceduresRoute = pathname === "/procedures" || pathname.startsWith("/procedures/");
  const contextualChat = resolveContextualChat(pathname);
  const liveSearch = useLiveKbSearch(draft, 8, 1, apiBaseUrl);
  const currentFeatureSearch = useCurrentFeatureSearch(draft, pathname, contextualChat.pageContext, apiBaseUrl, 1);
  const mergedDocuments = mergeFeatureAndKbDocuments(currentFeatureSearch.documents, liveSearch.documents);
  const hasInlineResults = draft.trim().length > 0 && mergedDocuments.length > 0;
  const hasInlinePreview = Boolean(selectedResult);
  const debugSummary = buildLauncherDebugSummary(
    pathname,
    contextualChat.pageContext,
    currentFeatureSearch.documents.length,
    liveSearch.documents.length,
    mergedDocuments.length,
  );
  const hidden = shouldHideLauncher(pathname);
  const utilityRailHidden = shouldHideUtilityRail(pathname);

  useEffect(() => {
    setPortalReady(true);

    return () => {
      if (micStartFallbackTimeoutRef.current !== null) {
        globalThis.clearTimeout(micStartFallbackTimeoutRef.current);
        micStartFallbackTimeoutRef.current = null;
      }
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setPortalReady(false);
    };
  }, []);

  useEffect(() => {
    const root = globalThis.document?.documentElement;
    if (!portalReady || utilityRailHidden || !root) {
      return undefined;
    }

    const previousClearance = root.style.getPropertyValue("--watany-bottom-overlay-clearance");
    root.style.setProperty("--watany-bottom-overlay-clearance", BOTTOM_CHROME_CLEARANCE);

    return () => {
      if (previousClearance) {
        root.style.setProperty("--watany-bottom-overlay-clearance", previousClearance);
        return;
      }
      root.style.removeProperty("--watany-bottom-overlay-clearance");
    };
  }, [portalReady, utilityRailHidden]);

  useEffect(() => {
    if (!isProceduresRoute) return;
    globalThis.dispatchEvent(new CustomEvent(PROCEDURES_FILTER_EVENT, { detail: { query: draft } }));
  }, [draft, isProceduresRoute]);

  useEffect(() => {
    if (!popupOpen || !portalReady || !globalThis.document) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (shellRef.current && !shellRef.current.contains(target)) {
        setPopupOpen(false);
        setResultInfoDismissed(true);
      }
    };

    globalThis.document.addEventListener("mousedown", handlePointerDown);
    globalThis.document.addEventListener("touchstart", handlePointerDown);

    return () => {
      globalThis.document.removeEventListener("mousedown", handlePointerDown);
      globalThis.document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [popupOpen, portalReady, draft, selectedResult]);

  if (!portalReady || !globalThis.document?.body || (hidden && utilityRailHidden)) {
    return null;
  }

  const currentRoute = `${location.pathname}${location.search}${location.hash}`;
  const loginNextRoute = currentRoute.length > 0 ? currentRoute : "/";
  const popupState = { setPopupOpen, setResultInfoDismissed };
  const micActionLabel = getMicActionLabel(dictationEnabled, isListening);

  function clearMicStartFallbackTimeout() {
    if (micStartFallbackTimeoutRef.current === null) {
      return;
    }

    globalThis.clearTimeout(micStartFallbackTimeoutRef.current);
    micStartFallbackTimeoutRef.current = null;
  }

  function openVoiceMode() {
    clearMicStartFallbackTimeout();
    setIsListening(false);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    closeLauncherInlineUi(popupState);
    setSelectedResult(null);
    navigate("/media?voice=1");
  }

  function openPopup() {
    setPopupOpen(true);
    focusLauncherInput(inputRef);
  }

  function triggerInstallFlow() {
    closeLauncherInlineUi(popupState);
    globalThis.dispatchEvent(new CustomEvent("watany-open-install-prompt"));
  }

  function triggerMicFocus() {
    setSelectedResult(null);
    setPopupOpen(false);
    setResultInfoDismissed(true);
    inputRef.current?.focus();

    if (pathname === "/") {
      openVoiceMode();
      return;
    }

    if (!dictationEnabled) {
      openVoiceMode();
      return;
    }

    if (isListening) {
      clearMicStartFallbackTimeout();
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      openVoiceMode();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    const fallbackToVoiceMode = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      openVoiceMode();
    };

    recognition.lang = "ar-LB";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      clearMicStartFallbackTimeout();
      setIsListening(true);
      inputRef.current?.focus();
    };
    recognition.onresult = (event) => {
      clearMicStartFallbackTimeout();
      const transcript = Array.from(event.results)
        .flatMap((result) => Array.from(result))
        .map((entry) => entry.transcript)
        .join(" ")
        .trim();

      if (!transcript) {
        return;
      }

      setDraft(transcript);
      setPopupOpen(true);
      setResultInfoDismissed(true);
    };
    recognition.onerror = () => {
      fallbackToVoiceMode();
    };
    recognition.onend = () => {
      clearMicStartFallbackTimeout();
      setIsListening(false);
      recognitionRef.current = null;
      inputRef.current?.focus();
    };

    recognitionRef.current = recognition;
    clearMicStartFallbackTimeout();
    micStartFallbackTimeoutRef.current = globalThis.setTimeout(() => {
      if (recognitionRef.current !== recognition) {
        return;
      }

      try {
        recognition.abort();
      } catch {
        // Ignore abort failures and continue to the dedicated voice route.
      }
      fallbackToVoiceMode();
    }, 1200);

    try {
      recognition.start();
    } catch {
      fallbackToVoiceMode();
    }
  }

  function openCommunity() {
    closeLauncherInlineUi(popupState);
    navigate("/community");
  }

  function openNotifications() {
    closeLauncherInlineUi(popupState);
    navigate("/notifications");
  }

  function openAccount() {
    navigateToAccount(profile.isAuthed, loginNextRoute, navigate, popupState);
  }

  function openMarket() {
    closeLauncherInlineUi(popupState);
    navigate("/marketplace");
  }

  function launchSelectedResult() {
    if (!selectedResult) {
      openPopup();
      return;
    }

    showLauncherPopup(inputRef, popupState);
  }

  function handleSubmit(event: LauncherSubmitEvent) {
    event.preventDefault();
    if (selectedResult) {
      launchSelectedResult();
      return;
    }

    launchDraftForState({
      draft,
      inputRef,
      isProceduresRoute,
      mergedDocuments,
      setSelectedResult,
      setPopupOpen,
      setResultInfoDismissed,
    });
  }

  function handleResultSelect(result: HybridKbSelectableResult) {
    setSelectedResult(result);
    setPopupOpen(true);
    setResultInfoDismissed(true);
    inputRef.current?.focus();
  }

  const utilityActions = buildUtilityActions({
    pathname,
    isAuthed: profile.isAuthed,
    openAccount,
    openNotifications,
    openMarket,
    triggerInstallFlow,
    openCommunity,
  });

  const popupVisible = popupOpen && (hasInlineResults || hasInlinePreview);

  return createPortal(
    <div ref={shellRef} className="sticky-hybrid-chat-launcher-shell" data-sticky-hybrid-chat-launcher="true" dir="rtl">
      {!hidden && popupVisible ? (
        <section className="sticky-hybrid-chat-launcher__popup" data-sticky-hybrid-chat-popup="true" aria-label="نتائج بحث موطني">
          <LiveKbResultPanel
            query={liveSearch.query}
            visibleLength={liveSearch.visibleLength}
            minChars={liveSearch.minChars}
            tags={liveSearch.tags}
            documents={mergedDocuments}
            suggestedQuestions={liveSearch.suggestedQuestions}
            selectedTags={selectedResult?.tags || []}
            selectedResultId={selectedResult?.id || null}
            isSearching={liveSearch.isSearching || currentFeatureSearch.isSearching}
            error={liveSearch.error || currentFeatureSearch.error}
            resultInfoDismissed={resultInfoDismissed}
            onDismissResultInfo={() => setResultInfoDismissed(true)}
            onResultSelect={handleResultSelect}
            onUseQuestion={(question) => {
              setDraft(question);
              setSelectedResult(null);
              setPopupOpen(true);
              setResultInfoDismissed(true);
              inputRef.current?.focus();
            }}
            disableResultLinks={isProceduresRoute}
            compactMode
            debugSummary={debugSummary}
          />

          {selectedResult ? (
            <div className="sticky-hybrid-chat-launcher__preview" data-sticky-hybrid-chat-preview="true">
              <strong>{selectedResult.label}</strong>
              <p>{buildInlinePreview(selectedResult)}</p>
              {selectedResult.sourceUrl ? (
                <a className="sticky-hybrid-chat-launcher__preview-link" href={selectedResult.sourceUrl}>
                  {buildInlinePreviewLinkLabel(selectedResult)}
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {hidden ? null : (
        <form
          className="sticky-hybrid-chat-launcher sticky-hybrid-chat-launcher--expanded"
          data-expanded={popupVisible ? "true" : "false"}
          data-sticky-hybrid-chat-form="true"
          onSubmit={handleSubmit}
          aria-label="اسأل موطني"
        >
          <button
            type="button"
            className={isListening ? "sticky-hybrid-chat-launcher__avatar is-listening" : "sticky-hybrid-chat-launcher__avatar"}
            onClick={triggerMicFocus}
            aria-label={micActionLabel}
            aria-pressed={dictationEnabled ? isListening : undefined}
            title={micActionLabel}
          >
            <MicLauncherIcon />
          </button>

          <input
            ref={inputRef}
            className="sticky-hybrid-chat-launcher__input"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setSelectedResult(null);
              setPopupOpen(true);
              setResultInfoDismissed(true);
            }}
            onFocus={() => {
              if (draft.trim().length > 0 || selectedResult) {
                setPopupOpen(true);
              }
            }}
            placeholder={isProceduresRoute ? "ابحث في المعاملات..." : "اسأل موطني..."}
            aria-label="اسأل موطني"
          />

          <button
            type="submit"
            className="sticky-hybrid-chat-launcher__send"
            aria-label={selectedResult ? "افتح المحادثة بالنتيجة المختارة" : "إرسال السؤال"}
          >
            <SendLauncherIcon />
          </button>
        </form>
      )}

      {utilityRailHidden ? null : (
        <nav className="sticky-hybrid-chat-launcher__utility-rail" data-sticky-hybrid-utility-rail="true" aria-label="الوصول السريع">
          {utilityActions.map((action) => {
            return (
              <button
                type="button"
                key={action.id}
                className={action.active ? "sticky-hybrid-chat-launcher__utility-button is-active" : "sticky-hybrid-chat-launcher__utility-button"}
                data-feature-key={action.featureId}
                aria-current={action.active ? "page" : undefined}
                aria-label={action.label}
                title={action.label}
                onClick={action.onClick}
              >
                <span className="sticky-hybrid-chat-launcher__utility-icon" aria-hidden="true">
                  <KoudamaFeatureIcon featureId={action.featureId} size="sm" />
                </span>
                <span className="sticky-hybrid-chat-launcher__utility-label">{action.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>,
    globalThis.document.body,
  );
}
