import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac.js";
import path from "node:path";
import fs, { createReadStream } from "node:fs";
import mammoth from "mammoth";
import {
  searchProcedures,
  getProcedure,
  getProcedureDocs,
  getProcedureDoc,
  reloadIndex,
  getStats,
  loadIndex,
  resolveProcedureId,
} from "./indexer.js";
import { getFlowText } from "./flows.js";
import { readJsonl } from "./jsonl.js";
import { normalizeArabic } from "./text.js";
import type { ProcToDocs, Procedure, SourceRef, StoredDocAsset } from "./types.js";
import { getDataDir, getDocsDir, getKbRoot } from "./config.js";
import { countStructuredFields, isListableProcedure, presentProcedure } from "./presentation.js";

const DOC_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

const IMAGE_PREVIEW_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

function buildContentDispositionFilename(fileName: string): string {
  const baseName = path.basename(fileName).replace(/[\r\n"]/g, " ").trim() || "download";
  const asciiFallback = baseName
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/\s+/g, " ")
    .trim() || "download";
  const encodedFileName = encodeURIComponent(baseName)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFileName}`;
}

function isAbsoluteExistingFile(candidate?: string | null): candidate is string {
  return Boolean(candidate && path.isAbsolute(candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

function uniquePaths(candidates: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = path.normalize(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizeAdminProcedureId(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeAdminDocIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .map((value) => String(value || "").trim())
    .filter(Boolean)));
}

function getProcedureDocsLinksPath(): string {
  return path.join(getDataDir(), "procedure_to_docs.jsonl");
}

async function readProcedureDocsLinks(): Promise<ProcToDocs[]> {
  const filePath = getProcedureDocsLinksPath();
  if (!fs.existsSync(filePath)) return [];
  return readJsonl<ProcToDocs>(filePath);
}

function writeProcedureDocsLinks(rows: ProcToDocs[]): void {
  const filePath = getProcedureDocsLinksPath();
  const content = rows
    .map((row) => ({
      ...row,
      procedure_id: String(row.procedure_id || "").trim(),
      doc_ids: normalizeAdminDocIds(row.doc_ids),
    }))
    .filter((row) => row.procedure_id && row.doc_ids.length > 0)
    .sort((left, right) => left.procedure_id.localeCompare(right.procedure_id, "en"))
    .map((row) => JSON.stringify(row))
    .join("\n");

  fs.writeFileSync(filePath, content ? `${content}\n` : "", "utf-8");
}

function sourceRefPaths(doc: StoredDocAsset): string[] {
  const refs = doc.source_refs || [];
  const candidates: Array<string | null> = [];
  for (const ref of refs as SourceRef[]) {
    const sourcePath = ref.source_path;
    if (!sourcePath) continue;
    candidates.push(sourcePath);
    if (doc.file_path) {
      candidates.push(path.join(path.dirname(sourcePath), doc.file_path));
    }
  }
  return uniquePaths(candidates);
}

function actionTargetPaths(doc: StoredDocAsset): string[] {
  const candidates: Array<string | null> = [];
  for (const action of [doc.preview_action, doc.download_action, doc.share_action]) {
    const target = action?.target;
    if (typeof target === "string" && target.trim()) {
      candidates.push(target.trim());
    }
  }
  return uniquePaths(candidates);
}

function mofPublicAssetPaths(doc: StoredDocAsset): string[] {
  const identity = `${doc.title || ""} ${doc.file_name || ""}`;
  const idMatch = doc.id.match(/DOC-WATANY_MOF_HTML-000([6-8])$/i);
  if (!idMatch && deriveReferenceSourceId(doc) !== "mof") return [];
  const code = idMatch ? String(Number(idMatch[1]) - 0) : identity.match(/(?:^|\s|[-_/])(ت|t)\s*([789])/i)?.[2];
  if (!code) return [];

  const fileName = `t${code === "6" ? "7" : code === "7" ? "8" : "9"}-original.jpg`;
  const kbRoot = getKbRoot();
  return uniquePaths([
    path.resolve(__dirname, "..", "..", "..", "..", "apps", "web-user", "public", "mof", fileName),
    path.resolve(process.cwd(), "apps", "web-user", "public", "mof", fileName),
    path.resolve(process.cwd(), "..", "web-user", "public", "mof", fileName),
    path.resolve(kbRoot, "..", "apps", "web-user", "public", "mof", fileName),
    path.resolve(kbRoot, "..", "..", "apps", "web-user", "public", "mof", fileName),
  ]);
}

function referenceAttachmentPaths(doc: StoredDocAsset): string[] {
  const sourceId = deriveReferenceSourceId(doc);
  const fileName = doc.file_name ? path.basename(doc.file_name) : "";
  if (!sourceId || !fileName) return [];

  const kbRoot = getKbRoot();
  const proceduresFolder = sourceId === "laf" ? "01_laf" : "02_mof";

  return uniquePaths([
    path.resolve(kbRoot, "..", "watany_kb", "docs", "03_procedures", proceduresFolder, fileName),
    path.resolve(kbRoot, "..", "..", "..", "..", "watany_kb", "docs", "03_procedures", proceduresFolder, fileName),
    path.resolve(kbRoot, "..", "..", "..", "..", "..", "watanybot", "watany_kb", "docs", "03_procedures", proceduresFolder, fileName),
  ]);
}

function docCandidates(doc: StoredDocAsset): string[] {
  const dataDir = getDataDir();
  const kbRoot = getKbRoot();
  const filePath = doc.file_path || undefined;
  const exportedFilePath = doc.exported_file_path || undefined;
  const legacyUrlPath = doc.url && !/^[a-z][a-z0-9+.-]*:/i.test(doc.url) ? doc.url.replace(/^\/+/, "") : undefined;
  const attachmentPaths = referenceAttachmentPaths(doc);

  return uniquePaths([
    ...attachmentPaths,
    doc.resolved_path,
    filePath,
    legacyUrlPath ? path.join(dataDir, legacyUrlPath) : null,
    legacyUrlPath ? path.resolve(process.cwd(), "apps", "gateway-api", "data", legacyUrlPath) : null,
    legacyUrlPath ? path.resolve(getKbRoot(), "..", "apps", "gateway-api", "data", legacyUrlPath) : null,
    legacyUrlPath?.startsWith("kb/") ? path.join(getKbRoot(), legacyUrlPath.slice(3)) : null,
    filePath ? path.join(kbRoot, "docs", filePath) : null,
    filePath ? path.join(kbRoot, filePath) : null,
    filePath ? path.join(dataDir, "docs", filePath) : null,
    filePath ? path.join(dataDir, filePath) : null,
    exportedFilePath ? path.join(kbRoot, "docs", exportedFilePath) : null,
    exportedFilePath ? path.join(dataDir, "docs", exportedFilePath) : null,
    ...actionTargetPaths(doc),
    ...mofPublicAssetPaths(doc),
    ...sourceRefPaths(doc),
  ]);
}

function findDocFile(doc: StoredDocAsset): string | null {
  const candidates = docCandidates(doc);
  for (const candidate of candidates) {
    if (isAbsoluteExistingFile(candidate)) return candidate;
  }
  return null;
}

function procedureSampleKey(item: { title_clean?: string; title_ar?: string }): string {
  return normalizeArabic(item.title_clean || item.title_ar || "");
}

function pushUniqueProcedureSample<T extends { title_clean?: string; title_ar?: string }>(items: T[], item: T, maxItems: number): void {
  if (items.length >= maxItems) return;
  const key = procedureSampleKey(item);
  if (!key) return;
  if (items.some((existing) => procedureSampleKey(existing) === key)) return;
  items.push(item);
}

function isLowValueProcedureSampleTitle(title?: string): boolean {
  const normalized = normalizeArabic(title || "");
  if (!normalized) return true;
  if (/^\d+$/u.test(normalized)) return true;
  if (!/[\p{Script=Arabic}]/u.test(title || "") && /^[\dA-Za-z\s]+$/u.test(title || "")) return true;
  if (/^[\d\u0660-\u0669A-Za-z\s]+$/u.test(title || "") && !/[\p{Script=Arabic}]/u.test(title || "")) return true;
  if (normalized.length <= 2) return true;
  return false;
}

function procedureKindSortWeight(kind: "procedure" | "reference" | "notice" | "fragment"): number {
  switch (kind) {
    case "procedure":
      return 0;
    case "notice":
      return 1;
    case "reference":
      return 2;
    case "fragment":
      return 3;
    default:
      return 9;
  }
}

// Authority-level priority scores (higher = shown first)
const SOURCE_VETERAN_PRIORITY: Record<string, number> = {
  mof: 100,        // دائرة التقاعد
  procedures: 90,  // الشؤون
  laf: 80,         // قيادة الجيش
  isf: 70,         // قوى الأمن الداخلي
  rabita: 60,      // رابطة قدماء القوى المسلحة
  other: 10,       // جهات اخرى
};

const AUTHORITY_SOURCE_META: Record<string, { title: string; basis: string }> = {
  mof: { title: "دائرة التقاعد", basis: "استناداً إلى mof.html" },
  procedures: { title: "الشؤون", basis: "إجراءات الشؤون المعتمدة" },
  laf: { title: "قيادة الجيش", basis: "استناداً إلى laf.html" },
  isf: { title: "قوى الأمن الداخلي", basis: "إجراءات متقاعدي قوى الأمن الداخلي" },
  rabita: { title: "الرابطة", basis: "رابطة قدماء القوى المسلحة" },
  other: { title: "مصادر اخرى", basis: "إجراءات مرجعية خارج التصنيف الأساسي" },
};

const MOF_STRICT_AUTHORITY_TERMS = [
  "دائرة التقاعد", "وزارة المالية", "المديرية العامة للشؤون المالية", "mof", "mo f",
  "مصلحة معاشات التقاعد", "قسم معاشات التقاعد",
];
const MOF_WEAK_CONTEXT_TERMS = [
  "معاش", "تقاعد", "دفتر التقاعد", "راتب", "رواتب", "تعويض", "صرف", "قيمة المنحة", "مساعدة وفاة", "مساعدة ولادة",
];
const SHOON_AUTHORITY_TERMS = [
  "الشؤون", "قسم الشؤون", "الخدمات الاجتماعية", "بطاقة الخدمات", "على العاتق", "طبابة", "سجل صحي",
  "مساعدات مرضية", "إخراج قيد", "اخراج قيد", "الزوجة", "الابنة", "الابن", "الوالدين", "مولود",
  "مدرسية", "جامعة", "وفاة العسكري المتقاعد", "العاتق", "على العهدة", "اضافة الابنة", "إضافة الابنة",
];
const LAF_AUTHORITY_TERMS = [
  "قيادة الجيش", "laf", "كلية حربية", "مدرسة الرتباء", "تطويع", "ثكنة", "ثكنات", "عقار", "قواعد جوية",
  "حفظ أمن", "حفظ امن", "الغام", "ألغام", "طيران", "زورق", "طوافة", "vsat", "مشروع إنمائي",
  "مشروع انمائي", "ندوات", "محاضرات", "حفل", "عناصر موسيقية", "رياضيين عسكريين", "بحث أكاديمي",
  "بحث اكاديمي", "تقرير طبيب شرعي", "كف بحث", "شطب إسم مطلوب", "شطب اسم مطلوب",
];
const ISF_AUTHORITY_TERMS = [
  "قوى الأمن الداخلي", "قوى الامن الداخلي", "الأمن الداخلي", "الامن الداخلي", "isf", "مخفر", "المركز الطبي",
  "البطاقة الصحية", "المساعدات المرضية", "رجال قوى الأمن", "متقاعدي الأمن الداخلي", "متقاعدي الامن الداخلي",
];
const RABITA_AUTHORITY_TERMS = [
  "رابطة قدماء القوى المسلحة", "الرابطة", "قدماء القوى المسلحة", "قدماء", "تاريخ التطوع", "تاريخ التسريح",
];

function includesAnyNormalized(haystack: string, values: string[]): boolean {
  return values.some((value) => haystack.includes(normalizeArabic(value)));
}

type AuthoritySourceId = "mof" | "procedures" | "laf" | "isf" | "rabita" | "other";

type AuthoritySourceProcedure = {
  source?: string;
  source_label?: string;
  section_label?: string;
  title_ar?: string;
  summary_lb?: string;
  tags?: string[];
  applies_to?: string[];
  domain?: string;
  source_anchors?: Array<{ file?: string; anchor?: string }>;
  source_refs?: SourceRef[];
};

function buildAuthorityHaystack(procedure: AuthoritySourceProcedure): string {
  return normalizeArabic([
    procedure.source_label || "",
    procedure.section_label || "",
    procedure.title_ar || "",
    procedure.summary_lb || "",
    procedure.domain || "",
    ...(procedure.tags || []),
    ...(procedure.applies_to || []),
  ].join(" "));
}

function getAuthorityScores(procedure: AuthoritySourceProcedure, haystack: string) {
  const domain = String(procedure.domain || "").trim().toLowerCase();
  const hasStrictMofSignal = includesAnyNormalized(haystack, MOF_STRICT_AUTHORITY_TERMS);
  const scores = {
    mof: (hasStrictMofSignal ? 6 : 0) + (includesAnyNormalized(haystack, MOF_WEAK_CONTEXT_TERMS) ? 1 : 0),
    procedures: includesAnyNormalized(haystack, SHOON_AUTHORITY_TERMS) ? 4 : 0,
    laf: includesAnyNormalized(haystack, LAF_AUTHORITY_TERMS) ? 4 : 0,
    isf: includesAnyNormalized(haystack, ISF_AUTHORITY_TERMS) ? 5 : 0,
    rabita: includesAnyNormalized(haystack, RABITA_AUTHORITY_TERMS) ? 5 : 0,
  };

  if (["pension", "financial"].includes(domain)) scores.mof += 1;
  if (["family_status", "medical", "service_card", "schooling"].includes(domain)) scores.procedures += 3;
  if (["army", "defense", "security", "public_service"].includes(domain)) scores.laf += 3;
  if (domain === "death_inheritance") {
    if (haystack.includes(normalizeArabic("معاش")) || haystack.includes(normalizeArabic("تقاعد"))) {
      scores.mof += 1;
    } else {
      scores.procedures += 2;
    }
  }

  return { scores, hasStrictMofSignal };
}

function hasSourceAnchor(procedure: AuthoritySourceProcedure, sourceFileName: string): boolean {
  const expected = sourceFileName.toLowerCase();
  return (procedure.source_anchors || []).some((anchor) => String(anchor.file || "").toLowerCase().replace(/\\/g, "/").endsWith(`/${expected}`));
}

function hasProceduresDocumentSource(procedure: AuthoritySourceProcedure): boolean {
  return hasSourceAnchor(procedure, "procedures.docx")
    || hasSourceAnchor(procedure, "procedures.doc")
    || hasSourceAnchor(procedure, "daleel.docx")
    || hasSourceAnchor(procedure, "daleel.doc");
}

function hasSourceRef(procedure: AuthoritySourceProcedure, sourceId: string): boolean {
  const expected = sourceId.toLowerCase();
  return (procedure.source_refs || []).some((ref) => String(ref.source_id || "").toLowerCase().includes(expected));
}

function hasMofSource(procedure: AuthoritySourceProcedure): boolean {
  return String(procedure.source || "").trim().toLowerCase() === "mof"
    || hasSourceAnchor(procedure, "mof.html")
    || hasSourceRef(procedure, "mof");
}

function hasLafSource(procedure: AuthoritySourceProcedure): boolean {
  return String(procedure.source || "").trim().toLowerCase() === "laf"
    || hasSourceAnchor(procedure, "laf.html")
    || hasSourceRef(procedure, "laf");
}

function bestAdministrativeSource(scores: { procedures: number; laf: number }): AuthoritySourceId | null {
  if (scores.laf >= scores.procedures && scores.laf >= 3) return "laf";
  if (scores.procedures >= 3) return "procedures";
  return null;
}

function inferAuthoritySourceId(procedure: {
  source?: string;
  source_label?: string;
  section_label?: string;
  title_ar?: string;
  summary_lb?: string;
  tags?: string[];
  applies_to?: string[];
  domain?: string;
}): AuthoritySourceId {
  const source = String(procedure.source || "").trim().toLowerCase();
  if (source === "isf" || source === "rabita") {
    return source;
  }

  if (hasLafSource(procedure)) return "laf";

  const haystack = buildAuthorityHaystack(procedure);
  const { scores, hasStrictMofSignal } = getAuthorityScores(procedure, haystack);

  if (scores.rabita > 0) return "rabita";
  if (scores.isf > 0) return "isf";
  if (hasMofSource(procedure)) return "mof";

  const administrativeSource = bestAdministrativeSource(scores);
  if (administrativeSource) return administrativeSource;

  if (hasStrictMofSignal || (source === "mof" && scores.mof > 0)) return "mof";

  // Guide procedures that do not map clearly to MOF/LAF/SHOON are treated as "other".
  if (source === "procedures") return "other";

  return "other";
}

function mapProcedureToAuthorityBucket(procedure: AuthoritySourceProcedure): { id: string; title: string } {
  const sourceId = inferAuthoritySourceId(procedure);
  return { id: sourceId, title: AUTHORITY_SOURCE_META[sourceId].title };
}

function isIrrelevantLegalGovernanceListing(procedure: {
  source?: string;
  title_ar?: string;
  summary_lb?: string;
  tags?: string[];
}): boolean {
  const haystack = [
    procedure.title_ar || "",
    procedure.summary_lb || "",
    ...(procedure.tags || []),
  ].join(" ").toLowerCase();

  // Exclude legal/governance catalog fragments that are not actionable veteran procedures.
  if (
    haystack.includes("ممثل عن ارباب العمل")
    || haystack.includes("ممثل عن الاجراء")
    || haystack.includes("ينشأ مجلس اعلى للدفاع")
    || haystack.includes("رئيس الجمهورية")
    || haystack.includes("رئيس الوزراء")
    || haystack.includes("وزير الدفاع")
    || haystack.includes("قانون العمل")
    || haystack.includes("العماد قائد الجيش")
    || haystack.includes("exercer la profession")
    || haystack.includes("يقطع نهائيا حق المتقاعد")
    || haystack.includes("يقطع نهائياً حق المتقاعد")
    || haystack.includes("انتهاء الخدمة - المادة")
    || haystack.includes("الحالات التي تنتهي فيها الخدمة")
    || haystack.includes("دقيقة (كلام)")
  ) {
    return true;
  }

  return false;
}

function getGuideDocumentBoost(procedure: {
  source?: string;
  section_label?: string;
  section_path?: string[];
}): number {
  const source = String(procedure.source || "").trim().toLowerCase();
  const sectionText = [procedure.section_label || "", ...(procedure.section_path || [])].join(" ").toLowerCase();

  // Give utmost weight to procedures listed in "الدليل" source document.
  if (source === "procedures") {
    return 500;
  }

  if (sectionText.includes("الدليل") || sectionText.includes("معاملات") || sectionText.includes("اجراءات")) {
    return 250;
  }

  return 0;
}

// Veterans-first signals for catalog section ranking
const VET_HIGH_SIGNALS = [
  "\u0645\u062a\u0642\u0627\u0639\u062f", "\u062a\u0642\u0627\u0639\u062f", "\u0645\u0639\u0627\u0634", "\u0634\u0647\u064a\u062f", "\u0623\u0631\u0645\u0644\u0629", "\u0648\u0631\u062b\u0629", "\u0639\u0633\u0643\u0631\u064a", "\u0627\u0644\u062c\u064a\u0634",
  "\u0645\u0633\u0627\u0639\u062f\u0629", "\u062a\u0639\u0648\u064a\u0636", "\u0637\u0628\u0627\u0628\u0629", "\u0645\u062f\u0631\u0633\u064a\u0629", "\u0645\u062d\u0627\u0631\u0628", "\u0642\u062f\u0627\u0645\u0649",
  "pension", "veteran", "retired", "benefit", "compensation",
];
const VET_GENERIC_SIGNALS = ["\u0635\u0648\u0631\u0629 \u062c\u0648\u064a\u0629", "\u062e\u0631\u064a\u0637\u0629", "aerial", "mapping", "\u0625\u062f\u0627\u0631\u064a"];
const VET_DIRECT_SIGNALS = [
  "متقاعد", "متقاعدين", "متقاعدي", "تقاعد", "محارب", "محاربين", "قدامى", "معاش", "دفتر التقاعد",
  "ورثة", "أرملة", "ارملة", "شهيد", "الشهداء", "مساعدة وفاة", "مساعدة ولادة",
];

function getItemVeteranHaystack(item: { title_ar: string; summary_lb: string; tags?: string[]; applies_to?: string[]; domain?: string }): string {
  return [item.title_ar, item.summary_lb, item.domain, ...(item.tags || []), ...(item.applies_to || [])].join(" ").toLowerCase();
}

function hasDirectVeteranSignal(item: { title_ar: string; summary_lb: string; tags?: string[]; applies_to?: string[]; domain?: string }): boolean {
  const haystack = normalizeArabic(getItemVeteranHaystack(item));
  return VET_DIRECT_SIGNALS.some((term) => haystack.includes(normalizeArabic(term)));
}

function scoreItemVeteranRelevance(item: { title_ar: string; summary_lb: string; tags?: string[]; applies_to?: string[]; domain?: string }): number {
  const hay = getItemVeteranHaystack(item);
  const high = VET_HIGH_SIGNALS.filter((t) => hay.includes(t.toLowerCase())).length;
  const generic = VET_GENERIC_SIGNALS.filter((t) => hay.includes(t.toLowerCase())).length;
  if (high >= 2) return 5;
  if (high >= 1) return 4;
  if (generic >= 1) return 1;
  return 0;
}

function isVeteranCatalogListing(item: {
  title_ar: string;
  summary_lb: string;
  tags?: string[];
  applies_to?: string[];
  domain?: string;
  audience_scope?: string;
}, sourceId: string, veteranRelevance: number): boolean {
  if (["veteran_direct", "veteran_or_family", "retired_army_only", "retired_all_forces", "family_direct"].includes(String(item.audience_scope || ""))) {
    return true;
  }

  if (sourceId === "rabita") {
    return hasDirectVeteranSignal(item);
  }

  return veteranRelevance >= 4 && hasDirectVeteranSignal(item);
}

function sortSectionItemsVeteransFirst<T extends { title_ar: string; summary_lb: string; tags?: string[]; applies_to?: string[]; domain?: string; relevance_weight?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aVet = scoreItemVeteranRelevance(a) * 100 + (a.relevance_weight || 0);
    const bVet = scoreItemVeteranRelevance(b) * 100 + (b.relevance_weight || 0);
    return bVet - aVet;
  });
}

function sortPresentedForCatalog<T extends {
  source?: string;
  section_label?: string;
  section_path?: string[];
  title_clean: string;
  quality_flag: "clean" | "noisy_title";
  record_kind: "procedure" | "reference" | "notice" | "fragment";
  content_tier?: "frontline" | "supporting" | "archive";
  relevance_weight?: number;
}>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const tierWeight = { frontline: 0, supporting: 1, archive: 2 } as const;
    const tierDelta = (tierWeight[left.content_tier || "supporting"] ?? 1) - (tierWeight[right.content_tier || "supporting"] ?? 1);
    if (tierDelta !== 0) return tierDelta;

    const relevanceDelta = (right.relevance_weight || 0) - (left.relevance_weight || 0);
    if (relevanceDelta !== 0) return relevanceDelta;

    const sourceDelta = (left.source || "other").localeCompare(right.source || "other", "ar");
    if (sourceDelta !== 0) return sourceDelta;

    const leftSection = left.section_label || left.section_path?.[0] || "";
    const rightSection = right.section_label || right.section_path?.[0] || "";
    const sectionDelta = leftSection.localeCompare(rightSection, "ar");
    if (sectionDelta !== 0) return sectionDelta;

    const kindDelta = procedureKindSortWeight(left.record_kind) - procedureKindSortWeight(right.record_kind);
    if (kindDelta !== 0) return kindDelta;

    const qualityDelta = Number(left.quality_flag === "noisy_title") - Number(right.quality_flag === "noisy_title");
    if (qualityDelta !== 0) return qualityDelta;

    const lowValueDelta = Number(isLowValueProcedureSampleTitle(left.title_clean)) - Number(isLowValueProcedureSampleTitle(right.title_clean));
    if (lowValueDelta !== 0) return lowValueDelta;

    return right.title_clean.length - left.title_clean.length || left.title_clean.localeCompare(right.title_clean, "ar");
  });
}

function buildProcedureDiagnostics(state: Awaited<ReturnType<typeof loadIndex>>) {
  const representatives = Array.from(state.representativeByTitle.values());

  const excludedRepresentatives = representatives
    .map((procedure) => {
      const docsCount = state.docsByProc.get(procedure.id)?.length || 0;
      if (isListableProcedure(procedure)) return null;

      const presented = presentProcedure(procedure);
      return {
        id: procedure.id,
        title_ar: presented.title_ar,
        title_clean: presented.title_clean,
        source: presented.source,
        source_label: presented.source_label,
        section_label: presented.section_label,
        record_kind: presented.record_kind,
        content_tier: presented.content_tier,
        structured_count: countStructuredFields(procedure),
        docs_count: docsCount,
        summary_lb: presented.summary_lb,
        tags: presented.tags || [],
        reason: "no_structured_content_or_docs",
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.title_clean.localeCompare(right.title_clean, "ar"));

  const weakerDuplicates = state.procedures
    .map((procedure) => {
      const presented = presentProcedure(procedure);
      const titleKey = normalizeArabic(presented.title_clean || presented.title_ar || procedure.id);
      const representative = state.representativeByTitle.get(titleKey);
      if (!representative || representative.id === procedure.id) return null;

      const representativePresented = presentProcedure(representative);
      return {
        id: procedure.id,
        representative_id: representative.id,
        title_ar: presented.title_ar,
        title_clean: presented.title_clean,
        source: presented.source,
        source_label: presented.source_label,
        structured_count: countStructuredFields(procedure),
        docs_count: state.docsByProc.get(procedure.id)?.length || 0,
        summary_length: (presented.summary_clean || presented.summary_lb || "").length,
        representative_structured_count: countStructuredFields(representative),
        representative_docs_count: state.docsByProc.get(representative.id)?.length || 0,
        representative_summary_length: (representativePresented.summary_clean || representativePresented.summary_lb || "").length,
        reason: "duplicate_weaker_title_variant",
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.title_clean.localeCompare(right.title_clean, "ar"));

  return {
    summary: {
      raw_procedures: state.procedures.length,
      representative_titles: representatives.length,
      listable_representatives: representatives.length - excludedRepresentatives.length,
      excluded_representatives: excludedRepresentatives.length,
      weaker_duplicates: weakerDuplicates.length,
    },
    excluded_representatives: excludedRepresentatives,
    weaker_duplicates: weakerDuplicates,
  };
}

function getReferenceSourceFile(sourceId: string): string | null {
  const kbRoot = getKbRoot();
  const docsDir = getDocsDir();
  const fileName = `${sourceId.toLowerCase()}.html`;

  const candidates = uniquePaths([
    path.join(docsDir, "sources", fileName),
    path.join(kbRoot, "docs", "sources", fileName),
    path.resolve(kbRoot, "..", "kb_studio", "runtime", "exports", "watanybot", "docs", "sources", fileName),
    path.resolve(kbRoot, "..", "kb_studio", "runtime", "sources", "watanybot", fileName),
    path.resolve(kbRoot, "..", "..", "sources", "watanybot", fileName),
    path.resolve(kbRoot, "..", "sources", "watanybot", fileName),
    path.resolve(kbRoot, "..", "..", "kb-studio", "watany", "runtime", "exports", "watanybot", "docs", "sources", fileName),
    path.resolve(kbRoot, "..", "..", "kb-studio", "runtime", "exports", "watanybot", "docs", "sources", fileName),
    path.resolve(kbRoot, "..", "..", "..", "..", "watanybot", "kb_studio", "runtime", "exports", "watanybot", "docs", "sources", fileName),
  ]);

  for (const candidate of candidates) {
    if (isAbsoluteExistingFile(candidate)) return candidate;
  }

  return null;
}

function deriveReferenceSourceId(doc: StoredDocAsset): "laf" | "mof" | null {
  const sourceId = doc.source_refs?.[0]?.source_id?.toLowerCase() || doc.id.toLowerCase();
  if (sourceId.includes("laf")) return "laf";
  if (sourceId.includes("mof")) return "mof";
  return null;
}

function normalizeReferenceHref(value?: string | null): string {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//g, "")
    .replace(/^\/+/g, "");
}

type ProcedureDocActionHrefContext = "doc_view" | "reference_view" | "reference_asset";

function buildReferenceDocHref(docId: string, _sourceId: "laf" | "mof"): string {
  return buildProcedureDocActionHref(docId, "preview", "reference_view");
}

function buildProcedureDocActionHref(
  docId: string,
  action: "preview" | "download",
  context: ProcedureDocActionHrefContext,
): string {
  if (context === "doc_view") {
    return `../${action}`;
  }

  const encodedDocId = encodeURIComponent(docId);
  if (context === "reference_asset") {
    return `../../../docs/${encodedDocId}/${action}`;
  }

  return `../docs/${encodedDocId}/${action}`;
}

function buildReferenceSourceHref(sourceId: "laf" | "mof" | "procedures"): string {
  return `../../reference/${sourceId}`;
}

function inferReferenceSourceIdFromDocId(docId: string): "laf" | "mof" | null {
  const normalizedDocId = String(docId || "").trim().toLowerCase();
  if (normalizedDocId.includes("laf")) return "laf";
  if (normalizedDocId.includes("mof")) return "mof";
  return null;
}

function buildProcedurePreviewPage(title: string, bodyHtml: string, actionsHtml: string, noteHtml = ""): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f5efe5; color: #1f2937; font: 16px/1.9 "Segoe UI", Tahoma, sans-serif; }
      main { max-width: 960px; margin: 0 auto; padding: 32px 20px 48px; }
      .card { background: #fffdf8; border: 1px solid #eadfcd; border-radius: 22px; box-shadow: 0 18px 40px rgba(120, 53, 15, 0.08); overflow: hidden; }
      .hero { padding: 24px 24px 18px; background: linear-gradient(135deg, #7c2d12, #c2410c); color: #fff; }
      .hero h1 { margin: 0; font-size: 28px; line-height: 1.5; }
      .hero p { margin: 10px 0 0; color: rgba(255,255,255,0.9); }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; padding: 18px 24px 0; }
      .action { display: inline-flex; align-items: center; justify-content: center; min-width: 160px; padding: 11px 16px; border-radius: 999px; font-weight: 700; text-decoration: none; }
      .action.primary { background: #7c2d12; color: #fff; }
      .action.secondary { background: #fff; color: #7c2d12; border: 1px solid #c2410c; }
      .note { margin: 18px 24px 0; padding: 12px 14px; border-radius: 14px; background: #fff5dd; border: 1px solid #e4c168; color: #5c4105; }
      .content { padding: 24px; }
      .content :is(p, li, td, th, h1, h2, h3, h4, h5, h6) { direction: rtl; text-align: right; }
      .content img { max-width: 100%; height: auto; }
      .content table { width: 100%; border-collapse: collapse; }
      .content table td, .content table th { border: 1px solid #eadfcd; padding: 8px 10px; vertical-align: top; }
      @media (max-width: 700px) {
        main { padding: 16px 12px 28px; }
        .hero h1 { font-size: 24px; }
        .content, .hero { padding: 18px; }
        .actions { padding: 16px 18px 0; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <header class="hero">
          <h1>${escapeHtml(title)}</h1>
          <p>معاينة المستند داخل المتصفح.</p>
        </header>
        <div class="actions">${actionsHtml}</div>
        ${noteHtml ? `<div class="note">${noteHtml}</div>` : ""}
        <article class="content">${bodyHtml}</article>
      </section>
    </main>
  </body>
</html>`;
}

function buildMissingProcedurePreviewPage(docId: string): string {
  const normalizedDocId = String(docId || "").trim();
  const retryHref = escapeHtml(buildProcedureDocActionHref(normalizedDocId, "preview", "doc_view"));
  const sourceId = inferReferenceSourceIdFromDocId(normalizedDocId);
  const referenceHref = escapeHtml(sourceId
    ? buildReferenceSourceHref(sourceId)
    : buildReferenceSourceHref("procedures"));
  let referenceLabel = "فتح مرجع الإجراءات";
  if (sourceId === "mof") {
    referenceLabel = "فتح مرجع وزارة المالية";
  } else if (sourceId === "laf") {
    referenceLabel = "فتح مرجع الجيش";
  }
  const actionsHtml = `<a class="action primary" href="${retryHref}">إعادة المحاولة</a><a class="action secondary" href="${referenceHref}">${referenceLabel}</a>`;
  const bodyHtml = "<p>الملف المطلوب غير متوفر حالياً أو أن رابطه لم يعد صالحاً.</p><p>يمكنك إعادة المحاولة أو متابعة التصفح من المرجع المحلي المرتبط.</p>";
  const noteHtml = `معرّف المستند: <strong>${escapeHtml(normalizedDocId || "غير معروف")}</strong>`;
  return buildProcedurePreviewPage("الملف غير متوفر حالياً", bodyHtml, actionsHtml, noteHtml);
}

function buildImageProcedurePreviewPage(doc: StoredDocAsset, filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mime = DOC_MIME_MAP[ext] || "application/octet-stream";
  const title = doc.title?.trim() || doc.file_name || path.basename(filePath);
  const encodedImage = fs.readFileSync(filePath).toString("base64");
  const downloadHref = escapeHtml(buildProcedureDocActionHref(doc.id, "download", "doc_view"));

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #f8fafc; color: #0f172a; font-family: Tahoma, Arial, sans-serif; }
      body { min-height: 100vh; }
      main { min-height: 100vh; display: flex; flex-direction: column; }
      .toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: rgba(255, 255, 255, 0.94); border-bottom: 1px solid #e2e8f0; backdrop-filter: blur(8px); }
      h1 { margin: 0; font-size: 14px; line-height: 1.6; font-weight: 800; overflow-wrap: anywhere; }
      a { flex: 0 0 auto; border-radius: 8px; background: #0f766e; color: white; padding: 8px 12px; font-size: 12px; font-weight: 700; text-decoration: none; }
      .stage { flex: 1; width: 100%; display: flex; align-items: flex-start; justify-content: center; padding: 0; overflow: auto; }
      img { display: block; width: 100%; max-width: 100%; height: auto; background: white; }
      @media (max-width: 640px) {
        .toolbar { align-items: stretch; flex-direction: column; padding: 8px 10px; }
        a { text-align: center; }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="toolbar">
        <h1>${escapeHtml(title)}</h1>
        <a href="${downloadHref}">تحميل النموذج</a>
      </div>
      <div class="stage"><img alt="${escapeHtml(title)}" src="data:${mime};base64,${encodedImage}" /></div>
    </main>
  </body>
</html>`;
}

function buildPdfProcedurePreviewPage(doc: StoredDocAsset, filePath: string): string {
  const title = doc.title?.trim() || doc.file_name || path.basename(filePath);
  const encodedPdf = fs.readFileSync(filePath).toString("base64");
  const downloadHref = escapeHtml(buildProcedureDocActionHref(doc.id, "download", "doc_view"));
  const pdfDataUrl = `data:application/pdf;base64,${encodedPdf}`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>html,body{margin:0;height:100%;background:#f8fafc;color:#0f172a;font-family:Tahoma,Arial,sans-serif}.toolbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;background:#fff;border-bottom:1px solid #e6eef8}.toolbar h1{margin:0;font-size:14px;line-height:1.6;overflow-wrap:anywhere}.toolbar a{flex:0 0 auto;border-radius:8px;background:#0f766e;color:#fff;padding:8px 12px;font-size:12px;font-weight:700;text-decoration:none}.stage{height:calc(100vh - 52px);min-height:420px;background:#e2e8f0}.pdf-frame{display:block;width:100%;height:100%;border:0;background:#fff}.fallback{position:absolute;inset:auto 16px 16px;display:none;max-width:520px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;box-shadow:0 12px 30px rgba(15,23,42,.12)}@media (max-width:640px){.toolbar{align-items:stretch;flex-direction:column}.toolbar a{text-align:center}.stage{height:calc(100vh - 96px);min-height:360px}}</style>
  </head>
  <body>
    <div class="toolbar"><h1>${escapeHtml(title)}</h1><a href="${downloadHref}">تحميل النموذج</a></div>
    <div class="stage"><iframe class="pdf-frame" title="${escapeHtml(title)}" src="${pdfDataUrl}"></iframe></div>
    <div class="fallback">إذا لم تظهر معاينة PDF داخل المتصفح، استخدم زر التحميل أعلاه.</div>
  </body>
</html>`;
}

async function serveProcedurePreview(reply: any, doc: StoredDocAsset, resolvedFilePath?: string) {
  const filePath = resolvedFilePath || findDocFile(doc);
  if (!filePath) {
    reply.type("text/html; charset=utf-8");
    return reply.send(buildMissingProcedurePreviewPage(doc.id));
  }

  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_PREVIEW_EXTENSIONS.has(ext)) {
    reply.header("cache-control", "public, max-age=86400");
    reply.type("text/html; charset=utf-8");
    return reply.send(buildImageProcedurePreviewPage(doc, filePath));
  }

  if (ext === ".pdf") {
    // Restore previous behavior: render a PDF preview page (with embedded PDF)
    // instead of returning a direct application/pdf response which may trigger
    // an immediate download or be blocked from embedding by security headers.
    reply.header("cache-control", "public, max-age=86400");
    reply.type("text/html; charset=utf-8");
    return reply.send(buildPdfProcedurePreviewPage(doc, filePath));
  }

  if (ext !== ".docx" && ext !== ".doc") {
    return serveProcedureDoc(reply, doc, "inline");
  }

  const downloadHref = escapeHtml(buildProcedureDocActionHref(doc.id, "download", "doc_view"));
  const actionsHtml = `<a class="action primary" href="${downloadHref}">تنزيل المستند</a>`;
  const title = doc.title?.trim() || doc.file_name || path.basename(filePath);

  if (ext === ".doc") {
    const bodyHtml = `<p>هذا المستند بصيغة Word القديمة ولا يمكن عرضه مباشرة داخل المتصفح الحالي.</p>`;
    const noteHtml = "يمكنك تنزيل الملف وفتحه ببرنامج Word أو أي تطبيق يدعم ملفات DOC.";
    reply.header("cache-control", "public, max-age=86400");
    reply.type("text/html; charset=utf-8");
    return reply.send(buildProcedurePreviewPage(title, bodyHtml, actionsHtml, noteHtml));
  }

  try {
    const result = await mammoth.convertToHtml({ path: filePath });
    const noteMessages = result.messages
      .map((message) => escapeHtml(message.message))
      .filter(Boolean)
      .slice(0, 3)
      .join("<br />");
    reply.header("cache-control", "public, max-age=86400");
    reply.type("text/html; charset=utf-8");
    return reply.send(buildProcedurePreviewPage(title, result.value || "<p>لا يوجد محتوى قابل للعرض داخل الملف.</p>", actionsHtml, noteMessages));
  } catch {
    const bodyHtml = `<p>تعذّر تحويل ملف Word إلى معاينة داخل المتصفح.</p>`;
    const noteHtml = "يمكنك تنزيل الملف وفتحه محلياً، أو المحاولة مرة أخرى لاحقاً.";
    reply.header("cache-control", "public, max-age=300");
    reply.type("text/html; charset=utf-8");
    return reply.send(buildProcedurePreviewPage(title, bodyHtml, actionsHtml, noteHtml));
  }
}

function extractReferenceTransactionId(value?: string | null): string | null {
  const text = String(value || "").trim();
  if (!text) return null;

  const transactionMatch = text.match(/transaction[-_](\d{1,3})/i);
  if (transactionMatch?.[1]) {
    return `transaction-${transactionMatch[1]}`;
  }

  const numberedTitleMatch = text.match(/^(\d{1,3})\s*[.)\-:]/);
  if (numberedTitleMatch?.[1]) {
    return `transaction-${numberedTitleMatch[1]}`;
  }

  return null;
}

function buildReferenceAttachmentAnchorMap(sourceHtml: string): Map<string, string> {
  const lookup = new Map<string, string>();
  const sectionRegex = /<section\b[^>]*\bid=(['"])(transaction-\d{1,3})\1[^>]*>([\s\S]*?)<\/section>/gi;

  for (const match of sourceHtml.matchAll(sectionRegex)) {
    const sectionId = match[2];
    const sectionHtml = match[3] || "";
    for (const linkMatch of sectionHtml.matchAll(/<a\b[^>]*?href=(['"])(.*?)\1/gi)) {
      const normalizedHref = normalizeReferenceHref(linkMatch[2]);
      if (!normalizedHref || normalizedHref.startsWith("#")) continue;
      if (!lookup.has(normalizedHref)) {
        lookup.set(normalizedHref, sectionId);
      }
    }
  }

  return lookup;
}

function resolveReferenceFocusHash(doc: StoredDocAsset, sourceHtml?: string): string {
  for (const candidate of [doc.source_anchor, doc.title, doc.file_path, doc.file_name]) {
    const transactionId = extractReferenceTransactionId(candidate);
    if (transactionId) {
      return transactionId;
    }
  }

  if (sourceHtml) {
    const attachmentAnchors = buildReferenceAttachmentAnchorMap(sourceHtml);
    for (const candidate of [doc.file_path, doc.file_name, doc.source_href]) {
      const normalizedHref = normalizeReferenceHref(candidate);
      if (!normalizedHref) continue;
      const sectionId = attachmentAnchors.get(normalizedHref);
      if (sectionId) {
        return sectionId;
      }
    }
  }

  if (doc.source_anchor && !/^تحميل\s+(?:الملف|المستند)$/u.test(doc.source_anchor.trim())) {
    return encodeURIComponent(doc.source_anchor);
  }

  return `doc-${encodeURIComponent(doc.id)}`;
}

function buildReferenceFocusUrl(sourceId: "laf" | "mof", doc: StoredDocAsset, sourceHtml?: string, showFallbackBanner = false): string {
  const params = new URLSearchParams();
  params.set("focusDoc", doc.id);
  if (showFallbackBanner) {
    params.set("fallback", "1");
  }

  return `${buildReferenceSourceHref(sourceId)}?${params.toString()}#${resolveReferenceFocusHash(doc, sourceHtml)}`;
}

function buildReferenceDocLookup(docs: StoredDocAsset[], sourceId: "laf" | "mof"): Map<string, StoredDocAsset> {
  const lookup = new Map<string, StoredDocAsset>();
  const canonicalByFileName = new Map<string, StoredDocAsset>();

  for (const doc of docs) {
    if (deriveReferenceSourceId(doc) !== sourceId) continue;
    const fileNameKey = normalizeReferenceHref(doc.file_name);
    if (fileNameKey && !canonicalByFileName.has(fileNameKey)) {
      canonicalByFileName.set(fileNameKey, doc);
    }
  }

  for (const doc of docs) {
    if (deriveReferenceSourceId(doc) !== sourceId) continue;

    const fileNameKey = normalizeReferenceHref(doc.file_name);
    const canonicalDoc = (fileNameKey && canonicalByFileName.get(fileNameKey)) || doc;

    for (const candidate of [doc.file_path, doc.file_name, doc.source_href]) {
      const normalized = normalizeReferenceHref(candidate);
      if (!normalized || lookup.has(normalized)) continue;
      lookup.set(normalized, canonicalDoc);

      if (normalized.startsWith("pages/")) {
        const trimmed = normalized.slice("pages/".length);
        if (trimmed && !lookup.has(trimmed)) {
          lookup.set(trimmed, canonicalDoc);
        }
      } else if (/[.](?:pdf|docx?|jpe?g|png|html?)$/i.test(normalized)) {
        const paged = `pages/${normalized}`;
        if (!lookup.has(paged)) {
          lookup.set(paged, canonicalDoc);
        }
      }
    }
  }

  return lookup;
}

function buildReferenceAttachmentActions(docId: string): string {
  const previewHref = escapeHtml(buildProcedureDocActionHref(docId, "preview", "reference_view"));
  const downloadHref = escapeHtml(buildProcedureDocActionHref(docId, "download", "reference_view"));
  return `<div class="watany-attachment-actions"><a class="watany-attachment-action preview" href="${previewHref}" target="_blank" rel="noreferrer">معاينة المستند</a><a class="watany-attachment-action download" href="${downloadHref}">تنزيل المستند</a></div>`;
}

function rewriteLafHtml(rewrittenHtml: string): string {
  let rewritten = rewrittenHtml
    .replace(/<html(.*?)>/i, (_match: string, attrs: string) => {
      let nextAttrs = attrs || "";
      if (/\blang\s*=\s*['"][^'"]*['"]/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\blang\s*=\s*['"][^'"]*['"]/i, 'lang="ar"');
      } else {
        nextAttrs += ' lang="ar"';
      }
      if (/\bdir\s*=\s*['"][^'"]*['"]/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\bdir\s*=\s*['"][^'"]*['"]/i, 'dir="rtl"');
      } else {
        nextAttrs += ' dir="rtl"';
      }
      return `<html${nextAttrs}>`;
    })
    .replace(/<body([^>]*)>/i, (_match: string, attrs: string) => {
      const classAttrMatch = attrs.match(/\bclass\s*=\s*(['"])(.*?)\1/i);
      if (classAttrMatch) {
        const merged = `${classAttrMatch[2]} watany-reference watany-reference--laf`.trim();
        return `<body${attrs.replace(classAttrMatch[0], `class="${escapeHtml(merged)}"`)}>`;
      }
      return `<body${attrs} class="watany-reference watany-reference--laf">`;
    });

  rewritten = rewritten.replace(/<p\s+class=(['"])attachment-link\1>\s*<a\b[^>]*data-doc-id=(['"])([^'"]+)\2[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi, (_match: string, _quote: string, _dataQuote: string, docId: string) => {
    return buildReferenceAttachmentActions(docId);
  });

  rewritten = rewritten.replace(/<a\b[^>]*data-doc-id=(['"])([^'"]+)\1[^>]*>[\s\S]*?(?:تحميل الملف|تحميل المستند)[\s\S]*?<\/a>/gi, "");
  rewritten = rewritten.replace(/<p[^>]*>\s*<\/p>/gi, "");

  return rewritten;
}

function rewriteReferenceHtml(
  html: string,
  sourceId: "laf" | "mof",
  docs: StoredDocAsset[],
  focusDoc?: StoredDocAsset,
  showFallbackBanner = false,
): string {
  const docLookup = buildReferenceDocLookup(docs, sourceId);
  const focusTitle = focusDoc?.title?.trim();
  let focusBanner = "";
  if (focusDoc && showFallbackBanner) {
    const titleSuffix = focusTitle ? `: <strong>${escapeHtml(focusTitle)}</strong>` : "";
    focusBanner = `<div class="watany-reference-banner">الملف الأصلي غير متاح حالياً. تم فتح المرجع المحلي المرتبط${titleSuffix}.</div>`;
  }
  const styleBlock = `<style id="watany-reference-enhancements">\n    html { scroll-behavior: smooth; }\n    body.watany-reference { margin: 0; padding: 24px; direction: rtl; unicode-bidi: plaintext; background: #f6f1e8; color: #1f2937; font: 16px/1.9 "Segoe UI", Tahoma, sans-serif; }\n    .watany-reference-banner { margin: 0 0 16px; padding: 12px 14px; border: 1px solid #d7b14a; background: #fff6dd; color: #4f3c04; font: 600 14px/1.6 Arial, sans-serif; border-radius: 10px; }\n    a[data-doc-id]:target { outline: 3px solid #d7b14a; background: #fff1c2; border-radius: 8px; scroll-margin-top: 24px; }\n    body.watany-reference--laf nav.toc { position: sticky; top: 0; z-index: 5; margin: -24px -24px 24px; padding: 24px; background: linear-gradient(180deg, rgba(255,248,237,0.98), rgba(246,241,232,0.94)); backdrop-filter: blur(8px); border-bottom: 1px solid #e6d7be; }\n    body.watany-reference--laf nav.toc h1 { margin: 0 0 16px; color: #7c2d12; font-size: 28px; }\n    body.watany-reference--laf nav.toc ol { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 24px; }\n    body.watany-reference--laf nav.toc li { break-inside: avoid; margin: 0 0 10px; }\n    body.watany-reference--laf nav.toc a { color: #1f2937; text-decoration: none; display: block; padding: 8px 10px; border-radius: 10px; }\n    body.watany-reference--laf nav.toc a:hover { background: rgba(124, 45, 18, 0.08); }\n    body.watany-reference--laf section.transaction { max-width: 980px; margin: 0 auto 24px; padding: 24px 28px; background: #fffdf9; border: 1px solid #eadfcd; border-radius: 20px; box-shadow: 0 18px 46px rgba(120, 53, 15, 0.08); }\n    body.watany-reference--laf section.transaction h2 { margin: 0 0 18px; color: #7c2d12; font-size: 24px; line-height: 1.6; }\n    body.watany-reference--laf section.transaction hr, body.watany-reference--laf script { display: none !important; }\n    body.watany-reference--laf .col-xs-12, body.watany-reference--laf .col-md-9 { float: none !important; width: auto !important; }\n    body.watany-reference--laf p, body.watany-reference--laf li { direction: rtl; text-align: right; }\n    .watany-attachment-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 18px; }\n    .watany-attachment-action { display: inline-flex; align-items: center; justify-content: center; min-width: 150px; padding: 10px 16px; border-radius: 999px; text-decoration: none; font-weight: 700; }\n    .watany-attachment-action.preview { background: #7c2d12; color: #fff; }\n    .watany-attachment-action.download { background: #fff; color: #7c2d12; border: 1px solid #c2410c; }\n    @media (max-width: 900px) { body.watany-reference--laf nav.toc ol { columns: 1; } body.watany-reference { padding: 16px; } body.watany-reference--laf nav.toc { margin: -16px -16px 20px; padding: 16px; } body.watany-reference--laf section.transaction { padding: 18px; } }\n  </style>`;

  let rewritten = html.replace(/<a\b([^>]*?)href=(['"])(.*?)\2([^>]*)>/gi, (match: string, before: string, quote: string, href: string, after: string) => {
    const trimmedHref = String(href || "").trim();
    if (!trimmedHref || trimmedHref.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(trimmedHref) || trimmedHref.startsWith("/api/")) {
      return match;
    }

    const doc = docLookup.get(normalizeReferenceHref(trimmedHref));
    if (!doc) {
      return match;
    }

    const attrs = `${before}${after}`;
    const docElementId = `doc-${doc.id}`;
    const idAttr = /\sid\s*=\s*['"]/i.test(attrs) ? "" : ` id="${escapeHtml(docElementId)}"`;
    const dataAttr = /\sdata-doc-id\s*=\s*['"]/i.test(attrs) ? "" : ` data-doc-id="${escapeHtml(doc.id)}"`;
    const rewrittenHref = buildReferenceDocHref(doc.id, sourceId);
    return `<a${before}href=${quote}${escapeHtml(rewrittenHref)}${quote}${after}${idAttr}${dataAttr}>`;
  });

  if (rewritten.includes("</head>")) {
    rewritten = rewritten.replace("</head>", `${styleBlock}</head>`);
  } else {
    rewritten = `${styleBlock}${rewritten}`;
  }

  if (focusBanner) {
    rewritten = rewritten.replace(/<body([^>]*)>/i, `<body$1>${focusBanner}`);
  }

  if (sourceId === "laf") {
    rewritten = rewriteLafHtml(rewritten);
  }

  return rewritten;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildProceduresReferenceHtml(procedures: Procedure[]): string {
  const presented = procedures
    .map((procedure) => presentProcedure(procedure))
    .filter((procedure) => procedure.source === "procedures");

  const sections = new Map<string, typeof presented>();
  for (const procedure of presented) {
    const section = procedure.section_label || procedure.section_path?.[0] || "أقسام أخرى";
    const group = sections.get(section) || [];
    group.push(procedure);
    sections.set(section, group);
  }

  const orderedSections = Array.from(sections.entries()).sort((a, b) => a[0].localeCompare(b[0], "ar"));
  const nav = orderedSections
    .map(([section]) => `<a href="#${encodeURIComponent(section)}">${escapeHtml(section)}</a>`)
    .join("");
  const body = orderedSections
    .map(([section, items]) => {
      const cards = items
        .sort((a, b) => a.title_ar.localeCompare(b.title_ar, "ar"))
        .map((item) => {
          const tags = (item.tags || []).slice(0, 8)
            .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
            .join("");

          return `<article class="card"><h3>${escapeHtml(item.title_clean || item.title_ar)}</h3><p>${escapeHtml(item.summary_clean || item.summary_lb || "")}</p>${tags ? `<div class="tags">${tags}</div>` : ""}</article>`;
        })
        .join("");

      return `<section class="section" id="${encodeURIComponent(section)}"><header><h2>${escapeHtml(section)}</h2><span>${items.length} إجراء</span></header><div class="cards">${cards}</div></section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>مرجع الإجراءات والشؤون</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Segoe UI", Tahoma, sans-serif; background: #f7f7fb; color: #172033; }
      .shell { max-width: 1320px; margin: 0 auto; padding: 24px; }
      .hero { background: linear-gradient(135deg, #0f766e, #1d4ed8); color: #fff; border-radius: 24px; padding: 24px; margin-bottom: 20px; }
      .hero h1 { margin: 0 0 8px; font-size: 32px; }
      .hero p { margin: 0; opacity: 0.92; }
      .nav { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0 26px; }
      .nav a { text-decoration: none; color: #0f172a; background: #fff; border: 1px solid #d7def0; padding: 10px 14px; border-radius: 999px; }
      .section { margin-bottom: 28px; }
      .section header { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 14px; }
      .section h2 { margin: 0; font-size: 24px; }
      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
      .card { background: #fff; border-radius: 18px; border: 1px solid #dde4f4; padding: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05); }
      .card h3 { margin: 0 0 10px; font-size: 18px; }
      .card p { margin: 0; color: #475569; line-height: 1.7; }
      .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .tag { background: #eef2ff; color: #3730a3; border-radius: 999px; padding: 6px 10px; font-size: 12px; }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <h1>مرجع الإجراءات والشؤون</h1>
        <p>هذا العرض مبني مباشرةً من أحدث تصدير KB Studio داخل موطني. عدد الإجراءات الحالية: ${presented.length}</p>
      </section>
      <nav class="nav">${nav}</nav>
      ${body}
    </main>
  </body>
</html>`;
}

async function serveProcedureDoc(reply: any, doc: StoredDocAsset, disposition: "inline" | "attachment", resolvedFilePath?: string) {
  if (doc.public_url) {
    return reply.redirect(doc.public_url);
  }

  const filePath = resolvedFilePath || findDocFile(doc);
  if (!filePath) {
    if (disposition === "attachment") {
      reply.type("text/plain; charset=utf-8");
      return reply.send(`fallback_download:${doc.id}`);
    }
    reply.type("text/html; charset=utf-8");
    return reply.send(buildMissingProcedurePreviewPage(doc.id));
  }

  const ext = path.extname(filePath).toLowerCase();
  reply.header("cache-control", "public, max-age=86400");
  reply.type(DOC_MIME_MAP[ext] || "application/octet-stream");
  if (disposition === "attachment") {
    reply.header("content-disposition", buildContentDispositionFilename(doc.file_name || path.basename(filePath)));
  }
  return reply.send(createReadStream(filePath));
}

/**
 * Registers all /api/v2/procedures/* routes on the Fastify instance.
 */
export async function proceduresRoutes(app: FastifyInstance) {
  app.get("/api/v2/procedures/reference/:sourceId", async (req, reply) => {
    const { sourceId } = req.params as { sourceId: string };
    const { focusDoc, fallback } = req.query as { focusDoc?: string; fallback?: string };
    const normalizedSourceId = sourceId.toLowerCase();

    reply.header("cache-control", "public, max-age=300");

    if (normalizedSourceId === "shoon" || normalizedSourceId === "procedures") {
      const currentState = await loadIndex(false);
      const html = buildProceduresReferenceHtml(currentState.procedures);
      reply.type("text/html; charset=utf-8");
      return reply.send(html);
    }

    if (normalizedSourceId === "laf" || normalizedSourceId === "mof") {
      const sourceFile = getReferenceSourceFile(normalizedSourceId);
      if (!sourceFile) {
        reply.type("text/html; charset=utf-8");
        return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>مرجع ${normalizedSourceId.toUpperCase()}</title></head><body><h1>مرجع ${normalizedSourceId.toUpperCase()}</h1><p>المصدر غير متوفر حالياً، ويمكن متابعة الروابط المرجعية الأساسية.</p><ul><li>DOC-WATANY_MOF_HTML-0006</li></ul></body></html>`;
      }

      const currentState = await loadIndex(false);
      const sourceDocs = currentState.docs.filter((doc) => deriveReferenceSourceId(doc) === normalizedSourceId);
      const focusedDoc = focusDoc
        ? sourceDocs.find((doc) => doc.id === focusDoc)
        : undefined;
      const rewrittenHtml = rewriteReferenceHtml(
        fs.readFileSync(sourceFile, "utf8"),
        normalizedSourceId,
        sourceDocs,
        focusedDoc,
        fallback === "1",
      );

      reply.type("text/html; charset=utf-8");
      return reply.send(rewrittenHtml);
    }

    reply.code(404);
    return { ok: false, error: "reference_source_not_found" };
  });

  app.get("/api/v2/procedures/reference/:sourceId/asset/:docId", async (req, reply) => {
    const { sourceId, docId } = req.params as { sourceId: string; docId: string };
    const normalizedSourceId = sourceId.toLowerCase() as "laf" | "mof";

    if (normalizedSourceId !== "laf" && normalizedSourceId !== "mof") {
      reply.code(404);
      return { ok: false, error: "reference_source_not_found" };
    }

    const doc = await getProcedureDoc(docId);
    if (!doc || deriveReferenceSourceId(doc) !== normalizedSourceId) {
      reply.code(404);
      return { ok: false, error: "document_not_found" };
    }

    const sourceFile = getReferenceSourceFile(normalizedSourceId);
    const filePath = findDocFile(doc);
    if (filePath && (!sourceFile || path.normalize(filePath) !== path.normalize(sourceFile))) {
      reply.header("cache-control", "public, max-age=86400");
      reply.type(DOC_MIME_MAP[path.extname(filePath).toLowerCase()] || "application/octet-stream");
      return reply.send(createReadStream(filePath));
    }

    // No standalone file found — redirect to the preview endpoint which renders the doc properly
    // (or shows a clear "not available" page) rather than looping back to the reference page.
    return reply.redirect(buildProcedureDocActionHref(doc.id, "preview", "reference_asset"));
  });

  /* ── Browse catalog ────────────────────────────────── */
  app.get("/api/v2/procedures/catalog", async (req) => {
    const { includeArchive } = req.query as { includeArchive?: string };
    const state = await loadIndex(false);
    const presented = sortPresentedForCatalog(
      Array.from(state.representativeByTitle.values())
        .filter((procedure) => isListableProcedure(procedure))
        .map((procedure) => presentProcedure(procedure))
        .filter((procedure) => includeArchive === "true" || procedure.content_tier !== "archive"),
    );

    const sourceBuckets = new Map<string, {
      id: string;
      title: string;
      basis: string;
      count: number;
      guide_mentions: string[];
    }>();
    const sectionBuckets = new Map<string, {
      id: string;
      title: string;
      source: string;
      source_label: string;
      count: number;
      procedure_count: number;
      notice_count: number;
      reference_count: number;
      fragment_count: number;
      items: Array<{
        id: string;
        title_ar: string;
        summary_lb: string;
        steps: string[];
        title_clean: string;
        summary_clean: string;
        tags: string[];
        section_label: string;
        source_label: string;
        record_kind: "procedure" | "reference" | "notice" | "fragment";
        quality_flag: "clean" | "noisy_title";
        audience_scope: string;
        content_tier: string;
        applies_to: string[];
        domain: string;
        relevance_weight: number;
      }>;
      notice_items: Array<{
        id: string;
        title_ar: string;
        summary_lb: string;
        steps: string[];
        title_clean: string;
        summary_clean: string;
        tags: string[];
        section_label: string;
        source_label: string;
        record_kind: "procedure" | "reference" | "notice" | "fragment";
        quality_flag: "clean" | "noisy_title";
        audience_scope: string;
        content_tier: string;
        applies_to: string[];
        domain: string;
        relevance_weight: number;
      }>;
      procedure_items: Array<{
        id: string;
        title_ar: string;
        summary_lb: string;
        steps: string[];
        title_clean: string;
        summary_clean: string;
        tags: string[];
        section_label: string;
        source_label: string;
        record_kind: "procedure" | "reference" | "notice" | "fragment";
        quality_flag: "clean" | "noisy_title";
        audience_scope: string;
        content_tier: string;
        applies_to: string[];
        domain: string;
        relevance_weight: number;
      }>;
      reference_items: Array<{
        id: string;
        title_ar: string;
        summary_lb: string;
        steps: string[];
        title_clean: string;
        summary_clean: string;
        tags: string[];
        section_label: string;
        source_label: string;
        record_kind: "procedure" | "reference" | "notice" | "fragment";
        quality_flag: "clean" | "noisy_title";
        audience_scope: string;
        content_tier: string;
        applies_to: string[];
        domain: string;
        relevance_weight: number;
      }>;
    }>();

    for (const procedure of presented) {
      const authority = mapProcedureToAuthorityBucket(procedure);
      const sourceId = authority.id;
      const sourceTitle = authority.title;
      const veteranRelevance = scoreItemVeteranRelevance(procedure);

      if (isIrrelevantLegalGovernanceListing(procedure)) {
        continue;
      }

      if (sourceId === "other" && !hasProceduresDocumentSource(procedure)) {
        continue;
      }

      if (!isVeteranCatalogListing(procedure, sourceId, veteranRelevance)) {
        continue;
      }

      const existingSource = sourceBuckets.get(sourceId);
      if (existingSource) {
        existingSource.count += 1;
      } else {
        sourceBuckets.set(sourceId, {
          id: sourceId,
          title: sourceTitle,
          basis: AUTHORITY_SOURCE_META[sourceId]?.basis || AUTHORITY_SOURCE_META.other.basis,
          count: 1,
          guide_mentions: [],
        });
      }

      const sectionTitle = sourceTitle;
      const sectionId = `authority:${sourceId}`;
      const existingSection = sectionBuckets.get(sectionId);
      const item = {
        id: procedure.id,
        title_ar: procedure.title_ar,
        summary_lb: procedure.summary_lb,
        steps: (procedure.steps || []).filter(Boolean),
        title_clean: procedure.title_clean,
        summary_clean: procedure.summary_clean,
        tags: procedure.tags || [],
        section_label: sectionTitle,
        source_label: sourceTitle,
        record_kind: procedure.record_kind,
        quality_flag: procedure.quality_flag,
        audience_scope: procedure.audience_scope,
        content_tier: procedure.content_tier,
        applies_to: procedure.applies_to || [],
        domain: procedure.domain,
        relevance_weight: (procedure.relevance_weight || 0) + getGuideDocumentBoost(procedure),
      };

      if (existingSection) {
        existingSection.count += 1;
        const includeInProcedureSamples = !(procedure.record_kind === "procedure" && isLowValueProcedureSampleTitle(item.title_clean || item.title_ar));
        if (procedure.record_kind === "reference") {
          existingSection.reference_count += 1;
          pushUniqueProcedureSample(existingSection.reference_items, item, 6);
        } else if (procedure.record_kind === "notice") {
          existingSection.notice_count += 1;
          pushUniqueProcedureSample(existingSection.notice_items, item, 6);
        } else if (procedure.record_kind === "procedure") {
          existingSection.procedure_count += 1;
          if (includeInProcedureSamples) {
            pushUniqueProcedureSample(existingSection.procedure_items, item, 6);
          }
        } else {
          existingSection.fragment_count += 1;
        }

        const sameKindCount = existingSection.items.filter((entry) => entry.record_kind === item.record_kind).length;
        if (existingSection.items.length < 12 && sameKindCount < 6 && (procedure.record_kind !== "procedure" || includeInProcedureSamples)) {
          pushUniqueProcedureSample(existingSection.items, item, 12);
        }
      } else {
        const includeInProcedureSamples = !(procedure.record_kind === "procedure" && isLowValueProcedureSampleTitle(item.title_clean || item.title_ar));
        sectionBuckets.set(sectionId, {
          id: sectionId,
          title: sectionTitle,
          source: sourceId,
          source_label: sourceTitle,
          count: 1,
          procedure_count: procedure.record_kind === "procedure" ? 1 : 0,
          notice_count: procedure.record_kind === "notice" ? 1 : 0,
          reference_count: procedure.record_kind === "reference" ? 1 : 0,
          fragment_count: procedure.record_kind === "fragment" ? 1 : 0,
          items: procedure.record_kind === "procedure" && !includeInProcedureSamples ? [] : [item],
          notice_items: procedure.record_kind === "notice" ? [item] : [],
          procedure_items: procedure.record_kind === "procedure" && includeInProcedureSamples ? [item] : [],
          reference_items: procedure.record_kind === "reference" ? [item] : [],
        });
      }
    }

    for (const sourceId of Object.keys(AUTHORITY_SOURCE_META)) {
      if (sourceBuckets.has(sourceId)) continue;
      sourceBuckets.set(sourceId, {
        id: sourceId,
        title: AUTHORITY_SOURCE_META[sourceId].title,
        basis: AUTHORITY_SOURCE_META[sourceId].basis,
        count: 0,
        guide_mentions: [],
      });
    }

    const sources = Array.from(sourceBuckets.values()).sort((a, b) => {
      const aVet = SOURCE_VETERAN_PRIORITY[a.id] ?? 0;
      const bVet = SOURCE_VETERAN_PRIORITY[b.id] ?? 0;
      if (bVet !== aVet) return bVet - aVet;
      return b.count - a.count || a.title.localeCompare(b.title, "ar");
    });
    const sections = Array.from(sectionBuckets.values()).sort((a, b) => {
      const aVet = SOURCE_VETERAN_PRIORITY[a.source] ?? 0;
      const bVet = SOURCE_VETERAN_PRIORITY[b.source] ?? 0;
      if (bVet !== aVet) return bVet - aVet;
      return b.count - a.count || a.title.localeCompare(b.title, "ar");
    });

    // Apply veterans-first ranking within each section's item lists
    for (const section of sections) {
      section.items = sortSectionItemsVeteransFirst(section.items);
      section.procedure_items = sortSectionItemsVeteransFirst(section.procedure_items);
      section.notice_items = sortSectionItemsVeteransFirst(section.notice_items);
      section.reference_items = sortSectionItemsVeteransFirst(section.reference_items);
    }

    const guideItems = presented
      .filter((procedure) => inferAuthoritySourceId(procedure) === "procedures")
      .filter((procedure) => procedure.record_kind === "procedure");

    const normalizedGuideTitles = new Map<string, string>();
    for (const item of guideItems) {
      const label = item.title_clean || item.title_ar;
      normalizedGuideTitles.set(normalizeArabic(label), label);
    }

    for (const source of sources) {
      const matchingSection = sections.find((section) => section.source === source.id);
      const titles = source.id === "procedures"
        ? (matchingSection?.procedure_items || matchingSection?.items || []).map((item) => item.title_clean || item.title_ar)
        : (matchingSection?.procedure_items || matchingSection?.items || [])
          .map((item) => item.title_clean || item.title_ar)
          .filter((title) => normalizedGuideTitles.has(normalizeArabic(title)));

      const uniqueMentions: string[] = [];
      for (const title of titles) {
        if (!title || uniqueMentions.includes(title)) continue;
        uniqueMentions.push(title);
        if (uniqueMentions.length >= 4) break;
      }

      if (uniqueMentions.length === 0 && matchingSection) {
        for (const item of matchingSection.procedure_items || matchingSection.items || []) {
          const title = item.title_clean || item.title_ar;
          if (!title || uniqueMentions.includes(title)) continue;
          uniqueMentions.push(title);
          if (uniqueMentions.length >= 4) break;
        }
      }

      source.guide_mentions = uniqueMentions;
    }

    return { sources, sections };
  });

  /* ── Search ────────────────────────────────────────── */
  app.get("/api/v2/procedures/search", async (req, reply) => {
    const { q, limit } = req.query as { q?: string; limit?: string };
    const query = (q || "").trim();
    if (!query) {
      reply.code(400);
      return { error: "q required" };
    }
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const items = await searchProcedures(query, lim);
    return { items };
  });

  /* ── Get single procedure ──────────────────────────── */
  app.get("/api/v2/procedures/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = await getProcedure(id);
    if (!p) {
      reply.code(404);
      return { error: "not_found" };
    }
    const docs = await getProcedureDocs(id);
    if (!isListableProcedure(p)) {
      reply.code(404);
      return { error: "not_found" };
    }
    return { procedure: presentProcedure(p) };
  });

  /* ── Get related docs ──────────────────────────────── */
  app.get("/api/v2/procedures/:id/docs", async (req) => {
    const { id } = req.params as { id: string };
    const docs = await getProcedureDocs(id);
    return { docs };
  });

  app.get("/api/v2/procedures/docs/:docId/preview", async (req, reply) => {
    const { docId } = req.params as { docId: string };
    const doc = await getProcedureDoc(docId);
    if (!doc) {
      const inferredSource = inferReferenceSourceIdFromDocId(docId);
      if (inferredSource) {
        reply.type("text/html; charset=utf-8");
        return buildMissingProcedurePreviewPage(docId);
      }
      reply.code(404);
      reply.header("cache-control", "public, max-age=60");
      reply.type("text/html; charset=utf-8");
      return reply.send(buildMissingProcedurePreviewPage(docId));
    }

    const docSource = deriveReferenceSourceId(doc);
    const sourceFile = docSource ? getReferenceSourceFile(docSource) : null;
    const filePath = findDocFile(doc);
    const directMofAsset = mofPublicAssetPaths(doc).find((candidate) => isAbsoluteExistingFile(candidate));
    if (directMofAsset) {
      return serveProcedurePreview(reply, doc, directMofAsset);
    }
    // If the doc is a source fallback, only redirect to the reference HTML
    // when the resolved file is missing or when the resolved file is the
    // original source HTML itself. For non-HTML resolved files (images, PDFs)
    // prefer serving the actual file so the viewer can display it inline.
    if (doc.asset_delivery_kind === "source_fallback" && docSource) {
      const isSourceHtmlMatch = filePath && sourceFile && path.normalize(filePath) === path.normalize(sourceFile) && [".html", ".htm"].includes(path.extname(filePath).toLowerCase());

      // If the resolved file is the source HTML but there exists an alternative
      // local candidate (image/PDF/etc) that can be used for preview, prefer
      // that candidate instead of redirecting to the reference HTML.
      if (isSourceHtmlMatch) {
        const candidates = docCandidates(doc);
        const alt = candidates.find((c) => {
          if (!c) return false;
          try {
            if (!isAbsoluteExistingFile(c)) return false;
          } catch {
            return false;
          }
          const ext = path.extname(c).toLowerCase();
          return ![".html", ".htm"].includes(ext);
        });
        const publicMofAsset = mofPublicAssetPaths(doc).find((c) => isAbsoluteExistingFile(c));
        if (publicMofAsset || alt) {
          // Serve the non-HTML asset inline (image/PDF) instead of redirecting
          // to the reference HTML so the viewer can display the actual file.
          return serveProcedurePreview(reply, doc, publicMofAsset || alt);
        }
      }

      if (!filePath || !sourceFile || isSourceHtmlMatch) {
        const sourceHtml = sourceFile ? fs.readFileSync(sourceFile, "utf8") : undefined;
        return reply.redirect(buildReferenceFocusUrl(docSource, doc, sourceHtml, true));
      }
    }

    return serveProcedurePreview(reply, doc);
  });

  app.get("/api/v2/procedures/docs/:docId/download", async (req, reply) => {
    const { docId } = req.params as { docId: string };
    const doc = await getProcedureDoc(docId);
    if (!doc) {
      const inferredSource = inferReferenceSourceIdFromDocId(docId);
      if (inferredSource) {
        reply.type("text/plain; charset=utf-8");
        return `fallback_download:${docId}`;
      }
      reply.code(404);
      return { error: "not_found" };
    }
    const docSource = deriveReferenceSourceId(doc);
    const sourceFile = docSource ? getReferenceSourceFile(docSource) : null;
    const filePath = findDocFile(doc);
    if (doc.asset_delivery_kind === "source_fallback" && docSource && (!filePath || !sourceFile || path.normalize(filePath) === path.normalize(sourceFile))) {
      const sourceHtml = sourceFile ? fs.readFileSync(sourceFile, "utf8") : undefined;
      return reply.redirect(buildReferenceFocusUrl(docSource, doc, sourceHtml, true));
    }

    return serveProcedureDoc(reply, doc, "attachment");
  });

  /* ── Get Mermaid flow ──────────────────────────────── */
  app.get("/api/v2/procedures/:id/flow", async (req, reply) => {
    const { id } = req.params as { id: string };
    const resolvedProcedureId = await resolveProcedureId(id);
    const flow = getFlowText(resolvedProcedureId || id);
    if (!flow.ok) {
      reply.code(404);
      return { error: flow.error };
    }
    return { mermaid: flow.text };
  });

  /* ── Stats ─────────────────────────────────────────── */
  app.get("/api/v2/procedures/stats", async () => {
    return await getStats();
  });

  /* ── Admin: force reload ───────────────────────────── */
  app.post("/api/admin/procedures/reload", async () => {
    const stats = await reloadIndex();
    return { ok: true, ...stats };
  });

  /* ════════════════════════════════════════════════════ SUPERADMIN CRUD */

  /* ── Get all procedures (admin list) ────────────────── */
  app.get("/api/admin/procedures", async (req, reply) => {
    const state = await loadIndex(false);
    return { procedures: state.procedures.map((procedure) => presentProcedure(procedure)) };
  });

  /* ── Procedure diagnostics (admin) ─────────────────── */
  app.get("/api/admin/procedures/diagnostics", { preHandler: [requireRole("superadmin")] }, async (_req, reply) => {
    const state = await loadIndex(false);
    return buildProcedureDiagnostics(state);
  });

  /* ── Get document links for one procedure (admin) ───── */
  app.get<{ Params: { id: string } }>("/api/admin/procedures/:id/doc-links", { preHandler: [requireRole("superadmin")] }, async (req, reply) => {
    const { id } = req.params;
    const state = await loadIndex(false);
    const procedure = state.byId.get(id) || state.byId.get(normalizeAdminProcedureId(id));
    if (!procedure) {
      reply.code(404);
      return { error: "not_found" };
    }

    const links = await readProcedureDocsLinks();
    const mapping = links.find((entry) => normalizeAdminProcedureId(entry.procedure_id) === normalizeAdminProcedureId(id));

    return {
      procedure: presentProcedure(procedure),
      mapping: {
        procedure_id: procedure.id,
        doc_ids: normalizeAdminDocIds(mapping?.doc_ids),
        confidence: mapping?.confidence,
        reason: mapping?.reason,
        attached_docs: Array.isArray(mapping?.attached_docs) ? mapping?.attached_docs : [],
      },
    };
  });

  /* ── Replace document links for one procedure (admin) ─ */
  app.put<{ Params: { id: string }; Body: { doc_ids?: string[]; reason?: string } }>("/api/admin/procedures/:id/doc-links", { preHandler: [requireRole("superadmin")] }, async (req, reply) => {
    const { id } = req.params;
    const state = await loadIndex(false);
    const procedure = state.byId.get(id) || state.byId.get(normalizeAdminProcedureId(id));
    if (!procedure) {
      reply.code(404);
      return { error: "not_found" };
    }

    const nextDocIds = normalizeAdminDocIds(req.body?.doc_ids);
    const reason = String(req.body?.reason || "superadmin_manual").trim() || "superadmin_manual";
    const links = await readProcedureDocsLinks();
    const existing = links.find((entry) => normalizeAdminProcedureId(entry.procedure_id) === normalizeAdminProcedureId(id));
    const remaining = links.filter((entry) => normalizeAdminProcedureId(entry.procedure_id) !== normalizeAdminProcedureId(id));

    if (nextDocIds.length > 0) {
      remaining.push({
        procedure_id: procedure.id,
        doc_ids: nextDocIds,
        confidence: 1,
        reason,
        attached_docs: Array.isArray(existing?.attached_docs) ? existing?.attached_docs : [],
      });
    }

    try {
      writeProcedureDocsLinks(remaining);
      await reloadIndex();
      return {
        ok: true,
        mapping: {
          procedure_id: procedure.id,
          doc_ids: nextDocIds,
          confidence: nextDocIds.length > 0 ? 1 : undefined,
          reason: nextDocIds.length > 0 ? reason : undefined,
          attached_docs: Array.isArray(existing?.attached_docs) ? existing?.attached_docs : [],
        },
      };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "doc_links_update_failed" };
    }
  });

  /* ── Create procedure ──────────────────────────────── */
  app.post<{ Body: Partial<Procedure> }>("/api/admin/procedures", { preHandler: [requireRole("superadmin")] }, async (req, reply) => {
    const body = req.body;
    if (!body.id || !body.title_ar) {
      reply.code(400);
      return { error: "id and title_ar required" };
    }

    const dataDir = getDataDir();
    const procPath = path.join(dataDir, "procedures.jsonl");

    // Append to jsonl file
    const proc: Procedure = {
      id: body.id,
      tx_no: body.tx_no,
      source: body.source || "internal",
      title_ar: body.title_ar,
      title_en: body.title_en,
      summary_lb: body.summary_lb || "",
      eligibility: body.eligibility,
      requirements: body.requirements,
      steps: body.steps,
      where_to_apply: body.where_to_apply,
      fees: body.fees,
      timelines: body.timelines,
      tags: body.tags,
      faq_variants: body.faq_variants,
      version: "3.0.0",
      last_updated: new Date().toISOString(),
    };

    try {
      const line = JSON.stringify(proc);
      fs.appendFileSync(procPath, line + "\n", "utf-8");
      await reloadIndex(); // Force reload
      return { ok: true, procedure: proc };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Create failed" };
    }
  });

  /* ── Update procedure ──────────────────────────────── */
  app.put<{ Params: { id: string }; Body: Partial<Procedure> }>("/api/admin/procedures/:id", { preHandler: [requireRole("superadmin")] }, async (req, reply) => {
    const { id } = req.params;
    const body = req.body;
    const state = await loadIndex(false);

    // Find and update in state
    const idx = state.procedures.findIndex(p => p.id === id);
    if (idx === -1) {
      reply.code(404);
      return { error: "not_found" };
    }

    const updated: Procedure = {
      ...state.procedures[idx],
      ...body,
      last_updated: new Date().toISOString(),
    };

    state.procedures[idx] = updated;

    try {
      // Rewrite jsonl file
      const dataDir = getDataDir();
      const procPath = path.join(dataDir, "procedures.jsonl");
      const content = state.procedures.map(p => JSON.stringify(p)).join("\n");
      fs.writeFileSync(procPath, content + "\n", "utf-8");
      await reloadIndex(); // Force reload
      return { ok: true, procedure: updated };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Update failed" };
    }
  });

  /* ── Delete procedure ──────────────────────────────– */
  app.delete<{ Params: { id: string } }>("/api/admin/procedures/:id", { preHandler: [requireRole("superadmin")] }, async (req, reply) => {
    const { id } = req.params;
    const state = await loadIndex(false);

    const filtered = state.procedures.filter(p => p.id !== id);
    if (filtered.length === state.procedures.length) {
      reply.code(404);
      return { error: "not_found" };
    }

    try {
      const dataDir = getDataDir();
      const procPath = path.join(dataDir, "procedures.jsonl");
      const content = filtered.map(p => JSON.stringify(p)).join("\n");
      fs.writeFileSync(procPath, content + (filtered.length > 0 ? "\n" : ""), "utf-8");
      await reloadIndex();
      return { ok: true };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : "Delete failed" };
    }
  });

  /* ── Export to CSV ─────────────────────────────────── */
  app.get("/api/admin/procedures/export", async (req, reply) => {
    const state = await loadIndex(false);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", `attachment; filename="procedures_${new Date().toISOString().slice(0, 10)}.csv"`);

    const output: string[] = [];
    const headers = ["ID", "TX_No", "Source", "Title_AR", "Title_EN", "Summary", "Eligibility", "Requirements", "Steps", "Where_To_Apply", "Fees", "Timelines", "Tags", "Last_Updated"];
    output.push(headers.join(","));

    for (const p of state.procedures) {
      const row = [
        `"${p.id}"`,
        p.tx_no || "",
        p.source || "",
        `"${(p.title_ar || "").replace(/"/g, '""')}"`,
        `"${(p.title_en || "").replace(/"/g, '""')}"`,
        `"${(p.summary_lb || "").replace(/"/g, '""')}"`,
        `"${(p.eligibility || []).join("; ").replace(/"/g, '""')}"`,
        `"${(p.requirements || []).join("; ").replace(/"/g, '""')}"`,
        `"${(p.steps || []).join("; ").replace(/"/g, '""')}"`,
        `"${(p.where_to_apply || []).join("; ").replace(/"/g, '""')}"`,
        `"${(p.fees || []).join("; ").replace(/"/g, '""')}"`,
        `"${(p.timelines || []).join("; ").replace(/"/g, '""')}"`,
        `"${(p.tags || []).join("; ").replace(/"/g, '""')}"`,
        p.last_updated || "",
      ];
      output.push(row.join(","));
    }

    return output.join("\n");
  });

  /* ── Validate all procedures ───────────────────────── */
  app.post("/api/admin/procedures/validate", { preHandler: [requireRole("superadmin")] }, async (_req, reply) => {
    const state = await loadIndex(false);
    const errors: Array<{ id: string; error: string }> = [];

    for (const p of state.procedures) {
      if (!p.id) errors.push({ id: "?", error: "Missing id" });
      if (!p.title_ar) errors.push({ id: p.id, error: "Missing title_ar" });
      if (!p.summary_lb) errors.push({ id: p.id, error: "Missing summary_lb" });
      if (!p.source) errors.push({ id: p.id, error: "Missing source" });
      if ((p.title_ar || "").length < 10) errors.push({ id: p.id, error: "Title too short" });
      if ((p.title_ar || "").length > 200) errors.push({ id: p.id, error: "Title too long" });
      if ((p.summary_lb || "").length < 50) errors.push({ id: p.id, error: "Summary too short" });
      if ((p.eligibility || []).length === 0) errors.push({ id: p.id, error: "No eligibility criteria" });
    }

    return {
      valid: state.procedures.length - errors.length,
      errors: errors.length,
      details: errors,
    };
  });
}

