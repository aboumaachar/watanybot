import path from "node:path";
import fs from "node:fs";
import { readJsonl } from "./jsonl.js";
import { tokenize, uniq, normalizeArabic } from "./text.js";
import { DEFAULT_LEXICON } from "./lexicon.js";
import { cacheTtlMs, getDataDir, getProcedureRuntimeInfo } from "./config.js";
import type { Procedure, DocAction, DocRef, ProcToDocs, ProcedureHit, StoredDocAction, StoredDocAsset } from "./types.js";
import { countStructuredFields, getSourceLabel, isListableProcedure, presentProcedure, shouldSuppressProcedureFromCatalog } from "./presentation.js";

/* ── Internal index state ────────────────────────────── */

type IndexState = {
  at: number;
  procedures: Procedure[];
  docs: StoredDocAsset[];
  map: ProcToDocs[];
  byId: Map<string, Procedure>;
  representativeByTitle: Map<string, Procedure>;
  docsById: Map<string, StoredDocAsset>;
  docsByProc: Map<string, DocRef[]>;
  canonicalProcedureIdByAlias: Map<string, string>;
  inv: Map<string, Set<string>>;     // token → procedure IDs
  tagsInv: Map<string, Set<string>>; // tag   → procedure IDs
  lexicon: Record<string, string[]>;
};

let state: IndexState | null = null;

function normalizeProcedureKey(id: string): string {
  return String(id || "").trim().toLowerCase();
}

function setProcedureEntry<T>(map: Map<string, T>, id: string, value: T): void {
  map.set(id, value);

  const normalizedId = normalizeProcedureKey(id);
  if (normalizedId && normalizedId !== id) {
    map.set(normalizedId, value);
  }
}

function getProcedureEntry<T>(map: Map<string, T>, id: string): T | undefined {
  return map.get(id) ?? map.get(normalizeProcedureKey(id));
}

function hasProcedureDataset(candidate: string): boolean {
  const dataDir = fs.existsSync(path.join(candidate, "data"))
    ? path.join(candidate, "data")
    : candidate;

  return ["procedures.jsonl", "documents.jsonl", "procedure_to_docs.jsonl"].every((fileName) =>
    fs.existsSync(path.join(dataDir, fileName)),
  );
}

function getResolvedDataDir(root: string): string {
  const nestedDataDir = path.join(root, "data");
  return fs.existsSync(nestedDataDir) ? nestedDataDir : root;
}

function procedureTitleKey(procedure: Procedure): string {
  const presented = presentProcedure(procedure);
  return normalizeArabic(presented.title_clean || presented.title_ar || procedure.id);
}

function pickBetterProcedure(left: Procedure, right: Procedure): Procedure {
  const leftPresented = presentProcedure(left);
  const rightPresented = presentProcedure(right);
  const leftStructured = countStructuredFields(left);
  const rightStructured = countStructuredFields(right);

  if (leftStructured !== rightStructured) {
    return leftStructured >= rightStructured ? left : right;
  }

  const recordKindRank = { procedure: 4, notice: 3, reference: 2, fragment: 1 };
  const leftKindRank = recordKindRank[leftPresented.record_kind || "fragment"];
  const rightKindRank = recordKindRank[rightPresented.record_kind || "fragment"];

  if (leftKindRank !== rightKindRank) {
    return leftKindRank >= rightKindRank ? left : right;
  }

  const leftQualityRank = leftPresented.quality_flag === "clean" ? 1 : 0;
  const rightQualityRank = rightPresented.quality_flag === "clean" ? 1 : 0;
  if (leftQualityRank !== rightQualityRank) {
    return leftQualityRank >= rightQualityRank ? left : right;
  }

  const leftRelevance = leftPresented.relevance_weight || 0;
  const rightRelevance = rightPresented.relevance_weight || 0;
  if (leftRelevance !== rightRelevance) {
    return leftRelevance >= rightRelevance ? left : right;
  }

  const leftSummaryLength = (leftPresented.summary_clean || leftPresented.summary_lb || "").length;
  const rightSummaryLength = (rightPresented.summary_clean || rightPresented.summary_lb || "").length;
  return leftSummaryLength >= rightSummaryLength ? left : right;
}

function getRepresentativeProcedure(st: IndexState, procedure: Procedure): Procedure {
  const titleKey = procedureTitleKey(procedure);
  return (titleKey && st.representativeByTitle.get(titleKey)) || procedure;
}

function toDocRoute(docId: string, action: "preview" | "download"): string {
  return `/api/v2/procedures/docs/${encodeURIComponent(docId)}/${action}`;
}

function withFragment(url: string, fragment?: string | null): string {
  return fragment ? `${url}#${encodeURIComponent(fragment)}` : url;
}

function deriveDocSource(doc: StoredDocAsset): string {
  const sourceId = doc.source_refs?.[0]?.source_id?.toLowerCase() || doc.id.toLowerCase();
  if (sourceId.includes("laf")) return "laf";
  if (sourceId.includes("mof")) return "mof";
  return "other";
}

const MOF_FORM_METADATA: Record<string, { title: string; description: string }> = {
  t7: {
    title: "طلب إعادة تخصيص معاش تقاعدي - النموذج الأساسي لطلب إعادة التخصيص",
    description: "النموذج الأساسي لطلب إعادة التخصيص.",
  },
  t8: {
    title: "إقرار من مستفيد - إقرار وتعهد من المستفيد",
    description: "إقرار وتعهد من المستفيد بصحة البيانات المقدمة وبالالتزام بشروط الاستفادة.",
  },
  t9: {
    title: "شهادة أيتام وأرامل - إثبات صفة المستفيد",
    description: "شهادة تثبت صفة الأرملة أو اليتيم أو المستفيد الآخر.",
  },
};

function extractMofFormCode(doc: StoredDocAsset): string | null {
  if (deriveDocSource(doc) !== "mof") return null;

  const candidates = [doc.file_name, doc.title, doc.source_anchor];
  for (const candidate of candidates) {
    const match = String(candidate || "").match(/(?:^|\s|[-_/])(ت|t)\s*([0-9]{1,2})(?:\b|$)/i);
    if (match?.[2]) {
      return `t${match[2]}`;
    }
  }

  return null;
}

function getDocPresentation(doc: StoredDocAsset): { title: string; description: string | undefined } {
  const code = extractMofFormCode(doc);
  const metadata = code ? MOF_FORM_METADATA[code] : undefined;
  const hasGenericDescription = !doc.description_lb || doc.description_lb.includes("مرتبط بمرجع");

  return {
    title: metadata?.title || doc.title,
    description: metadata
      ? (hasGenericDescription ? metadata.description : doc.description_lb)
      : doc.description_lb,
  };
}

function buildDocAction(
  enabled: boolean,
  url: string | undefined,
  stored?: StoredDocAction,
): DocAction | undefined {
  if (!enabled && !stored) return undefined;
  return {
    enabled,
    ...(url ? { url } : {}),
    ...(stored?.mode ? { mode: stored.mode } : {}),
    ...(stored?.target ? { target: stored.target } : {}),
    ...(stored?.fragment ? { fragment: stored.fragment } : {}),
    ...(stored?.note ? { note: stored.note } : {}),
  };
}

export function mapStoredDocAssetToDocRef(doc: StoredDocAsset): DocRef {
  const fragment = doc.source_anchor || doc.preview_action?.fragment || doc.share_action?.fragment || null;
  const hasLocalLegacyUrl = Boolean(doc.url && !/^[a-z][a-z0-9+.-]*:/i.test(doc.url));
  const previewUrl = doc.public_url
    ? doc.public_url
    : (doc.preview_enabled || Boolean(doc.file_path) || hasLocalLegacyUrl)
      ? withFragment(toDocRoute(doc.id, "preview"), fragment)
      : undefined;
  const downloadUrl = doc.public_url
    ? doc.public_url
    : doc.download_enabled !== false
      ? toDocRoute(doc.id, "download")
      : undefined;
  const shareUrl = doc.public_url
    ? doc.public_url
    : previewUrl || downloadUrl;
  const primaryUrl = previewUrl || downloadUrl || shareUrl || "";
  const presentation = getDocPresentation(doc);

  return {
    id: doc.id,
    title: presentation.title,
    url: primaryUrl,
    source: deriveDocSource(doc),
    source_label: getSourceLabel(deriveDocSource(doc), doc.source_refs),
    kind: doc.asset_type,
    preview: Boolean(previewUrl),
    download: Boolean(doc.download_enabled !== false && downloadUrl),
    share: Boolean((doc.share_enabled ?? true) && shareUrl),
    preview_url: previewUrl,
    download_url: downloadUrl,
    share_url: shareUrl,
    file_format: doc.file_format,
    file_name: doc.file_name,
    description_lb: presentation.description,
    exported_file_path: doc.exported_file_path || undefined,
    asset_delivery_kind: doc.asset_delivery_kind || undefined,
    asset_delivery_note: doc.asset_delivery_note || undefined,
    source_anchor: fragment,
    link_kind: doc.link_kind || undefined,
    actions: {
      ...(buildDocAction(Boolean(previewUrl), previewUrl, doc.preview_action) ? { preview: buildDocAction(Boolean(previewUrl), previewUrl, doc.preview_action) } : {}),
      ...(buildDocAction(Boolean(doc.download_enabled !== false && downloadUrl), downloadUrl, doc.download_action) ? { download: buildDocAction(Boolean(doc.download_enabled !== false && downloadUrl), downloadUrl, doc.download_action) } : {}),
      ...(buildDocAction(Boolean((doc.share_enabled ?? true) && shareUrl), shareUrl, doc.share_action) ? { share: buildDocAction(Boolean((doc.share_enabled ?? true) && shareUrl), shareUrl, doc.share_action) } : {}),
    },
    tags: doc.tags || [],
  };
}

/* ── Helpers ─────────────────────────────────────────── */

function addInv(inv: Map<string, Set<string>>, key: string, id: string) {
  const k = normalizeArabic(key);
  if (!k) return;
  if (!inv.has(k)) inv.set(k, new Set());
  inv.get(k)?.add(id);
}

function expandQueryTokens(
  q: string,
  lexicon: Record<string, string[]>,
): string[] {
  const base = tokenize(q);
  const extra: string[] = [];
  for (const t of base) {
    for (const [canon, variants] of Object.entries(lexicon)) {
      const all = [canon, ...variants].map(normalizeArabic);
      if (all.includes(normalizeArabic(t))) {
        extra.push(normalizeArabic(canon));
        for (const v of variants) extra.push(normalizeArabic(v));
      }
    }
  }
  return uniq([...base, ...extra].filter(Boolean));
}

function hasAllTokens(haystack: string, tokens: string[]): boolean {
  return tokens.every((token) => haystack.includes(token));
}

function hasAnyToken(haystack: string, tokens: string[]): boolean {
  return tokens.some((token) => haystack.includes(token));
}

function isMedicalCardIntent(queryTokens: string[]): boolean {
  return (
    hasAnyToken(queryTokens.join(" "), ["بطاقة", "بطاقه"]) &&
    hasAnyToken(queryTokens.join(" "), ["طبابة", "طبابه", "صحة", "صحه", "صحي", "صحية", "خدمات", "صحية"])
  );
}

function isMachineLikeQuery(q: string): boolean {
  return !/[\u0600-\u06FF]/.test(q) && /[A-Za-z0-9]/.test(q);
}

function isReferenceIntentQuery(q: string, queryTokens: string[]): boolean {
  const normalizedQuery = normalizeArabic(q);
  const joinedTokens = normalizeArabic(queryTokens.join(" "));
  const referenceSignals = [
    "رابط",
    "روابط",
    "لينك",
    "لينكات",
    "مرجع",
    "مراجع",
    "reference",
    "references",
    "link",
    "links",
    "url",
    "urls",
    "source",
    "sources",
  ];

  return referenceSignals.some((signal) => normalizedQuery.includes(signal) || joinedTokens.includes(signal));
}

function isFragmentIntentQuery(q: string, queryTokens: string[]): boolean {
  const normalizedQuery = normalizeArabic(q);
  const joinedTokens = normalizeArabic(queryTokens.join(" "));
  const fragmentSignals = [
    "الفصل",
    "الباب",
    "القسم",
    "المادة",
    "دوام",
    "اوقات",
    "أوقات",
    "ساعات",
    "جدول",
    "مليون",
  ];

  return fragmentSignals.some((signal) => normalizedQuery.includes(signal) || joinedTokens.includes(signal));
}

function isNoticeIntentQuery(q: string, queryTokens: string[]): boolean {
  const normalizedQuery = normalizeArabic(q);
  const joinedTokens = normalizeArabic(queryTokens.join(" "));
  const noticeSignals = [
    "هاتف",
    "هواتف",
    "اتصال",
    "استعلامات",
    "دوام",
    "اوقات",
    "أوقات",
    "ساعات",
    "رسوم",
    "طابع",
    "طوابع",
    "إيجاز",
    "ايجاز",
  ];

  return noticeSignals.some((signal) => normalizedQuery.includes(signal) || joinedTokens.includes(signal));
}

function hasExactQueryMatch(q: string, p: Procedure): boolean {
  const normalizedQuery = normalizeArabic(q);
  if (!normalizedQuery) return false;

  const combined = normalizeArabic(
    [
      p.id,
      p.tx_no,
      p.title_ar,
      p.summary_lb,
      ...(p.requirements || []),
      ...(p.steps || []),
      ...(p.where_to_apply || []),
      ...(p.faq_variants || []),
      ...(p.tags || []),
      ...(p.eligibility || []),
    ].join(" "),
  );

  return combined.includes(normalizedQuery);
}

function addWeightedHits(
  scores: Map<string, number>,
  tokens: string[],
  index: Map<string, Set<string>>,
  weight: number,
): void {
  for (const token of tokens) {
    const hits = index.get(normalizeArabic(token));
    if (!hits) continue;
    for (const id of hits) {
      scores.set(id, (scores.get(id) || 0) + weight);
    }
  }
}

function rankProcedureHit(
  q: string,
  qTokens: string[],
  machineLikeQuery: boolean,
  st: IndexState,
  candidate: [string, number],
): ProcedureHit | null {
  const [id, score] = candidate;
  const procedure = st.byId.get(id);
  if (!procedure) return null;
  if (machineLikeQuery && !hasExactQueryMatch(q, procedure)) return null;

  const representative = getRepresentativeProcedure(st, procedure);

  if (machineLikeQuery && !hasExactQueryMatch(q, representative) && !hasExactQueryMatch(q, procedure)) {
    return null;
  }

  const presented = presentProcedure(representative);

  if (!isListableProcedure(representative)) {
    return null;
  }

  return {
    id: presented.id,
    title_ar: presented.title_ar,
    summary_lb: presented.summary_lb,
    steps: (presented.steps || []).filter(Boolean),
    title_clean: presented.title_clean,
    summary_clean: presented.summary_clean,
    tags: procedure.tags || [],
    source: presented.source,
    source_label: presented.source_label,
    source_anchors: presented.source_anchors || [],
    section_path: presented.section_path,
    section_label: presented.section_label,
    record_kind: presented.record_kind,
    quality_flag: presented.quality_flag,
    audience_scope: presented.audience_scope,
    applies_to: presented.applies_to,
    content_tier: presented.content_tier,
    domain: presented.domain,
    relevance_weight: presented.relevance_weight,
    score: score + scorePhraseBoost(q, qTokens, representative) + (presented.relevance_weight || 0),
  };
}

function sortCandidates(scores: Map<string, number>): Array<[string, number]> {
  return Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
}

function procedureHitDedupKey(hit: ProcedureHit): string {
  return normalizeArabic(hit.title_clean || hit.title_ar || hit.id);
}

function hasDirectSearchEvidence(hit: ProcedureHit, queryTokens: string[]): boolean {
  const title = normalizeArabic(hit.title_clean || hit.title_ar || "");
  const summary = normalizeArabic(hit.summary_clean || hit.summary_lb || "");
  const tags = normalizeArabic((hit.tags || []).join(" "));
  const appliesTo = normalizeArabic((hit.applies_to || []).join(" "));
  const domain = normalizeArabic(hit.domain || "");
  const combined = [title, summary, tags, appliesTo, domain].filter(Boolean).join(" ");

  return queryTokens.some((token) => {
    const normalizedToken = normalizeArabic(token);
    return Boolean(normalizedToken && combined.includes(normalizedToken));
  });
}

function filterWeakProcedureHits(items: ProcedureHit[], queryTokens: string[]): ProcedureHit[] {
  return items.filter((item) => item.score >= 3 || hasDirectSearchEvidence(item, queryTokens));
}

function dedupeProcedureHits(items: ProcedureHit[]): ProcedureHit[] {
  const seen = new Set<string>();
  const unique: ProcedureHit[] = [];

  for (const item of items) {
    const key = procedureHitDedupKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function orderProcedureHits(
  rankedResults: ProcedureHit[],
  explicitReferenceIntent: boolean,
  explicitNoticeIntent: boolean,
  explicitFragmentIntent: boolean,
): ProcedureHit[] {
  const procedureResults = rankedResults.filter((item) => item.record_kind === "procedure");
  const noticeResults = rankedResults.filter((item) => item.record_kind === "notice");
  const referenceResults = rankedResults.filter((item) => item.record_kind === "reference");
  const fragmentResults = rankedResults.filter((item) => item.record_kind === "fragment");

  if (explicitFragmentIntent) {
    return [...fragmentResults, ...noticeResults, ...procedureResults, ...referenceResults];
  }

  if (explicitReferenceIntent) {
    return [...referenceResults, ...procedureResults, ...noticeResults, ...fragmentResults];
  }

  if (explicitNoticeIntent) {
    return [...noticeResults, ...procedureResults, ...referenceResults, ...fragmentResults];
  }

  return [...procedureResults, ...noticeResults, ...referenceResults, ...fragmentResults];
}

function scorePhraseBoost(q: string, qTokens: string[], p: Procedure): number {
  const normalizedQuery = normalizeArabic(q);
  const title = normalizeArabic(p.title_ar || "");
  const summary = normalizeArabic(p.summary_lb || "");
  const faq = normalizeArabic((p.faq_variants || []).join(" "));
  const tags = normalizeArabic((p.tags || []).join(" "));
  const combined = [title, summary, faq, tags].filter(Boolean).join(" ");

  let boost = 0;

  if (normalizedQuery && title.includes(normalizedQuery)) {
    boost += 10;
  } else if (normalizedQuery && combined.includes(normalizedQuery)) {
    boost += 6;
  }

  if (qTokens.length > 1 && hasAllTokens(title, qTokens)) {
    boost += 6;
  } else if (qTokens.length > 1 && hasAllTokens(combined, qTokens)) {
    boost += 3;
  }

  if (isMedicalCardIntent(qTokens)) {
    const medicalSignals = [
      "طبابة",
      "طبابه",
      "صحي",
      "صحية",
      "خدمات الطبابة",
      "health_medical",
      "medical_assistance",
      "medical",
    ];

    if (hasAnyToken(title, medicalSignals)) {
      boost += 10;
    } else if (hasAnyToken(combined, medicalSignals)) {
      boost += 6;
    }
  }

  return boost;
}

/* ── Load helpers ────────────────────────────────────── */

function loadLexicon(lexiconPath: string): Record<string, string[]> {
  let lexicon = { ...DEFAULT_LEXICON };
  if (fs.existsSync(lexiconPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(lexiconPath, "utf-8"));
      if (parsed && typeof parsed === "object") lexicon = { ...lexicon, ...parsed };
    } catch {
      // keep default
    }
  }
  return lexicon;
}

function buildDocsByProc(
  map: ProcToDocs[],
  docsById: Map<string, StoredDocAsset>,
): Map<string, DocRef[]> {
  const docsByProc = new Map<string, DocRef[]>();
  for (const m of map) {
    const arr: DocRef[] = [];
    for (const docId of m.doc_ids || []) {
      const d = docsById.get(docId);
      if (d) arr.push(mapStoredDocAssetToDocRef(d));
    }
    setProcedureEntry(docsByProc, m.procedure_id, arr);
  }
  return docsByProc;
}

function getAttachmentOverlayDataDir(currentDataDir: string): string | null {
  const runtime = getProcedureRuntimeInfo();
  if (runtime.source === "kb_studio_export" || runtime.source === "payload_sync") {
    return null;
  }

  const candidates = [
    process.env.KB_STUDIO_EXPORT_ROOT,
    path.resolve(currentDataDir, "..", "..", "kb_studio", "runtime", "exports", "watanybot"),
    path.resolve(currentDataDir, "..", "..", "..", "kb-studio", "watany", "runtime", "exports", "watanybot"),
    path.resolve(currentDataDir, "..", "..", "..", "kb-studio", "runtime", "exports", "watanybot"),
  ];

  const normalizedCurrentDataDir = path.normalize(currentDataDir);
  for (const candidate of candidates) {
    if (!candidate || !hasProcedureDataset(candidate)) continue;
    const resolvedDataDir = getResolvedDataDir(candidate);
    if (path.normalize(resolvedDataDir) === normalizedCurrentDataDir) continue;
    return resolvedDataDir;
  }

  return null;
}

function shouldOverlayExportDoc(doc: StoredDocAsset): boolean {
  return deriveDocSource(doc) !== "other";
}

async function mergeMissingReferenceDocs(baseDocs: StoredDocAsset[], currentDataDir: string): Promise<StoredDocAsset[]> {
  const overlayDataDir = getAttachmentOverlayDataDir(currentDataDir);
  if (!overlayDataDir) {
    return baseDocs;
  }

  const existingDocIds = new Set(baseDocs.map((doc) => normalizeProcedureKey(doc.id)));
  const overlayDocs = await readJsonl<StoredDocAsset>(path.join(overlayDataDir, "documents.jsonl"));
  const missingDocs = overlayDocs.filter((doc) => {
    const normalizedDocId = normalizeProcedureKey(doc.id);
    return normalizedDocId && shouldOverlayExportDoc(doc) && !existingDocIds.has(normalizedDocId);
  });

  return missingDocs.length > 0 ? [...baseDocs, ...missingDocs] : baseDocs;
}

function buildProcedureAliasMap(
  byId: Map<string, Procedure>,
  docsById: Map<string, StoredDocAsset>,
  map: ProcToDocs[],
): Map<string, string> {
  const canonicalProcedureIdByAlias = new Map<string, string>();

  const registerAlias = (alias: string | undefined, canonicalProcedureId: string | undefined): void => {
    const normalizedAlias = normalizeProcedureKey(alias || "");
    const normalizedCanonicalProcedureId = normalizeProcedureKey(canonicalProcedureId || "");
    if (!normalizedAlias || !normalizedCanonicalProcedureId || canonicalProcedureIdByAlias.has(normalizedAlias)) {
      return;
    }
    canonicalProcedureIdByAlias.set(normalizedAlias, normalizedCanonicalProcedureId);
  };

  for (const relation of map) {
    const canonicalProcedure = getProcedureEntry(byId, relation.procedure_id);
    const canonicalProcedureId = canonicalProcedure?.id || normalizeProcedureKey(relation.procedure_id);
    for (const docId of relation.doc_ids || []) {
      registerAlias(docId, canonicalProcedureId);
    }
  }

  for (const doc of docsById.values()) {
    const linkedProcedureId = (doc.linked_procedures || [])
      .map((procedureId) => getProcedureEntry(byId, procedureId)?.id || normalizeProcedureKey(procedureId))
      .find(Boolean);

    registerAlias(doc.id, linkedProcedureId);
  }

  return canonicalProcedureIdByAlias;
}

function resolveProcedureIdInState(st: IndexState, id: string): string | null {
  const procedure = getProcedureEntry(st.byId, id);
  if (procedure) {
    return normalizeProcedureKey(procedure.id);
  }

  const normalizedId = normalizeProcedureKey(id);
  if (!normalizedId) {
    return null;
  }

  return st.canonicalProcedureIdByAlias.get(normalizedId) || null;
}

function buildInvertedIndexes(procedures: Procedure[]) {
  const inv = new Map<string, Set<string>>();
  const tagsInv = new Map<string, Set<string>>();

  for (const p of procedures) {
    if (shouldSuppressProcedureFromCatalog(p)) continue;

    const blob = [
      p.title_ar,
      p.summary_lb,
      ...(p.requirements || []),
      ...(p.steps || []),
      ...(p.where_to_apply || []),
      ...(p.faq_variants || []),
      ...(p.tags || []),
      ...(p.eligibility || []),
    ].join(" ");

    const toks = uniq(tokenize(blob));
    for (const t of toks) addInv(inv, t, p.id);
    for (const tag of p.tags || []) addInv(tagsInv, tag, p.id);
  }
  return { inv, tagsInv };
}

/* ── Load / refresh ──────────────────────────────────── */

export async function loadIndex(force = false): Promise<IndexState> {
  const ttl = cacheTtlMs();
  if (!force && state && Date.now() - state.at < ttl) return state;

  const dataDir = getDataDir();
  const procedures = await readJsonl<Procedure>(path.join(dataDir, "procedures.jsonl"));
  const docs = await mergeMissingReferenceDocs(
    await readJsonl<StoredDocAsset>(path.join(dataDir, "documents.jsonl")),
    dataDir,
  );
  const map = await readJsonl<ProcToDocs>(path.join(dataDir, "procedure_to_docs.jsonl"));

  const lexicon = loadLexicon(path.join(dataDir, "tags_lexicon.json"));

  const byId = new Map<string, Procedure>();
  for (const p of procedures) setProcedureEntry(byId, p.id, p);

  const representativeByTitle = new Map<string, Procedure>();
  for (const procedure of procedures) {
    if (shouldSuppressProcedureFromCatalog(procedure)) continue;

    const titleKey = procedureTitleKey(procedure);
    const current = representativeByTitle.get(titleKey);
    representativeByTitle.set(titleKey, current ? pickBetterProcedure(current, procedure) : procedure);
  }

  const docsById = new Map<string, StoredDocAsset>();
  for (const d of docs) setProcedureEntry(docsById, d.id, d);

  const docsByProc = buildDocsByProc(map, docsById);
  const canonicalProcedureIdByAlias = buildProcedureAliasMap(byId, docsById, map);
  const { inv, tagsInv } = buildInvertedIndexes(procedures);

  state = {
    at: Date.now(),
    procedures,
    docs,
    map,
    byId,
    representativeByTitle,
    docsById,
    docsByProc,
    canonicalProcedureIdByAlias,
    inv,
    tagsInv,
    lexicon,
  };
  return state;
}

/* ── Search ──────────────────────────────────────────── */

export async function searchProcedures(
  q: string,
  limit = 20,
): Promise<ProcedureHit[]> {
  const st = await loadIndex(false);
  const qTokens = expandQueryTokens(q, st.lexicon);
  const baseTokens = tokenize(q);
  const machineLikeQuery = isMachineLikeQuery(q);
  const explicitReferenceIntent = isReferenceIntentQuery(q, qTokens);
  const explicitNoticeIntent = isNoticeIntentQuery(q, qTokens);
  const explicitFragmentIntent = isFragmentIntentQuery(q, qTokens);

  const scores = new Map<string, number>();

  addWeightedHits(scores, qTokens, st.inv, 2);
  addWeightedHits(scores, qTokens, st.tagsInv, 3);

  const rankedResults = sortCandidates(scores)
    .map((candidate) => rankProcedureHit(q, baseTokens, machineLikeQuery, st, candidate))
    .filter((item): item is ProcedureHit => item !== null)
    .sort((a, b) => b.score - a.score);

  const orderedResults = orderProcedureHits(
    rankedResults,
    explicitReferenceIntent,
    explicitNoticeIntent,
    explicitFragmentIntent,
  );

  const results = dedupeProcedureHits(filterWeakProcedureHits(orderedResults, baseTokens))
    .filter((item) => {
      const procedure = getProcedureEntry(st.byId, item.id);
      if (!procedure) return true;
      return isListableProcedure(procedure);
    })
    .slice(0, limit);

  return results;
}

/* ── Single procedure ────────────────────────────────── */

export async function getProcedure(id: string): Promise<Procedure | null> {
  const st = await loadIndex(false);
  const resolvedProcedureId = resolveProcedureIdInState(st, id);
  return resolvedProcedureId ? getProcedureEntry(st.byId, resolvedProcedureId) || null : null;
}

export async function getProcedureByTitle(title: string): Promise<Procedure | null> {
  const st = await loadIndex(false);
  return st.representativeByTitle.get(normalizeArabic(title)) || null;
}

/* ── Related docs ────────────────────────────────────── */

export async function getProcedureDocs(id: string): Promise<DocRef[]> {
  const st = await loadIndex(false);
  const resolvedProcedureId = resolveProcedureIdInState(st, id);
  return resolvedProcedureId ? getProcedureEntry(st.docsByProc, resolvedProcedureId) || [] : [];
}

export async function getProcedureDoc(id: string): Promise<StoredDocAsset | null> {
  const st = await loadIndex(false);
  return getProcedureEntry(st.docsById, id) || null;
}

export async function resolveProcedureId(id: string): Promise<string | null> {
  const st = await loadIndex(false);
  return resolveProcedureIdInState(st, id);
}

/* ── Stats ───────────────────────────────────────────── */

export async function getStats() {
  const st = await loadIndex(false);
  return {
    procedures: st.procedures.length,
    documents: st.docs.length,
    mappings: st.map.length,
    tokens: st.inv.size,
    tags: st.tagsInv.size,
  };
}

/* ── Force reload ────────────────────────────────────── */

export async function reloadIndex() {
  await loadIndex(true);
  return getStats();
}
