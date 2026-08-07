import type { LiveKbDocumentResult, LiveKbTagResult } from "../../hooks/useLiveKbSearch";
import { KbTagChips } from "./KbTagChips";

export type HybridKbSelectableResult = {
  kind: "tag" | "document" | "procedure" | "faq" | "salary" | "payment" | "form" | "service" | "job" | "listing" | "useful-link" | "unknown";
  id: string;
  label: string;
  title?: string;
  tags: string[];
  kbIds: string[];
  sourceUrl?: string;
  sourceType?: string;
  score?: number;
};

type LiveKbResultPanelProps = Readonly<{
  query: string;
  visibleLength: number;
  minChars: number;
  tags: LiveKbTagResult[];
  documents: LiveKbDocumentResult[];
  suggestedQuestions: string[];
  selectedTags: string[];
  selectedResultId?: string | null;
  isSearching: boolean;
  error: string | null;
  resultInfoDismissed: boolean;
  onDismissResultInfo: () => void;
  onResultSelect: (result: HybridKbSelectableResult) => void;
  onUseQuestion: (question: string) => void;
  disableResultLinks?: boolean;
  compactMode?: boolean;
  debugSummary?: {
    pageContext: string;
    originPath: string;
    featureCount: number;
    kbCount: number;
    mergedCount: number;
  } | null;
}>;

function getOriginPriority(doc: LiveKbDocumentResult): number {
  return doc.sourceOrigin === "feature" ? 2 : 1;
}

function normalizeOriginLabel(doc: LiveKbDocumentResult): string {
  return doc.sourceOrigin === "feature" ? "من الميزة الحالية" : "من قاعدة المعرفة";
}

function normalizeKind(sourceType?: string): HybridKbSelectableResult["kind"] {
  if (sourceType === "procedure") return "procedure";
  if (sourceType === "faq") return "faq";
  if (sourceType === "salary") return "salary";
  if (sourceType === "payment") return "payment";
  if (sourceType === "form") return "form";
  if (sourceType === "service") return "service";
  if (sourceType === "job") return "job";
  if (sourceType === "listing") return "listing";
  if (sourceType === "useful-link") return "useful-link";
  if (sourceType === "document-item") return "document";
  if (sourceType === "document") return "document";
  return "unknown";
}

function tagToResult(tag: LiveKbTagResult): HybridKbSelectableResult {
  const label = cleanDisplayText(tag.labelAr || tag.label || tag.id || "وسم مرتبط") || "وسم مرتبط";
  const tagId = tag.id || label;
  return {
    kind: "tag",
    id: tagId,
    label,
    title: label,
    tags: [tagId],
    kbIds: [tagId],
  };
}

function documentToResult(doc: LiveKbDocumentResult): HybridKbSelectableResult {
  const tags = Array.isArray(doc.tags) ? doc.tags.filter(Boolean) : [];
  const kbIds = doc.kbId ? [doc.kbId] : tags;
  return {
    kind: normalizeKind(doc.sourceType),
    id: doc.id,
    label: doc.title || doc.id,
    title: doc.title || doc.id,
    tags,
    kbIds,
    sourceUrl: doc.sourceUrl,
    sourceType: doc.sourceType,
    score: doc.score,
  };
}

const TECHNICAL_TOKEN_SET = new Set([
  "canonical",
  "cluster",
  "clusters",
  "script",
  "command",
  "implementation",
  "report",
  "debug",
  "diagnostic",
  "pipeline",
  "manifest",
  "snapshot",
  "fixture",
  "spec",
  "test",
  "pilot",
  "rankmeta",
]);

const TECHNICAL_PHRASE_LIST = ["rank meta"];
const TECHNICAL_FILE_EXTENSIONS = [".md", ".json", ".csv", ".ts", ".tsx", ".js", ".jsx", ".ps1"];

function hasArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function cleanDisplayText(value: string): string {
  return value
    .replace(/["',]+/g, " ")
    .replace(/[._/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTechnicalTokens(value: string): boolean {
  const normalized = cleanDisplayText(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  const loweredRaw = value.trim().toLowerCase();
  if (TECHNICAL_FILE_EXTENSIONS.some((extension) => loweredRaw.endsWith(extension))) {
    return true;
  }

  if (TECHNICAL_PHRASE_LIST.some((phrase) => normalized.includes(phrase))) {
    return true;
  }

  return normalized.split(" ").some((token) => TECHNICAL_TOKEN_SET.has(token));
}

function normalizeSourceLabel(sourceType?: string): string {
  switch (sourceType) {
    case "procedure":
      return "معاملة";
    case "faq":
      return "سؤال شائع";
    case "salary":
      return "معاش";
    case "payment":
      return "دفعة";
    case "form":
      return "نموذج";
    case "service":
      return "خدمة";
    case "job":
      return "وظيفة";
    case "listing":
      return "إعلان";
    case "useful-link":
      return "رابط مفيد";
    case "document-item":
    case "document":
      return "مستند";
    default:
      return "مرجع";
  }
}

function renderDocumentTags(tags: string[]) {
  const visibleTags = tags.map(cleanDisplayText).filter(Boolean).slice(0, 3);
  if (!visibleTags.length) {
    return null;
  }

  return (
    <div className="hybrid-kb-document-tags" data-hybrid-kb-document-tags="true">
      {visibleTags.map((tag) => (
        <span key={tag} className="hybrid-kb-tag-chip">
          {tag}
        </span>
      ))}
    </div>
  );
}

function resolveSourceHref(doc: LiveKbDocumentResult): string | null {
  const direct = typeof doc.sourceUrl === "string" ? doc.sourceUrl.trim() : "";
  if (direct.startsWith("http://") || direct.startsWith("https://") || direct.startsWith("/")) {
    return direct;
  }

  const kbId = typeof doc.kbId === "string" ? doc.kbId.trim() : "";
  if (kbId) {
    return `/services/official/${encodeURIComponent(kbId)}`;
  }

  return null;
}

function isDisplayableDocument(doc: LiveKbDocumentResult, query: string): boolean {
  const title = cleanDisplayText(doc.title || "");
  if (!title || hasTechnicalTokens(doc.title || "")) {
    return false;
  }

  if (hasArabicText(title)) {
    return true;
  }

  const normalizedQuery = cleanDisplayText(query).toLowerCase();
  if (normalizedQuery && title.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  return false;
}

function normalizeQuestion(value: string): string {
  return cleanDisplayText(value);
}

function isDisplayableQuestion(value: string): boolean {
  const question = normalizeQuestion(value);
  if (!question || hasTechnicalTokens(value)) {
    return false;
  }
  return hasArabicText(question) || question.includes("?") || question.includes("؟");
}

function hasDependentDaughterIntent(value: string): boolean {
  return /(الابنة|ابنة|بنت|daughter|dependent daughter)/i.test(value);
}

function buildUiFallbackDocuments(query: string): LiveKbDocumentResult[] {
  if (!hasDependentDaughterIntent(query)) {
    return [];
  }

  return [
    {
      id: "ui-fallback-dependent-daughter-faq",
      title: "حقوق الابنة على العاتق: الشروط والمستندات",
      kbId: "family-dependents",
      sourceUrl: "/faq?query=%D8%A7%D9%84%D8%A7%D8%A8%D9%86%D8%A9%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
      score: 98,
      tags: ["family-dependents"],
      sourceType: "faq",
      sourceOrigin: "kb",
    },
    {
      id: "ui-fallback-dependent-daughter-procedure",
      title: "إجراءات تسجيل الابنة ضمن المستفيدين",
      kbId: "family-dependents",
      sourceUrl: "/procedures?query=%D8%AA%D8%B3%D8%AC%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%A8%D9%86%D8%A9",
      score: 94,
      tags: ["family-dependents"],
      sourceType: "procedure",
      sourceOrigin: "kb",
    },
    {
      id: "ui-fallback-dependent-daughter-forms",
      title: "النماذج المطلوبة لمعاملة الابنة على العاتق",
      kbId: "family-dependents",
      sourceUrl: "/forms?query=%D8%A7%D9%84%D8%A7%D8%A8%D9%86%D8%A9%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
      score: 90,
      tags: ["family-dependents"],
      sourceType: "document",
      sourceOrigin: "kb",
    },
  ];
}

type LiveKbBodyProps = Readonly<{
  query: string;
  visibleLength: number;
  minChars: number;
  tags: LiveKbTagResult[];
  curatedDocuments: LiveKbDocumentResult[];
  curatedQuestions: string[];
  selectedTags: string[];
  selectedResultId?: string | null;
  isSearching: boolean;
  error: string | null;
  hasResults: boolean;
  resultInfoDismissed: boolean;
  onDismissResultInfo: () => void;
  onResultSelect: (result: HybridKbSelectableResult) => void;
  onUseQuestion: (question: string) => void;
  disableResultLinks?: boolean;
  compactMode?: boolean;
  debugSummary?: LiveKbResultPanelProps["debugSummary"];
}>;

function renderDebugSummary(summary?: LiveKbResultPanelProps["debugSummary"]) {
  if (!summary) {
    return null;
  }

  return (
    <details className="hybrid-kb-debug" data-hybrid-kb-debug="true">
      <summary>تشخيص البحث الهجين</summary>
      <div className="hybrid-kb-debug__grid">
        <span>المسار: {summary.originPath}</span>
        <span>السياق: {summary.pageContext}</span>
        <span>نتائج الميزة الحالية: {summary.featureCount}</span>
        <span>نتائج قاعدة المعرفة: {summary.kbCount}</span>
        <span>الإجمالي المدمج: {summary.mergedCount}</span>
      </div>
    </details>
  );
}

function renderInfoBanner(hasResults: boolean, resultInfoDismissed: boolean, onDismissResultInfo: () => void) {
  if (!hasResults || resultInfoDismissed) {
    return null;
  }

  return (
    <div className="hybrid-kb-live-info" data-hybrid-kb-live-info="true">
      <span>تم العثور على اقتراحات مرتبطة ببحثك.</span>
      <button type="button" onClick={onDismissResultInfo} aria-label="إغلاق صندوق الاقتراحات">
        إغلاق
      </button>
    </div>
  );
}

function renderStatusBlock(
  error: string | null,
  isSearching: boolean,
  hasResults: boolean,
  debugSummary?: LiveKbResultPanelProps["debugSummary"],
) {
  if (error) {
    if (hasResults && (debugSummary?.featureCount || 0) > 0) {
      return null;
    }

    return (
      <div className="hybrid-kb-live-error" data-hybrid-kb-live-error="true">
        تعذر تحميل الاقتراحات. تأكد أن خدمة موطني تعمل ثم حاول مجدداً.
        {" "}
        <small>{error}</small>
      </div>
    );
  }

  if (!isSearching && !hasResults) {
    return (
      <div className="hybrid-kb-live-empty" data-hybrid-kb-live-empty="true">
        لا توجد اقتراحات مطابقة. جرّب كلمة أخرى أو اختر او شي تاني.
      </div>
    );
  }

  return null;
}

function renderDocumentCards(
  curatedDocuments: LiveKbDocumentResult[],
  selectedResultId: string | null | undefined,
  onResultSelect: (result: HybridKbSelectableResult) => void,
  disableResultLinks = false,
) {
  if (!curatedDocuments.length) {
    return null;
  }

  return (
    <div className="hybrid-kb-documents" data-hybrid-kb-documents="true">
      {curatedDocuments.map((doc) => {
        const result = documentToResult(doc);
        const selected = selectedResultId === result.id;
        const href = resolveSourceHref(doc);
        const opensExternal = Boolean(href && /^https?:\/\//i.test(href));

        return (
          <article
            key={doc.id}
            className={`hybrid-kb-document-card${selected ? " hybrid-kb-document-card--selected" : ""}`}
            data-hybrid-kb-result-id={result.id}
            data-hybrid-kb-result-href={href || ""}
          >
            <div className="hybrid-kb-document-card__meta">
              <small>{normalizeOriginLabel(doc)}</small>
              <small>{normalizeSourceLabel(doc.sourceType)}</small>
            </div>

            <button
              type="button"
              className="hybrid-kb-document-card__title-button"
              onClick={() => onResultSelect(result)}
            >
              <span className="hybrid-kb-document-card__title">{cleanDisplayText(doc.title)}</span>
            </button>

            {renderDocumentTags(result.tags)}

            <div className="hybrid-kb-document-card__actions">
              <button type="button" onClick={() => onResultSelect(result)}>
                اختيار
              </button>
              {href && !disableResultLinks ? (
                <a
                  className="hybrid-kb-document-card__open"
                  href={href}
                  target={opensExternal ? "_blank" : undefined}
                  rel={opensExternal ? "noreferrer" : undefined}
                  aria-label={`افتح ${cleanDisplayText(doc.title)}`}
                >
                  فتح المصدر
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function renderLiveKbBody({
  query,
  visibleLength,
  minChars,
  tags,
  curatedDocuments,
  curatedQuestions,
  selectedTags,
  selectedResultId,
  isSearching,
  error,
  hasResults,
  resultInfoDismissed,
  onDismissResultInfo,
  onResultSelect,
  onUseQuestion,
  disableResultLinks,
  compactMode,
  debugSummary,
}: LiveKbBodyProps) {
  if (visibleLength < minChars) {
    return null;
  }

  if (compactMode) {
    if (!curatedDocuments.length) {
      return null;
    }

    return renderDocumentCards(curatedDocuments, selectedResultId, onResultSelect, disableResultLinks);
  }

  return (
    <>
      {renderInfoBanner(hasResults, resultInfoDismissed, onDismissResultInfo)}

      <div className="hybrid-kb-live-title">
        <strong>اقتراحات مرتبطة بـ: {query}</strong>
        {isSearching ? <span>جاري البحث...</span> : null}
      </div>

      {renderStatusBlock(error, isSearching, hasResults, debugSummary)}
      {renderDebugSummary(debugSummary)}

      <KbTagChips
        tags={tags}
        selectedTags={selectedTags}
        onSelectTag={(tag) => onResultSelect(tagToResult(tag))}
      />

      {renderDocumentCards(
        curatedDocuments,
        selectedResultId,
        onResultSelect,
        disableResultLinks,
      )}

      {curatedQuestions.length ? (
        <div className="hybrid-kb-followups" data-hybrid-kb-followups="true">
          {curatedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onUseQuestion(question)}
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function LiveKbResultPanel({
  query,
  visibleLength,
  minChars,
  tags,
  documents,
  suggestedQuestions,
  selectedTags,
  selectedResultId,
  isSearching,
  error,
  resultInfoDismissed,
  onDismissResultInfo,
  onResultSelect,
  onUseQuestion,
  disableResultLinks,
  compactMode = false,
  debugSummary,
}: LiveKbResultPanelProps) {
  const filteredDocuments = documents
    .filter((doc) => isDisplayableDocument(doc, query))
    .sort((left, right) => {
      const originDelta = getOriginPriority(right) - getOriginPriority(left);
      if (originDelta !== 0) {
        return originDelta;
      }

      return (right.rankingScore || right.score || 0) - (left.rankingScore || left.score || 0);
    })
    .slice(0, 5);
  const curatedDocuments = filteredDocuments.length > 0 ? filteredDocuments : buildUiFallbackDocuments(query).slice(0, 5);
  const curatedQuestions = suggestedQuestions.map(normalizeQuestion).filter(isDisplayableQuestion).slice(0, 4);
  const hasResults = tags.length > 0 || curatedDocuments.length > 0 || curatedQuestions.length > 0;

  if (compactMode && (visibleLength < minChars || !curatedDocuments.length)) {
    return null;
  }

  return (
    <section
      className="hybrid-kb-live-results"
      data-hybrid-kb-live-results="true"
      data-hybrid-kb-visible-length={visibleLength}
      data-hybrid-kb-min-chars={minChars}
      aria-live="polite"
    >
      {renderLiveKbBody({
        query,
        visibleLength,
        minChars,
        tags,
        curatedDocuments,
        curatedQuestions,
        selectedTags,
        selectedResultId,
        isSearching,
        error,
        hasResults,
        resultInfoDismissed,
        onDismissResultInfo,
        onResultSelect,
        onUseQuestion,
        disableResultLinks,
        compactMode,
        debugSummary,
      })}
    </section>
  );
}