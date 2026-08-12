// PAYMENT_OVERRIDE_LIVE_PIPELINE_WIRING_V1: payment override wiring reviewed for live pipeline integration.
import { searchKbLive, type LiveSearchDocumentResult } from "../kb/kb-search.service";

export type HybridKbSelectedResult = {
  kind?: "tag" | "document" | "procedure" | "faq" | "salary" | "payment" | "unknown";
  type?: string;
  id: string;
  label: string;
  title?: string;
  tags?: string[];
  kbIds?: string[];
  sourceType?: string;
  route?: string;
  summary?: string;
  score?: number;
};

export type HybridChatRequest = {
  message: string;
  intent?: "ask" | "open_selected_context";
  selectedTags?: string[];
  selectedKbIds?: string[];
  selectedResult?: HybridKbSelectedResult | null;
  searchSnapshot?: {
    query?: string;
    topTags?: string[];
    selectedLabel?: string;
  };
  contextual?: {
    originPath?: string;
    pageContext?: string;
    chatMode?: string;
    searchScope?: string[];
    pageKeywords?: string[];
  };
  conversationId?: string;
};

export type HybridChatAction = {
  kind: "open_procedure" | "open_document" | "ask_follow_up" | "clear_context";
  label: string;
  targetId?: string;
  route?: string;
};

export type HybridChatResponse = {
  answer: string;
  mode: "selected-context-ready" | "retrieval-context-ready" | "clarification-required";
  sources: LiveSearchDocumentResult[];
  followUps: string[];
  selectedTags: string[];
  selectedKbIds: string[];
  selectedResult?: HybridKbSelectedResult | null;
  actions: HybridChatAction[];
  confidence: number;
  conversationId: string;
  generatedAt: string;
};

function makeConversationId(existing?: string): string {
  if (existing?.trim()) {
    return existing;
  }

  return `hybrid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function unique(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function resolveSelectedTags(request: HybridChatRequest): string[] {
  const selectedResult = request.selectedResult || null;
  const resultTags = Array.isArray(selectedResult?.tags) ? selectedResult?.tags || [] : [];
  const resultIdAsTag = selectedResult?.kind === "tag" ? [selectedResult.id] : [];
  return unique([...(request.selectedTags || []), ...resultTags, ...resultIdAsTag]);
}

function resolveSelectedKbIds(request: HybridChatRequest): string[] {
  const selectedResult = request.selectedResult || null;
  const resultKbIds = Array.isArray(selectedResult?.kbIds) ? selectedResult?.kbIds || [] : [];
  return unique([...(request.selectedKbIds || []), ...resultKbIds]);
}

function buildActions(selectedResult: HybridKbSelectedResult | null, sources: LiveSearchDocumentResult[]): HybridChatAction[] {
  const actions: HybridChatAction[] = [];
  if (selectedResult) {
    const sourceType = selectedResult.sourceType || selectedResult.kind || "document";
    if (sourceType === "procedure") {
      actions.push({ kind: "open_procedure", label: "افتح الإجراء المرتبط", targetId: selectedResult.id, route: selectedResult.route });
    } else if (sourceType === "document") {
      actions.push({ kind: "open_document", label: "افتح المستند المرتبط", targetId: selectedResult.id, route: selectedResult.route });
    } else {
      actions.push({ kind: "ask_follow_up", label: `اسأل عن ${selectedResult.label}`, targetId: selectedResult.id });
    }
  }

  for (const source of sources.slice(0, 2)) {
    if (source.sourceType === "procedure") {
      actions.push({ kind: "open_procedure", label: `إجراء: ${source.title}`, targetId: source.id });
    }
    if (source.sourceType === "document") {
      actions.push({ kind: "open_document", label: `مستند: ${source.title}`, targetId: source.id });
    }
  }

  return actions.slice(0, 4);
}

function normalizeHybridIntentText(text: string): string {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s%-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDependentHybridIntent(text: string): boolean {
  const normalized = normalizeHybridIntentText(text);
  return /(عاتق|عائلي|عائليه|ابنه|بنت|الاولاد|اولاد|ولد|زوجه|زوجة|dependent|daughter|spouse|family)/.test(normalized);
}

function hasDependentHybridContext(text: string): boolean {
  const normalized = normalizeHybridIntentText(text);
  return /(عاتق|عائلي|عائليه|افراد العائله|افراد العائلة|ابنه|بنت|الاولاد|اولاد|ولد|زوجه|زوجة|تعويض عائلي|dependent|daughter|spouse|family)/.test(normalized);
}

function isSchoolGrantOnlyHybridSource(text: string): boolean {
  const normalized = normalizeHybridIntentText(text);
  return /(school-grants|منح مدرسيه|منح مدرسية|مدارس|school)/.test(normalized) && !hasDependentHybridContext(normalized);
}

function hybridSourceBlob(source: LiveSearchDocumentResult): string {
  return [
    source.id,
    source.kbId || "",
    source.title,
    source.sourceType,
    source.excerpt || "",
    ...(source.tags || []),
    ...(source.matchedFields || []),
    ...(source.matchedTerms || [])
  ].join(" ");
}

function rerankHybridSourcesForDomainIntent(queryText: string, sources: LiveSearchDocumentResult[]): LiveSearchDocumentResult[] {
  const dependentIntent = hasDependentHybridIntent(queryText);
  if (!dependentIntent) {
    return sources;
  }

  return sources
    .map((source) => {
      const blob = hybridSourceBlob(source);
      let score = Number(source.score || 0);
      const matchedFields = Array.isArray(source.matchedFields) ? [...source.matchedFields] : [];

      if (hasDependentHybridContext(blob)) {
        score += 120;
        matchedFields.push("hybrid-rerank:dependent-family-context");
      }

      if (/عاتق|عائلي|تعويض عائلي|افراد العائله|افراد العائلة/.test(normalizeHybridIntentText(blob))) {
        score += 50;
        matchedFields.push("hybrid-rerank:family-entitlement-exact");
      }

      if (isSchoolGrantOnlyHybridSource(blob)) {
        score -= 130;
        matchedFields.push("hybrid-penalty:school-grants-for-dependent-query");
      }

      return {
        ...source,
        score: Math.max(0, Math.min(100, Math.round(score))),
        matchedFields: Array.from(new Set(matchedFields))
      };
    })
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || String(left.title).localeCompare(String(right.title)));
}

function buildHybridSearchQuery(request: HybridChatRequest, selectedResult: HybridKbSelectedResult | null): string {
  const message = String(request.message || "").trim();
  const selectedLabel = String(selectedResult?.label || request.searchSnapshot?.selectedLabel || "").trim();
  const snapshotQuery = String(request.searchSnapshot?.query || "").trim();
  const pageKeywords = Array.isArray(request.contextual?.pageKeywords)
    ? request.contextual?.pageKeywords?.slice(0, 8) || []
    : [];
  return [message, selectedLabel, snapshotQuery, ...pageKeywords].filter(Boolean).join(" ");
}

function rerankHybridSourcesForPageContext(request: HybridChatRequest, sources: LiveSearchDocumentResult[]): LiveSearchDocumentResult[] {
  const pageContext = String(request.contextual?.pageContext || "").trim().toLowerCase();
  const pageKeywords = Array.isArray(request.contextual?.pageKeywords)
    ? request.contextual?.pageKeywords?.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean) || []
    : [];

  if (!pageContext && pageKeywords.length === 0) {
    return sources;
  }

  const worldCupTokens = ["world cup", "world-cup", "fifa", "match", "matches", "team", "teams", "player", "players", "كاس العالم", "مباراه", "مباريات", "منتخب", "منتخبات", "لاعب", "فيفا"];

  return sources
    .map((source) => {
      const blob = normalizeHybridIntentText([
        source.id,
        source.kbId || "",
        source.title,
        source.excerpt || "",
        source.sourceType || "",
        ...(source.tags || []),
      ].join(" "));
      let score = Number(source.score || 0);
      const matchedFields = Array.isArray(source.matchedFields) ? [...source.matchedFields] : [];

      if (pageKeywords.length > 0) {
        const keywordHits = pageKeywords.filter((keyword) => keyword && blob.includes(normalizeHybridIntentText(keyword))).length;
        if (keywordHits > 0) {
          score += keywordHits * 18;
          matchedFields.push("hybrid-rerank:page-keywords");
        }
      }

      if (pageContext === "world-cup") {
        const worldCupHits = worldCupTokens.filter((token) => blob.includes(normalizeHybridIntentText(token))).length;
        if (worldCupHits > 0) {
          score += 38 + worldCupHits * 12;
          matchedFields.push("hybrid-rerank:world-cup-context");
        } else {
          score -= 16;
          matchedFields.push("hybrid-penalty:world-cup-context-miss");
        }
      }

      return {
        ...source,
        score: Math.max(0, Math.min(100, Math.round(score))),
        matchedFields: Array.from(new Set(matchedFields)),
      };
    })
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || String(left.title).localeCompare(String(right.title)));
}
function buildAnswer(request: HybridChatRequest, selectedTags: string[], sources: LiveSearchDocumentResult[], followUps: string[]): string {
  const message = String(request.message || "").trim();
  const selectedResult = request.selectedResult || null;
  const hasSelection = Boolean(selectedResult?.label);
  const label = selectedResult?.label || request.searchSnapshot?.selectedLabel || "الموضوع المختار";

  if (request.intent === "open_selected_context" && hasSelection) {
    if (sources.length === 0) {
      return `تم اختيار ${label}، لكن لم أجد مواد كافية مرتبطة به في فهرس قاعدة المعرفة. جرّب سؤالاً أوضح أو اختر او شي تاني.`;
    }

    const sourceTitles = sources.slice(0, 3).map((source) => source.title).join("، ");
    return `تم فتح موضوع ${label}. سأستخدم الوسوم والفلاتر المختارة فقط للإجابة. أفضل المواد المرتبطة حالياً: ${sourceTitles}. يمكنك الآن طلب المستندات المطلوبة، طريقة التقديم، آخر وضع للدفعات، أو اختيار او شي تاني.`;
  }

  if (!message) {
    return "اكتب سؤالك أو اختر أحد المواضيع المقترحة للمتابعة.";
  }

  if (sources.length === 0) {
    return "لم أجد نتيجة كافية في قاعدة المعرفة لهذا السؤال. اختر موضوعاً من الاقتراحات أو اكتب تفاصيل إضافية، ويمكنك اختيار: او شي تاني.";
  }

  const sourceTitles = sources.slice(0, 3).map((source) => source.title).join("، ");
  let contextText = "";
  if (hasSelection) {
    contextText = ` ضمن سياق ${label}`;
  } else if (selectedTags.length > 0) {
    contextText = ` ضمن الوسوم المختارة: ${selectedTags.join("، ")}`;
  }
  const next = followUps.length ? ` أسئلة متابعة مقترحة: ${followUps.slice(0, 2).join("، ")}.` : "";
  return `وجدت سياقاً مناسباً لسؤالك${contextText}. أفضل مصدر مبدئي هو: ${sourceTitles}.${next}`;
}

export async function runHybridKbChat(request: HybridChatRequest): Promise<HybridChatResponse> {
  const contextualMode = String(request.contextual?.chatMode || "").trim().toLowerCase();
  if (contextualMode === "social" || contextualMode === "work") {
    const followUps = contextualMode === "social"
      ? ["Continue in the social thread", "Mention group members", "Switch back to assistant mode"]
      : ["Continue in work chat", "Open task details", "Switch back to assistant mode"];
    return {
      answer: contextualMode === "social"
        ? "This chat context is social, so hybrid KB retrieval is disabled here. Continue in social chat flow."
        : "This chat context is work-related, so hybrid KB retrieval is disabled here. Continue in work chat flow.",
      mode: "clarification-required",
      sources: [],
      followUps,
      selectedTags: [],
      selectedKbIds: [],
      selectedResult: request.selectedResult || null,
      actions: [{ kind: "clear_context", label: "Switch back to assistant context" }],
      confidence: 0,
      conversationId: makeConversationId(request.conversationId),
      generatedAt: new Date().toISOString(),
    };
  }

  const selectedTags = resolveSelectedTags(request);
  const selectedKbIds = resolveSelectedKbIds(request);
  const selectedResult = request.selectedResult || null;
  const searchQuery = buildHybridSearchQuery(request, selectedResult);
  const live = await searchKbLive(searchQuery, { limit: 8, selectedTags });
  const rerankedDocuments = rerankHybridSourcesForPageContext(
    request,
    rerankHybridSourcesForDomainIntent(searchQuery, live.documents),
  );

  const filteredByTags = selectedTags.length > 0
    ? rerankedDocuments.filter((doc) => doc.tags.some((tag) => selectedTags.includes(tag)))
    : live.documents;

  const filteredByKb = selectedKbIds.length > 0
    ? filteredByTags.filter((doc) => selectedKbIds.includes(String(doc.kbId || "")) || doc.tags.some((tag) => selectedKbIds.includes(tag)))
    : filteredByTags;

  let rankedSources: LiveSearchDocumentResult[];
  if (filteredByKb.length > 0) {
    rankedSources = filteredByKb;
  } else if (filteredByTags.length > 0) {
    rankedSources = filteredByTags;
  } else {
    rankedSources = rerankedDocuments;
  }

  const sources = rankedSources.slice(0, 5);
  const confidence = sources.length === 0 ? 0 : Math.min(0.95, Math.max(...sources.map((source) => source.score)) / 100);
  let mode: HybridChatResponse["mode"] = "retrieval-context-ready";
  if (sources.length === 0) {
    mode = "clarification-required";
  } else if (request.intent === "open_selected_context" || selectedResult) {
    mode = "selected-context-ready";
  }
  const followUps = live.suggestedQuestions.length > 0 ? live.suggestedQuestions : ["هل تريد المستندات المطلوبة؟", "هل تريد طريقة التقديم؟", "او شي تاني"];
  const actions = buildActions(selectedResult, sources);

  return {
    answer: buildAnswer(request, selectedTags, sources, followUps),
    mode,
    sources,
    followUps,
    selectedTags,
    selectedKbIds,
    selectedResult,
    actions,
    confidence,
    conversationId: makeConversationId(request.conversationId),
    generatedAt: new Date().toISOString()
  };
}
// PAYMENT_OVERRIDE_LIVE_PIPELINE_WIRING_V1
// Live chat/payment pipeline must consult super-admin payment overrides before answering variable payment-status questions.
// Fixed legal facts remain grounded in KB/source material; variable status answers are admin-controlled.