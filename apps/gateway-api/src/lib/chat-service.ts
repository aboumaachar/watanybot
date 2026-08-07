// PAYMENT_OVERRIDE_LIVE_PIPELINE_WIRING_V1: payment override wiring reviewed for live pipeline integration.
/**
 * Chat service — fetchChatResponseLegacy, fetchChatResponseAi, fetchChatResponse + helpers.
 * Extracted from server.ts. This is the core chat pipeline.
 */
import { request } from "undici";
import type { ActionIntent, CTAAction, ChatRequest, ChatResponse, HybridIntent, HybridRouteDecision, RecruitmentAnnouncement, WatanyModule } from "@watany/types";
import type { AiChatProvider, AiMessage, KbChunk } from "../ai/types";
import type { KbSearchResult } from "../kb/kb-nodes";
import { countArabic, normalizeArabic as sharedNormalizeArabic } from "@watany/shared/arabic";
import { resolvePaymentAnswer } from "../admin-payments/index.js";
import { resolveRecruitmentAnnouncements } from "../recruitment/index.js";
import { getProcedure, getProcedureByTitle, searchProcedures } from "../procedures/indexer";
import { searchDirectoryEntries } from "../routes/directory";
import { finalizeWatanyAgentAnswer, prepareWatanyAgentInput } from "../services/watany-ai-agent-bridge.js";
import { ctasToActionIntents, hydrateCtasFromResponse } from "../hybrid/cta-generator";
import { HybridRouteDecisionEngine } from "../hybrid/hybrid-route-engine";
import { CircuitBreakerError } from "./circuit-breaker.js";

/* ── Types for the legacy Python backend response ────────────── */
interface LegacyChatResponse {
  reply?: string;
  answer?: string;
  intents?: string[];
  action_intents?: string[];
  clarifying_question?: string | null;
  whatsapp_payloads?: unknown[];
  debug?: unknown;
}

/* ── Text helpers ────────────────────────────────────────────── */
export function fixMojibake(text: string): string {
  if (!text) return text;
  try {
    const decoded = Buffer.from(text, "latin1").toString("utf8");
    return countArabic(decoded) > countArabic(text) ? decoded : text;
  } catch {
    return text;
  }
}

export function normalizeArabic(text: string): string {
  return sharedNormalizeArabic(text);
}

function cleanDisplayText(text: string): string {
  return fixMojibake(text)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const DETERMINISTIC_REPLY_WORD_FIXUPS: ReadonlyArray<readonly [string, string]> = [
  ["الطلبب", "الطلب"],
  ["الطللب", "الطلب"],
  ["الماالية", "المالية"],
  ["الماللية", "المالية"],
  ["اللمالية", "المالية"],
  ["الماليةة", "المالية"],
  ["وززارة", "وزارة"],
  ["ووزارة", "وزارة"],
  ["المععاملة", "المعاملة"],
  ["المععامللة", "المعاملة"],
  ["المعامللة", "المعاملة"],
  ["المعااملة", "المعاملة"],
  ["الممعاملة", "المعاملة"],
  ["الممذكورة", "المذكورة"],
  ["المذكوورة", "المذكورة"],
  ["المسستندات", "المستندات"],
  ["الممستندات", "المستندات"],
  ["مستتندات", "مستندات"],
  ["اعاددة", "اعادة"],
  ["االطلب", "الطلب"],
  ["االمعاملة", "المعاملة"],
  ["االمراجعة", "المراجعة"],
  ["االمذكورة", "المذكورة"],
  ["االأساسية", "الأساسية"],
  ["الأأساسية", "الأساسية"],
  ["اللأساسية", "الأساسية"],
  ["اللطلب", "الطلب"],
  ["وزاررة", "وزارة"],
  ["إذذا", "إذا"],
  ["لههذه", "لهذه"],
];

const DETERMINISTIC_REPLY_PATTERN_FIXUPS: ReadonlyArray<readonly [RegExp, string]> = [
  [/لدى\s+لدى/g, "لدى"],
  [/لدى\s+ووزارة/g, "لدى وزارة"],
  [/وزارة\s+للمالية/g, "وزارة المالية"],
];

function applyDeterministicReplyFixups(text: string): string {
  const wordFixed = DETERMINISTIC_REPLY_WORD_FIXUPS.reduce(
    (cleaned, [from, to]) => cleaned.split(from).join(to),
    text,
  );

  return DETERMINISTIC_REPLY_PATTERN_FIXUPS.reduce(
    (cleaned, [pattern, replacement]) => cleaned.replace(pattern, replacement),
    wordFixed,
  );
}

function cleanupDeterministicReplyText(text: string): string {
  const cleaned = applyDeterministicReplyFixups(text
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([:؛،,.!?؟])\1+/g, "$1")
    .trim());

  return applyDeterministicReplyFixups(cleaned
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim())
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const FAMILY_PENSION_SIGNALS = [
  "ارمله",
  "مطلقه",
  "ابنه",
  "ابن",
  "زوجه",
  "والده",
  "والد",
  "دراسه",
  "يدرس",
  "بيدرس",
  "قاصر",
  "اعاقه",
  "عاجز",
] as const;

const PROCEDURE_CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const CLARIFICATION_SELECTION_TTL_MS = 10 * 60 * 1000;
const CLARIFICATION_OTHER_OPTION_LABEL = "شيء آخر غير مذكور";
const PROCEDURE_TITLE_ACTION_SIGNALS = [
  "اضافه",
  "طلب",
  "اعاده",
  "تعديل",
  "تجديد",
  "صرف",
  "منح",
  "نقل",
  "حذف",
  "استخراج",
  "تسجيل",
  "ربط",
  "فتح",
  "اقفال",
] as const;
const PROCEDURE_LOOKUP_BLOCKERS = [
  "كيف",
  "شو",
  "ما",
  "هل",
  "وين",
  "متي",
  "ليش",
  "كم",
  "شروط",
  "اوراق",
  "أوراق",
  "مستندات",
  "خطوات",
  "رسوم",
  "مهل",
  "مده",
  "مدة",
  "مكان",
  "تقديم",
  "معاش",
  "راتب",
  "منح",
  "منحه",
  "منحة",
  "مدارس",
  "مدرسه",
  "مدرسة",
  "جامعه",
  "جامعة",
  "وثائق",
] as const;
const AFFIRMATIVE_REPLIES = ["نعم", "اي", "أيوه", "ايوه", "أجل", "اكيد", "أكيد", "تمام", "موافق"] as const;
const NEGATIVE_REPLIES = ["لا", "لأ", "ليس", "مش", "ما بدي", "مو هاد", "مو هذا"] as const;
const NOW_ISO = () => new Date().toISOString();
const CONVERSATION_CONTEXT_TTL_MS = 20 * 60 * 1000;
const KB_PREFETCH_CACHE_TTL_MS = Number(process.env.AI_KB_PREFETCH_CACHE_TTL_MS || "120000");
const MAX_AI_CONTEXT_CHUNKS = Math.max(1, Number(process.env.AI_PROMPT_RAG_TOP_K || "4"));
const SALARY_MODULE_SIGNALS = [
  "معاشي",
  "راتبي",
  "احسب",
  "حساب",
  "حاسبه",
  "حاسبة",
  "درجه",
  "درجة",
  "خدمه",
  "خدمة",
  "اوسمه",
  "أوسمة",
  "ميدالي",
  "وسام",
] as const;
const BROAD_PENSION_FINANCE_SIGNALS = [
  "معاش",
  "تقاعد",
  "احتساب",
  "حساب",
  "مراجعه",
  "مراجعات",
  "تعويض",
  "صرف",
  "لجنه",
  "لجنة",
  "مالية",
] as const;
const CLARIFICATION_TRIGGER_SIGNALS = [
  "فصل",
  "فصل اكتر",
  "وضح",
  "شو يعني",
  "explain",
  "explain more",
  "كمل",
  "مش واضح",
  "other",
  "none of the above",
  "او شي تاني",
] as const;
const SAME_TOPIC_SIGNALS = ["نفس الموضوع", "عن نفس الموضوع", "نفس السؤال", "same topic"] as const;
const NEW_TOPIC_SIGNALS = ["موضوع جديد", "سؤال جديد", "new topic"] as const;
const SHORT_FOLLOWUP_PREFIXES = ["وين", "اين", "كيف", "شو", "متى", "قديش", "مين"] as const;
const SHORT_FOLLOWUP_KEYWORDS = ["شروط", "اوراق", "الاوراق", "وثائق", "مستندات", "المستندات", "مكان", "تقديم", "فصل", "وضح", "كمل", "مش واضح"] as const;
const DIRECTORY_LOOKUP_SIGNALS = ["رقم", "هاتف", "تلفون", "اتصال", "112"] as const;
const MOF_RETIRED_INFO_URL = "https://eservices.finance.gov.lb/RetiredInfo.aspx";
const SALARY_ATTESTATION_CTA_LABEL = "📄 إفادة الراتب الرسمية";

// ── Welfare & Social Affairs source query ───────────────────────────────────
const WELFARE_SOURCE_SIGNALS = [
  "قسم الرعاية",
  "جهاز الرعاية",
  "الرعاية والشؤون",
  "شؤون الاجتماعية",
  "شؤون الاجتماعي",
  "رعاية الاجتماعية",
  "رعاية العسكريين",
  "شؤون العسكريين",
  "رعاية المتقاعد",
  "ديوان شؤون",
] as const;

// ── Death notices query ─────────────────────────────────────────────────────
const DEATHS_QUERY_SIGNALS = [
  "وفيات",
  "نعوة",
  "نعوات",
  "نعوه",
  "نعي",
  "ورقة نعوة",
  "شهيد الجيش",
  "شهداء الجيش",
  "توفي عسكري",
  "توفي ضابط",
  "وفيات الجيش",
  "وفيات الأمن",
  "وفيات قوى الأمن",
] as const;

// ── ISF laws query ──────────────────────────────────────────────────────────
const ISF_LAWS_QUERY_SIGNALS = [
  "قوانين قوى الأمن",
  "قانون قوى الأمن",
  "نظام قوى الأمن",
  "تشريعات قوى الأمن",
  "قانون الأمن الداخلي",
  "قوانين الأمن الداخلي",
  "تشريعات الأمن الداخلي",
] as const;

// ── Useful links query ───────────────────────────────────────────────────────
const USEFUL_LINKS_QUERY_SIGNALS = [
  "روابط تهمك",
  "روابط مفيدة",
  "روابط رسمية",
  "مواقع رسمية",
  "مواقع مفيدة",
  "روابط مهمة",
  "روابط الجيش",
  "مواقع الجيش",
] as const;

const kbPrefetchCache = new Map<string, { expiresAt: number; result: KbPrefetchResult }>();

type PendingProcedureConfirmation = {
  procedureId: string;
  procedureTitle: string;
  procedureSummary: string;
  expiresAt: number;
};

type PendingClarificationOption = {
  label: string;
  query?: string;
  kind: "query" | "other";
};

type PendingClarificationSelection = {
  options: PendingClarificationOption[];
  clarifyingQuestion: string;
  expiresAt: number;
};

type AgentRetrievalHints = {
  scopeHints?: string[];
  tagIds?: string[];
};

type ConversationContext = {
  conversationId: string;
  originalQuestion?: string;
  originalIntent?: string;
  originalModule?: string;
  activeIntent?: HybridIntent;
  activeDestination?: WatanyModule;
  lastAnswer?: string;
  lastSuggestedActions?: string[];
  pendingClarification?: boolean;
  updatedAt: string;
  source?: "assistant" | "community" | "service" | "lookup";
  awaitingTopicDecision?: boolean;
  activeAnnouncementId?: string;
  userRole?: "public" | "user" | "admin" | "superadmin";
};

type ChatTimings = {
  adminOverrideMs?: number;
  announcementMs?: number;
  salaryMs?: number;
  paymentMs?: number;
  recruitmentMs?: number;
  kbMs?: number;
  openAiMs?: number;
  totalMs?: number;
  firstTokenMs?: number;
  completionMs?: number;
  cacheHit?: boolean;
};

type DeterministicResolution = {
  response: ChatResponse;
  module: string;
  preserveOriginalQuestion?: string;
};

type ProcedureConfirmationCandidate = {
  procedureId: string;
  procedureTitle: string;
  procedureSummary: string;
  displayLabel?: string;
};

type ProcedureLookupMatch =
  | { kind: "clarify"; candidates: ProcedureConfirmationCandidate[] }
  | { kind: "confirm"; candidate: ProcedureConfirmationCandidate }
  | { kind: "display"; candidate: ProcedureConfirmationCandidate };

type ProcedureLookupAlias = {
  requiredTermGroups: readonly (readonly string[])[];
  exactTitles?: readonly string[];
  exactProcedureIds?: readonly string[];
  optionLabels?: readonly string[];
};

const PROCEDURE_LOOKUP_ALIASES: readonly ProcedureLookupAlias[] = [
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابنه", "ابنة", "بنت", "البنت"], ["ارمله", "أرملة"]],
    exactProcedureIds: ["proc-0179"],
    optionLabels: ["معاش الابنة الأرملة"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابنه", "ابنة", "بنت", "البنت"], ["مطلقه", "مطلقة"]],
    exactProcedureIds: ["proc-0180"],
    optionLabels: ["معاش الابنة المطلقة"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابنه", "ابنة", "بنت", "البنت"], ["عزباء"]],
    exactProcedureIds: ["proc-0177"],
    optionLabels: ["معاش الابنة العزباء"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابنه", "ابنة", "بنت", "البنت"], ["قاصر"]],
    exactProcedureIds: ["proc-0178"],
    optionLabels: ["معاش الابنة العزباء القاصر"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابنه", "ابنة", "بنت", "البنت"]],
    exactProcedureIds: ["proc-0177", "proc-0178", "proc-0179", "proc-0180"],
    optionLabels: ["معاش الابنة العزباء", "معاش الابنة العزباء القاصر", "معاش الابنة الأرملة", "معاش الابنة المطلقة"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابن"], ["دراسه", "دراسة", "يدرس", "بيدرس"]],
    exactProcedureIds: ["proc-0181"],
    optionLabels: ["معاش الابن الذي يتابع الدراسة"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابن"], ["قاصر"]],
    exactProcedureIds: ["proc-0182"],
    optionLabels: ["معاش الابن القاصر"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابن"], ["معوق", "معاق", "اعاقه", "إعاقة"], ["جسد", "جسدي", "جسديا"]],
    exactProcedureIds: ["proc-0183"],
    optionLabels: ["معاش الابن المعوق جسدياً"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابن"], ["معوق", "معاق", "اعاقه", "إعاقة"], ["نفس", "نفسي", "نفسيا", "عقل", "عقلي", "عقليا"]],
    exactProcedureIds: ["proc-0184"],
    optionLabels: ["معاش الابن المعوق نفسياً أو عقلياً"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابن"], ["معوق", "معاق", "اعاقه", "إعاقة"]],
    exactProcedureIds: ["proc-0183", "proc-0184"],
    optionLabels: ["معاش الابن المعوق جسدياً", "معاش الابن المعوق نفسياً أو عقلياً"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["ابن"]],
    exactProcedureIds: ["proc-0181", "proc-0182", "proc-0183", "proc-0184"],
    optionLabels: ["معاش الابن الذي يتابع الدراسة", "معاش الابن القاصر", "معاش الابن المعوق جسدياً", "معاش الابن المعوق نفسياً أو عقلياً"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["والدين"]],
    exactProcedureIds: ["proc-0185", "proc-0186"],
    optionLabels: ["معاش الوالدة", "معاش الوالد"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["والده", "والدة"]],
    exactProcedureIds: ["proc-0185"],
    optionLabels: ["معاش الوالدة"],
  },
  {
    requiredTermGroups: [["معاش", "راتب"], ["والد"]],
    exactProcedureIds: ["proc-0186"],
    optionLabels: ["معاش الوالد"],
  },
  {
    requiredTermGroups: [["ابنه", "ابنة", "بنت", "البنت"], ["ارمله", "أرملة"], ["عاتق"]],
    exactTitles: ["اضافة الابنة الأرملة الى العاتق"],
  },
  {
    requiredTermGroups: [["ابنه", "ابنة", "بنت", "البنت"], ["مطلقه", "مطلقة"], ["عاتق"]],
    exactTitles: ["اضافة الابنة المطلقة على العاتق"],
  },
  {
    requiredTermGroups: [["ابنه", "ابنة", "بنت", "البنت"], ["عاتق"]],
    exactTitles: ["اضافة الابنة المطلقة على العاتق", "اضافة الابنة الأرملة الى العاتق"],
  },
  {
    requiredTermGroups: [["والدين", "والد", "والدة"], ["عاتق"], ["متقاعد", "تقاعد"]],
    exactTitles: ["اجراءات لضمان الوالدين على عاتق العسكري المتقاعد"],
  },
  {
    requiredTermGroups: [["والدين", "والد", "والدة"], ["عاتق"], ["خدمه", "خدمة"], ["فعليه", "فعلية"]],
    exactTitles: ["اجراءات ضمان الوالدين على عاتق العسكري في الخدمة الفعلية"],
  },
  {
    requiredTermGroups: [["والدين", "والد", "والدة"], ["عاتق"]],
    exactTitles: [
      "اجراءات لضمان الوالدين على عاتق العسكري المتقاعد",
      "اجراءات ضمان الوالدين على عاتق العسكري في الخدمة الفعلية",
    ],
  },
  {
    requiredTermGroups: [["زوجه", "زوجة"], ["عاتق"], ["ترك", "تركت", "العمل", "شغل"]],
    exactTitles: ["اعادة الزوجة الى العاتق بعد ترك العمل"],
  },
  {
    requiredTermGroups: [["زوجه", "زوجة"], ["ضمان"], ["طبابه", "طبابة"]],
    exactTitles: ["نقل ضمان الزوجة للطبابة فقط الى عاتق الجيش"],
  },
  {
    requiredTermGroups: [["زوجه", "زوجة"], ["عاتق"]],
    exactTitles: [
      "اعادة الزوجة الى العاتق بعد ترك العمل",
      "نقل ضمان الزوجة للطبابة فقط الى عاتق الجيش",
    ],
  },
  {
    requiredTermGroups: [["ابن"], ["معوق", "معاق", "اعاقه", "إعاقة"]],
    exactTitles: ["اجراءات تنظيم بطاقة للابن المعوق"],
  },
  {
    requiredTermGroups: [["مولود", "مواليد"], ["جديد", "حديث", "حديثا", "تسجيل", "سجل", "اضافه", "إضافة"]],
    exactTitles: ["تسجيل مولود حديثا ابن عسكري متقاعد"],
  },
  {
    requiredTermGroups: [["مساعده", "مساعدة", "مساعدات", "منحه", "منحة"], ["مدرسيه", "مدرسية"], ["متقاعد", "متقاعدين", "تقاعد"]],
    exactTitles: ["اجراءات لرفع طلب مساعد مدرسية لمتقاعدي الجيش"],
    optionLabels: ["إجراءات لرفع طلب المساعدات المدرسية لمتقاعدي الجيش"],
  },
  {
    requiredTermGroups: [["نسبه", "نسبة"], ["مساعده", "مساعدة", "مساعدات", "منحه", "منحة"], ["مدرسيه", "مدرسية"]],
    exactTitles: ["طلب نسبة قيمة المنحة المدرسية"],
    optionLabels: ["طلب نسبة قيمة المساعدات المدرسية"],
  },
  {
    requiredTermGroups: [["الغاء", "إلغاء"], ["تنازل"], ["مساعده", "مساعدة", "مساعدات", "منحه", "منحة"], ["مدرسيه", "مدرسية"]],
    exactTitles: ["طلب إلغاء التنازل عن المنحة المدرسية"],
    optionLabels: ["طلب إلغاء التنازل عن المساعدات المدرسية"],
  },
  {
    requiredTermGroups: [["تنازل"], ["مساعده", "مساعدة", "مساعدات", "منحه", "منحة"], ["مدرسيه", "مدرسية"]],
    exactTitles: ["طلب تنازل عن قيمة المنحة المدرسية"],
    optionLabels: ["طلب تنازل عن قيمة المساعدات المدرسية"],
  },
  {
    requiredTermGroups: [["نماذج", "نموذج"], ["مساعده", "مساعدة", "مساعدات", "منحه", "منحة"], ["مدرسيه", "مدرسية"]],
    exactTitles: ["نماذج طلبات المساعدات المدرسية في الجيش"],
    optionLabels: ["نماذج طلبات المساعدات المدرسية في الجيش"],
  },
  {
    requiredTermGroups: [["مساعده", "مساعدة", "مساعدات", "منحه", "منحة"], ["مدرسيه", "مدرسية"]],
    exactTitles: [
      "اجراءات لرفع طلب مساعد مدرسية لمتقاعدي الجيش",
      "نماذج طلبات المساعدات المدرسية في الجيش",
      "طلب نسبة قيمة المنحة المدرسية",
      "طلب تنازل عن قيمة المنحة المدرسية",
      "طلب إلغاء التنازل عن المنحة المدرسية",
    ],
    optionLabels: [
      "إجراءات لرفع طلب المساعدات المدرسية لمتقاعدي الجيش",
      "نماذج طلبات المساعدات المدرسية في الجيش",
      "طلب نسبة قيمة المساعدات المدرسية",
      "طلب تنازل عن قيمة المساعدات المدرسية",
      "طلب إلغاء التنازل عن المساعدات المدرسية",
    ],
  },
] as const;

async function resolveProcedureConfirmationCandidate(
  procedureId: string,
  fallbackTitle?: string,
  displayLabel?: string,
): Promise<ProcedureConfirmationCandidate | null> {
  const procedure = await getProcedure(procedureId);
  if (!procedure) {
    if (!fallbackTitle) return null;
    return {
      procedureId,
      procedureTitle: cleanDisplayText(fallbackTitle),
      procedureSummary: "",
      displayLabel: displayLabel ? cleanDisplayText(displayLabel) : undefined,
    };
  }

  return {
    procedureId: procedure.id,
    procedureTitle: cleanDisplayText(procedure.title_ar || fallbackTitle || procedure.id),
    procedureSummary: cleanDisplayText(procedure.summary_lb || ""),
    displayLabel: displayLabel ? cleanDisplayText(displayLabel) : undefined,
  };
}

async function resolveProcedureCandidateByExactTitle(
  title: string,
  displayLabel?: string,
): Promise<ProcedureConfirmationCandidate | null> {
  const exactProcedure = await getProcedureByTitle(title);
  if (exactProcedure) {
    return {
      procedureId: exactProcedure.id,
      procedureTitle: cleanDisplayText(exactProcedure.title_ar || title),
      procedureSummary: cleanDisplayText(exactProcedure.summary_lb || ""),
      displayLabel: displayLabel ? cleanDisplayText(displayLabel) : undefined,
    };
  }

  const normalizedTitle = normalizeArabic(cleanDisplayText(title));
  const hits = await searchProcedures(title, 10);
  const exactHit = hits.find((hit) => normalizeArabic(cleanDisplayText(hit.title_clean || hit.title_ar || "")) === normalizedTitle);
  if (!exactHit) return null;

  return resolveProcedureConfirmationCandidate(exactHit.id, title, displayLabel);
}

function dedupeProcedureCandidates(candidates: ProcedureConfirmationCandidate[]): ProcedureConfirmationCandidate[] {
  const unique = new Map<string, ProcedureConfirmationCandidate>();
  for (const candidate of candidates) {
    const key = normalizeArabic(candidate.procedureId || candidate.procedureTitle);
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return [...unique.values()];
}

function isExactProcedureTitleQuery(query: string, candidate: ProcedureConfirmationCandidate): boolean {
  const normalizedQuery = normalizeArabic(cleanDisplayText(query));
  if (normalizedQuery === normalizeArabic(candidate.procedureTitle)) return true;
  return Boolean(candidate.displayLabel) && normalizedQuery === normalizeArabic(candidate.displayLabel || "");
}

function getMatchingProcedureLookupAlias(query: string): ProcedureLookupAlias | null {
  const normalized = normalizeArabic(cleanDisplayText(query));
  return PROCEDURE_LOOKUP_ALIASES.find((alias) => alias.requiredTermGroups.every((termGroup) => termGroup.some((term) => normalized.includes(normalizeArabic(term))))) || null;
}

function getNormalizedTerms(text: string): string[] {
  return text.split(/[\s\-_/.,;:!?()[\]{}"'،؛؟]+/).filter(Boolean);
}

function hasSignalTerm(terms: string[], signal: string): boolean {
  return terms.some((term) => term === signal || term.endsWith(signal));
}

function extractFamilyPensionSignals(queryNorm: string): string[] {
  const terms = getNormalizedTerms(queryNorm);
  return FAMILY_PENSION_SIGNALS.filter((signal, index, items) => hasSignalTerm(terms, signal) && items.indexOf(signal) === index);
}

function isAmbiguousBaseBeneficiaryQuery(queryNorm: string): boolean {
  const terms = getNormalizedTerms(queryNorm);
  const mentionsDaughter = hasSignalTerm(terms, "ابنه");
  const mentionsDaughterQualifier = hasSignalTerm(terms, "ارمله") || hasSignalTerm(terms, "مطلقه");
  if (mentionsDaughter && !mentionsDaughterQualifier) return true;

  const mentionsSon = hasSignalTerm(terms, "ابن");
  const mentionsSonQualifier = hasSignalTerm(terms, "دراسه") || hasSignalTerm(terms, "قاصر") || hasSignalTerm(terms, "اعاقه") || hasSignalTerm(terms, "عاجز");
  if (mentionsSon && !mentionsSonQualifier) return true;

  return false;
}

function isSpecificFamilyPensionQuery(queryNorm: string): boolean {
  const hasPensionSignal = /(تقاعد|معاش|راتب|متقاعد)/.test(queryNorm);
  const hasBroadTransactionSignal = /(معامل|طلب|طلبات|اجراء|اجراءات|معامله|مستند|وثائق|اوراق)/.test(queryNorm);
  return hasPensionSignal
    && !hasBroadTransactionSignal
    && !isAmbiguousBaseBeneficiaryQuery(queryNorm)
    && extractFamilyPensionSignals(queryNorm).length > 0;
}

function isFamilyPensionQuery(queryNorm: string): boolean {
  const hasPensionSignal = /(تقاعد|معاش|راتب|متقاعد)/.test(queryNorm);
  return hasPensionSignal && extractFamilyPensionSignals(queryNorm).length > 0;
}

function chunkMatchesSpecificFamilyPensionQuery(queryNorm: string, chunk: KbChunk): boolean {
  const familySignals = extractFamilyPensionSignals(queryNorm);
  if (familySignals.length === 0) return false;

  const searchableText = normalizeArabic(`${getChunkTitle(chunk)}\n${chunk.text}`);
  const hasPensionSignal = /(تقاعد|معاش|راتب|متقاعد)/.test(searchableText);

  return hasPensionSignal && familySignals.every((signal) => searchableText.includes(signal));
}

function findDominantSpecificFamilyPensionChunk(queryNorm: string, chunks: KbChunk[]): KbChunk | null {
  return chunks.find((chunk, index) => index < 3 && (chunk.score ?? 0) >= 12 && chunkMatchesSpecificFamilyPensionQuery(queryNorm, chunk)) || null;
}

function hasDominantTopTitle(chunks: KbChunk[]): boolean {
  if (chunks.length < 2) return false;

  const topTitleNorm = normalizeArabic(getChunkTitle(chunks[0]));
  if (!topTitleNorm) return false;

  const dominantCount = chunks
    .slice(0, 3)
    .filter((chunk) => normalizeArabic(getChunkTitle(chunk)) === topTitleNorm)
    .length;

  return dominantCount >= 2 && (chunks[0].score ?? 0) >= 18;
}

function shouldForceGenericTopicClarification(query: string): boolean {
  const cleaned = cleanDisplayText(query);
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > 4) return false;

  const queryNorm = normalizeArabic(cleaned);
  if (isSpecificFamilyPensionQuery(queryNorm)) return false;

  return [
    /(تقاعد|معاش|وفاه|متوفي|شهيد|ورثه|ارمله|زوجه|ابنه|ابن|والده|والد|والدين)/,
    /(طبابه|استشفاء|عاتق|ضمان)/,
    /(مدارس|مدرسه|مدرسية|مدرسيه|مدرس|جامعه|جامعة|دراسه|دراسة)/,
    /(منح|منحه|منحة)/,
  ].some((pattern) => pattern.test(queryNorm));
}

function shouldForceImmediateTopicClarification(query: string): boolean {
  const words = cleanDisplayText(query).split(/\s+/).filter(Boolean);
  if (words.length !== 1) return false;
  if (getMatchingProcedureLookupAlias(query)) return false;
  return shouldForceGenericTopicClarification(query)
    || /(اوراق|أوراق|وثائق|مستندات)/.test(query);
}

type PaymentTopicKey = "salary" | "pension" | "grant" | "compensation";

const PAYMENT_TIMING_OPTIONS: ReadonlyArray<{ key: PaymentTopicKey; label: string; query: string }> = [
  { key: "salary", label: "موعد دفع الراتب الشهري", query: "موعد دفع الراتب الشهري" },
  { key: "pension", label: "موعد دفع المعاش التقاعدي", query: "موعد دفع المعاش التقاعدي" },
  { key: "grant", label: "موعد دفع المساعدات المدرسية", query: "موعد دفع المنحة المدرسية" },
  { key: "compensation", label: "موعد دفع التعويضات والمساعدات", query: "موعد دفع التعويضات والمساعدات" },
] as const;

function getPaymentTopicKeys(queryNorm: string): PaymentTopicKey[] {
  const matches = new Set<PaymentTopicKey>();
  if (/(راتب|رواتب|راتبي|قبض|بقبض)/.test(queryNorm)) matches.add("salary");
  if (/(معاش|تقاعد|متقاعد)/.test(queryNorm)) matches.add("pension");
  if (/(منح|منحه|منحة|مدرس|مدرسي|جامع|دراسه|دراسة)/.test(queryNorm)) matches.add("grant");
  if (/(تعويض|تعويضات|مساعده|مساعدة|مستحقات)/.test(queryNorm)) matches.add("compensation");
  return [...matches];
}

function isPaymentTimingQuery(query: string): boolean {
  const queryNorm = normalizeArabic(cleanDisplayText(query));
  const hasTimeSignal = /(متي|امتي|ايمتي|موعد|وقت)/.test(queryNorm);
  const hasPaymentSignal = /(دفع|الدفع|قبض|بقبض|راتب|رواتب|معاش|تقاعد|منح|منحه|منحة|تعويض|تعويضات|مساعدة|مستحقات)/.test(queryNorm);
  return hasTimeSignal && hasPaymentSignal;
}

function shouldClarifyPaymentTimingQuery(query: string): boolean {
  if (!isPaymentTimingQuery(query)) return false;
  return getPaymentTopicKeys(normalizeArabic(cleanDisplayText(query))).length !== 1;
}

function buildPaymentTimingClarificationResponse(query: string): ChatResponse {
  const queryNorm = normalizeArabic(cleanDisplayText(query));
  const hintedTopics = new Set(getPaymentTopicKeys(queryNorm));
  const options = PAYMENT_TIMING_OPTIONS.filter((option) => hintedTopics.size === 0 || hintedTopics.has(option.key));
  const resolvedOptions = options.length > 1 ? options : PAYMENT_TIMING_OPTIONS;
  const choiceOptions = buildClarificationOptionsWithOther(resolvedOptions.map((option) => option.label), (option) => option);
  const numberedOptions = choiceOptions.map((option, index) => `${index + 1}. ${option}`).join("\n");

  return {
    reply: `حتى أحدد المقصود بالدفع بدقة، اختر نوع الدفعة أو الاستحقاق الذي تريد معرفة موعده:\n${numberedOptions}`,
    intents: [
      ...resolvedOptions.map((option) => ({ type: "suggest_query" as const, label: option.label, query: option.query })),
      { type: "suggest_query" as const, label: CLARIFICATION_OTHER_OPTION_LABEL, query: CLARIFICATION_OTHER_OPTION_LABEL },
    ],
    clarifying_question: "أي دفعة أو استحقاق تقصد تحديداً؟",
    menu: choiceOptions,
    debug: {
      payment_timing_clarification: true,
      payment_timing_options: resolvedOptions.map((option) => option.label),
    },
  };
}

function buildPaymentAnswerResponse(query: string): ChatResponse | null {
  const paymentOverride = resolvePaymentAnswer(query);
  if (!paymentOverride) return null;

  const announcements = paymentOverride.announcements
    .map((announcement) => cleanDisplayText(announcement.text))
    .filter(Boolean);
  const parts = [cleanDisplayText(paymentOverride.answer.value)];
  if (announcements.length > 0) {
    const announcementLines = announcements.map((item) => `• ${item}`).join("\n");
    parts.push(`إعلانات مرتبطة:\n${announcementLines}`);
  }

  return {
    reply: parts.join("\n\n"),
    intents: [],
    debug: {
      payment_answer: true,
      payment_question: paymentOverride.question.text,
      payment_score: paymentOverride.score,
    },
  };
}

function isSalaryModuleQuery(query: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(query));
  if (!normalized) return false;
  if (isFamilyPensionQuery(normalized)) return false;

  const hasSalarySignal = SALARY_MODULE_SIGNALS.some((signal) => normalized.includes(signal));
  const hasDirectAsk = /(كم|قديش|احسب|حساب|حاسبه|حاسبة|بدي اعرف|بدي احسب)/.test(normalized);
  const mentionsPensionSalary = /(معاشي|راتبي|راتب التقاعد|معاش التقاعد|معاش تقاعد|راتب تقاعد)/.test(normalized);
  return hasSalarySignal && (hasDirectAsk || mentionsPensionSalary);
}

function isSalaryAttestationQuery(query: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(query));
  if (!normalized) return false;
  if (isFamilyPensionQuery(normalized)) return false;

  const hasExactAttestationPhrase = /(افاده\s*(الراتب|راتب|المعاش|معاش)|شهاده\s*(الراتب|راتب|المعاش|معاش)|salary attestation|pension attestation|retiredinfo)/i.test(normalized);
  if (hasExactAttestationPhrase) return true;

  const hasAttestationWord = /(افاده|شهاده|attestation|certificate)/i.test(normalized);
  const hasSalaryContext = /(راتب|معاش|تقاعد|متقاعد|رقم\s*التقاعد|retiredinfo|pension|salary)/i.test(normalized);
  const mentionsOfficialSource = /(رسمي|رسميه|وزارة\s*الماليه|وزارة\s*المالية|ماليه|mof)/i.test(normalized);

  return hasAttestationWord && hasSalaryContext && mentionsOfficialSource;
}

function isBroadPensionFinanceQuery(query: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(query));
  if (!normalized) return false;
  if (isFamilyPensionQuery(normalized)) return false;

  const hasPensionSignal = normalized.includes("معاش")
    && (normalized.includes("تقاعد") || normalized.includes("تعويض") || normalized.includes("صرف"));
  if (!hasPensionSignal) return false;

  const hasBroadFinanceSignal = BROAD_PENSION_FINANCE_SIGNALS.some((signal) => normalized.includes(signal));
  const asksForOverview = /(كيف|شو|ما هي|ماهي|بدي افهم|بدي اعرف|مختصر|اساس|احتساب|حساب|مراجعات|مراجعه|وين|علاقه|فرق|شرح|دور)/.test(normalized);

  return hasBroadFinanceSignal && asksForOverview;
}

function buildSalaryModuleResponse(): ChatResponse {
  return {
    reply: "لحساب المعاش عبر الحاسبة الحالية، افتح حاسبة المعاش ثم أدخل الرتبة العسكرية والدرجة وسنوات الخدمة والحالة العائلية والأوسمة الموجودة لديك.",
    intents: [
      {
        type: "open_module",
        moduleId: "salary",
        label: "فتح حاسبة المعاش",
      },
    ],
    debug: {
      salary_module: true,
    },
  };
}

function buildSalaryAttestationResponse(): ChatResponse {
  return {
    reply: [
      "إفادة الراتب الرسمية أصبحت متاحة فقط عبر خدمة وزارة المالية الرسمية.",
      "موطني لا يعبّي هذه الخدمة ولا يعرض نتيجتها داخله بعد الآن، لذلك افتح المصدر الرسمي مباشرةً من الزر التالي.",
      "قبل المتابعة، جهّز الاسم واسم الأب والشهرة ورقم التقاعد كما هي معتمدة لدى وزارة المالية."
    ].join("\n\n"),
    intents: [],
    ctas: [
      {
        id: "salary-attestation-official",
        label: SALARY_ATTESTATION_CTA_LABEL,
        type: "share",
        payload: { url: MOF_RETIRED_INFO_URL },
      },
      {
        id: "salary-calculator",
        label: "🧮 حاسبة المعاش",
        type: "open_service_flow",
        target: "salary",
      },
      {
        id: "other",
        label: "أو شي تاني",
        type: "reply",
        payload: { query: "أو شي تاني" },
      },
    ],
    debug: {
      salary_module: true,
      salary_attestation: true,
      external_only: true,
    },
  };
}

function buildBroadPensionFinanceResponse(): ChatResponse {
  return {
    reply: [
      "بصورة مختصرة، احتساب المعاش التقاعدي يرتكز على الراتب الأخير المحتسب قانوناً، سنوات الخدمة المقبولة للتصفية، وأي عناصر إضافية تؤثر على التصفية أو تعويض الصرف بحسب الحالة.",
      "إذا أردت الفهم السريع، ابدأ من الرتبة والدرجة وسنوات الخدمة، ثم راجع ما إذا كانت هناك أوسمة أو عناصر مالية مؤثرة قبل أي تصفية نهائية.",
      "أما المراجعات الإدارية الأساسية فتكون عادةً مع المرجع المالي المختص أو لجنة التقاعد عندما تكون المعاملة بحاجة إلى تخصيص أو تدقيق أو تصفية رسمية.",
      "إذا أردت تقديراً أولياً الآن، افتح حاسبة المعاش وأدخل البيانات الأساسية قبل أي مراجعة لدى وزارة المالية."
    ].join("\n\n"),
    intents: [
      {
        type: "open_module",
        moduleId: "salary",
        label: "فتح حاسبة المعاش",
      },
    ],
    debug: {
      salary_module: true,
      broad_pension_finance: true,
    },
  };
}

function buildRecruitmentAnnouncementBlock(
  announcement: RecruitmentAnnouncement,
  includeDetails: boolean,
): string {
  const lines = [`${cleanDisplayText(announcement.apparatusName)}: ${cleanDisplayText(announcement.title)}`];

  if (announcement.announcementNumber) {
    lines.push(`رقم الإعلان: ${cleanDisplayText(announcement.announcementNumber)}`);
  }

  if (announcement.startDate || announcement.endDate) {
    lines.push(`فترة التقديم: ${formatAnnouncementDate(announcement.startDate)} حتى ${formatAnnouncementDate(announcement.endDate)}`);
  }

  if (includeDetails && announcement.eligibleCategories.length > 0) {
    lines.push(`الفئات المؤهلة: ${announcement.eligibleCategories.map((item) => cleanDisplayText(item)).join("، ")}`);
  }

  if (includeDetails && announcement.conditions.length > 0) {
    lines.push(`: ${announcement.conditions.map((item) => cleanDisplayText(item)).join("، ")}`);
  }

  if (includeDetails && announcement.requiredDocuments.length > 0) {
    lines.push(`المستندات المطلوبة: ${announcement.requiredDocuments.map((item) => cleanDisplayText(item)).join("، ")}`);
  }

  if (includeDetails && announcement.applicationLocation) {
    lines.push(`مكان التقديم: ${cleanDisplayText(announcement.applicationLocation)}`);
  }

  if (includeDetails && announcement.applicationMethod) {
    lines.push(`: ${cleanDisplayText(announcement.applicationMethod)}`);
  }

  if (announcement.sourceName || announcement.sourceUrl) {
    const sourceLabel = [announcement.sourceName, announcement.sourceUrl]
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => cleanDisplayText(entry))
      .join(" - ");
    if (sourceLabel) {
      lines.push(`المصدر: ${sourceLabel}`);
    }
  }

  if (announcement.notes) {
    lines.push(`ملاحظات: ${cleanDisplayText(announcement.notes)}`);
  }

  return cleanupDeterministicReplyText(lines.join("\n"));
}

function buildRecruitmentResponse(query: string): ChatResponse | null {
  const resolved = resolveRecruitmentAnnouncements(query);
  if (!resolved) return null;

  if (resolved.announcements.length === 0) {
    return {
      reply: resolved.kind === "announcement"
        ? "حالياً ما في إعلان تطويع منشور على النظام. عند نشر أي إعلان رسمي جديد سأعرضه لك مباشرة."
        : "حالياً ما في إعلان تطويع منشور يطابق سؤالك أو الجهة المطلوبة.",
      intents: [],
      debug: {
        recruitment: true,
        recruitment_kind: resolved.kind,
        recruitment_score: resolved.score,
        recruitment_matches: resolved.matchedApparatus,
        recruitment_count: 0,
      },
    };
  }

  const includeDetails = resolved.kind === "recruitment";
  const intro = resolved.kind === "announcement"
    ? "هذه التعاميم الرسمية المنشورة حالياً:"
    : "هذه التفاصيل المتوفرة عن إعلان التطويع الحالي:";
  const blocks = resolved.announcements.map((announcement) => buildRecruitmentAnnouncementBlock(announcement, includeDetails));
  const firstSourceUrl = resolved.announcements.find((announcement) => announcement.sourceUrl)?.sourceUrl;

  return {
    reply: cleanupDeterministicReplyText([intro, ...blocks].join("\n\n")),
    intents: firstSourceUrl
      ? [{ type: "open_url", url: firstSourceUrl, label: "المصدر الرسمي" }]
      : [],
    debug: {
      recruitment: true,
      recruitment_kind: resolved.kind,
      recruitment_score: resolved.score,
      recruitment_matches: resolved.matchedApparatus,
      recruitment_count: resolved.announcements.length,
    },
  };
}

function isDirectoryLookupQuery(query: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(query));
  if (!normalized) return false;
  return DIRECTORY_LOOKUP_SIGNALS.some((signal) => normalized.includes(signal));
}

function buildDirectoryLookupResponse(repoRootPath: string, query: string): ChatResponse | null {
  if (!isDirectoryLookupQuery(query)) return null;

  const matches = searchDirectoryEntries(repoRootPath, query, 3).filter((entry) => entry.phone);
  if (matches.length === 0) return null;

  const lines = ["هذه أرقام الاتصال الأقرب لطلبك:"];
  const intents: ActionIntent[] = [];

  for (const entry of matches) {
    const details = [entry.phone, entry.note].filter(Boolean).join(" — ");
    const line = "• " + cleanDisplayText(entry.name) + (details ? ": " + cleanDisplayText(details) : "");
    lines.push(line);
    intents.push({
      type: "call_phone",
      label: `اتصل بـ ${cleanDisplayText(entry.name)}`,
      phone: cleanDisplayText(entry.phone || ""),
    });
  }

  return {
    reply: cleanupDeterministicReplyText(lines.join("\n")),
    intents,
    debug: {
      directory_lookup: true,
      directory_matches: matches.map((entry) => cleanDisplayText(entry.name)),
    },
  };
}

function isWelfareSourceQuery(query: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(query));
  if (!normalized) return false;
  // Must mention welfare/social-affairs device AND be an informational query (not a specific procedure)
  const hasWelfareSignal = WELFARE_SOURCE_SIGNALS.some((signal) => normalized.includes(normalizeArabic(signal)));
  if (!hasWelfareSignal) return false;
  // Exclude specific procedure action queries (they should fall through to procedure lookup)
  const hasActionSignal = /(اضافه|اضافة|طلب|تجديد|تسجيل|استخراج|نقل|صرف)/.test(normalized);
  return !hasActionSignal;
}

function buildWelfareSourceResponse(): ChatResponse {
  return {
    reply: cleanupDeterministicReplyText([
      "جهاز الرعاية والشؤون الاجتماعية للعسكريين القدامى",
      "جهاز متخصص تابع لوزارة الدفاع الوطني — قيادة الجيش اللبناني، يوفر الرعاية الشاملة للعسكريين القدامى والشهداء والمعاقين والمفقودين وعائلاتهم.",
      "أبرز خدماته:",
      "• المساعدات المالية والاجتماعية للفئات المستحقة",
      "• المساعدات المدرسية لأبناء العسكريين (مراحل أساسية وثانوية وجامعية)",
      "• قسائم المحروقات الشهرية للضباط المتقاعدين وعائلات الشهداء",
      "• إعفاء جزئي أو كامل من أقساط الخطوط الهاتفية",
      "• زيارات عائلات الشهداء والمفقودين بمناسبة ذكرى الاستشهاد",
      "• إصدار التصاريح والشهادات المتعلقة بالعسكريين القدامى",
      "للاستفسار أو التواصل: 01-288047 / 01-288408",
    ].join("\n")),
    intents: [
      {
        type: "call_phone",
        label: "الاتصال بجهاز الرعاية والشؤون",
        phone: "01-288047",
      },
      {
        type: "suggest_query",
        label: "المساعدات المدرسية",
        query: "اجراءات لرفع طلب مساعد مدرسية لمتقاعدي الجيش",
      },
      {
        type: "suggest_query",
        label: "قسائم المحروقات",
        query: "استفادة الضابط المتقاعد من قسائم المحروقات",
      },
      {
        type: "suggest_query",
        label: "تجديد بطاقة الخدمات",
        query: "تجديد بطاقات الخدمات الاجتماعية لدى الجيش",
      },
    ],
    debug: {
      welfare_source: true,
      source_document: "تعليمات الشؤون والرعاية الاجتماعية للعسكريين القدامى",
      authority: "وزارة الدفاع الوطني - قيادة الجيش",
    },
  };
}

// ── Deaths query ─────────────────────────────────────────────────────────────
function isDeathsQuery(query: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(query));
  if (!normalized) return false;
  return DEATHS_QUERY_SIGNALS.some((signal) => normalized.includes(normalizeArabic(signal)));
}

function buildDeathsResponse(): ChatResponse {
  return {
    reply: cleanupDeterministicReplyText(
      [
        "وفيات العسكريين المتقاعدين",
        "تُنشر في هذا القسم وفيات العسكريين المتقاعدين من الجيش اللبناني وقوى الأمن الداخلي وسائر الأجهزة الأمنية، بعد التحقق منها من المصادر الرسمية.",
        "• لعرض آخر الوفيات المنشورة: افتح قسم الوفيات من القائمة الجانبية",
        "• المصادر: قيادة الجيش اللبناني — قوى الأمن الداخلي — مدخلات إدارية موثقة",
      ].join("\n"),
    ),
    intents: [
      {
        type: "open_module",
        moduleId: "deaths",
        label: "فتح قسم الوفيات",
      },
    ],
    debug: {
      deaths_query: true,
      source: "official_deaths_registry",
    },
  };
}

function isObituaryUploadQuery(query: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(query));
  if (!normalized) return false;
  const hasUploadSignal = /(رفع|ارسل|أرسل|نشر|اضافه|إضافة|تسجيل|ادخال|إدخال|ابلاغ|إبلاغ)/.test(normalized);
  const hasObituarySignal = /(نعوة|نعوه|نعي|وفاة|إشعار وفاة)/.test(normalized);
  return hasUploadSignal && hasObituarySignal;
}

function buildObituaryUploadResponse(): ChatResponse {
  // Product rule: death notice submission is admin-only. Users cannot submit or upload.
  return {
    reply: cleanupDeterministicReplyText(
      [
        "نشر وفيات العسكريين — خدمة إدارية",
        "إضافة ونشر وفيات العسكريين المتقاعدين هي خدمة إدارية حصراً ولا تتوفر للمستخدمين العاديين.",
        "تُضاف الوفيات من قِبَل الإدارة بعد التحقق من المصادر الرسمية (قيادة الجيش اللبناني، قوى الأمن الداخلي).",
        "• لعرض الوفيات المنشورة: افتح قسم الوفيات من القائمة الجانبية",
      ].join("\n"),
    ),
    intents: [
      {
        type: "open_module",
        moduleId: "deaths",
        label: "عرض الوفيات المنشورة",
      },
    ],
    debug: {
      obituary_upload_blocked: true,
      reason: "admin_only_feature",
    },
  };
}

// ── ISF laws query ────────────────────────────────────────────────────────────
function isIsfLawsQuery(query: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(query));
  if (!normalized) return false;
  return ISF_LAWS_QUERY_SIGNALS.some((signal) => normalized.includes(normalizeArabic(signal)));
}

function buildIsfLawsResponse(): ChatResponse {
  return {
    reply: cleanupDeterministicReplyText(
      [
        "قوانين قوى الأمن الداخلي",
        "قوى الأمن الداخلي تتبع وزارة الداخلية والبلديات وتنظمها جملة من القوانين والأنظمة الأساسية:",
        "• قانون قوى الأمن الداخلي رقم 17 تاريخ 6/9/1990: يُنشئ المؤسسة ويحدد مهامها وهيكلها",
        "• نظام تقاعد عناصر قوى الأمن الداخلي: يُنظم شروط التقاعد ومعاش المتقاعدين وحقوق الأسرة",
        "• نظام الانضباط: يُحدد الواجبات التأديبية والعقوبات",
        "للاطلاع على النصوص الكاملة: isf.gov.lb",
      ].join("\n"),
    ),
    intents: [
      {
        type: "open_url",
        url: "https://isf.gov.lb/",
        label: "موقع قوى الأمن الداخلي الرسمي",
      },
      {
        type: "suggest_query",
        label: "نظام تقاعد قوى الأمن",
        query: "نظام تقاعد عناصر قوى الأمن الداخلي",
      },
    ],
    debug: {
      isf_laws_query: true,
      source: "isf_laws_index",
    },
  };
}

// ── Useful links query ────────────────────────────────────────────────────────
function isUsefulLinksQuery(query: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(query));
  if (!normalized) return false;
  return USEFUL_LINKS_QUERY_SIGNALS.some((signal) => normalized.includes(normalizeArabic(signal)));
}

function buildUsefulLinksResponse(): ChatResponse {
  return {
    reply: cleanupDeterministicReplyText(
      [
        "روابط تهمك — مواقع رسمية مفيدة",
        "• الجيش اللبناني: lebarmy.gov.lb",
        "• قوى الأمن الداخلي: isf.gov.lb",
        "• الأمن العام: general-security.gov.lb",
        "• وزارة المالية: finance.gov.lb",
        "• وزارة الصحة العامة: moph.gov.lb",
        "• الصندوق الوطني للضمان الاجتماعي: cnss.gov.lb",
      ].join("\n"),
    ),
    intents: [
      {
        type: "open_module",
        moduleId: "useful_links",
        label: "عرض كل الروابط المفيدة",
      },
      {
        type: "open_url",
        url: "https://www.lebarmy.gov.lb/",
        label: "الجيش اللبناني",
      },
      {
        type: "open_url",
        url: "https://isf.gov.lb/",
        label: "قوى الأمن الداخلي",
      },
    ],
    debug: {
      useful_links_query: true,
      source: "official_useful_links",
    },
  };
}

export function shouldPreferDeterministicFamilyPensionReply(query: string, chunks: KbChunk[]): boolean {
  const queryNorm = normalizeArabic(query);
  if (isSpecificFamilyPensionQuery(queryNorm) && findDominantSpecificFamilyPensionChunk(queryNorm, chunks) !== null) {
    return true;
  }

  return isFamilyPensionQuery(queryNorm) && (hasDominantTopTitle(chunks) || (chunks[0]?.score ?? 0) >= 18);
}

function looksOpaqueSourceLabel(label: string): boolean {
  return /^(rag|law|doc|kb)_[a-z0-9]+$/i.test(label.trim());
}

export function getChunkTitle(chunk: KbChunk): string {
  const metadata = chunk.metadata || {};
  const titleFromMetadata = typeof metadata.title_ar === "string" ? cleanDisplayText(metadata.title_ar) : "";
  const sectionName = typeof metadata.section_name_ar === "string" ? cleanDisplayText(metadata.section_name_ar) : "";
  const title = titleFromMetadata || sectionName;

  if (title) return title;

  const firstLine = chunk.text.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() || "";
  if (firstLine && !looksOpaqueSourceLabel(firstLine)) return cleanDisplayText(firstLine);

  return "مرجع من قاعدة المعرفة";
}

function getChunkSourceKind(chunk: KbChunk): string {
  const metadata = chunk.metadata || {};
  if (typeof metadata.source === "string" && metadata.source.trim()) return metadata.source.trim();
  if (typeof metadata.source_id === "string" && metadata.source_id.trim()) return metadata.source_id.trim();
  return "kb";
}

function buildChatSources(chunks: KbChunk[]) {
  return chunks.map((chunk) => {
    const title = getChunkTitle(chunk);
    const cleaned = cleanChunkBody(chunk.text, title).trim();
    const snippet = cleaned === "الجهة المختصة" ? title : cleaned;
    return {
      id: chunk.id,
      title,
      text: (snippet || title).slice(0, 220),
      score: chunk.score,
      source: getChunkSourceKind(chunk),
    };
  });
}

function isMetadataLine(line: string): boolean {
  return /^(الفئة:|أسئلة المستخدم الشائعة:|category:|frequently asked|-\s*procedures\s*:)/i.test(line);
}

function cleanChunkBody(text: string, title: string): string {
  const lines = fixMojibake(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\*\s*\d+\s*_[^.\n]*(?:\.\d+\.)?/g, "الجهة المختصة").replace(/\.\d+\b/g, "").trim())
    .filter(Boolean)
    .filter((line) => !isMetadataLine(line))
    .filter((line) => line !== "---")
    .filter((line) => !/^\*\s*\d+\s*_/.test(line));

  if (lines.length > 0 && normalizeArabic(lines[0]) === normalizeArabic(title)) {
    lines.shift();
  }

  return cleanupDeterministicReplyText(lines.join("\n").trim());
}

export function buildKbFallbackReply(chunks: KbChunk[]): string {
  if (chunks.length === 0) return "";

  const primaryTitle = getChunkTitle(chunks[0]);
  const primaryTitleNorm = normalizeArabic(primaryTitle);
  const relatedChunks = chunks.filter((chunk) => normalizeArabic(getChunkTitle(chunk)) === primaryTitleNorm);
  const candidateChunks = relatedChunks.length > 0 ? relatedChunks : [chunks[0]];
  const cleanedEntries = candidateChunks
    .map((chunk) => ({
      chunkType: chunk.chunk_type,
      body: cleanChunkBody(chunk.text, primaryTitle),
    }))
    .filter((entry) => Boolean(entry.body));

  const documentsBody = cleanedEntries.find((entry) => entry.chunkType === "documents" && entry.body !== "الجهة المختصة")?.body || "";
  const overview = documentsBody
    || cleanedEntries.find((entry) => entry.chunkType === "overview" && !/(^|\n)1\./.test(entry.body) && entry.body.length > 40 && entry.body !== "الجهة المختصة")?.body
    || cleanedEntries.find((entry) => !/(^|\n)1\./.test(entry.body) && entry.body !== "الجهة المختصة")?.body
    || cleanedEntries[0]?.body
    || "";
  const stepSource = cleanedEntries.find((entry) => entry.chunkType === "steps" && /(^|\n)1\./.test(entry.body))?.body
    || cleanedEntries.find((entry) => /(^|\n)1\./.test(entry.body))?.body
    || "";
  const stepLines = stepSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line))
    .slice(0, 3);

  const parts = [primaryTitle];
  if (overview) {
    parts.push(overview.length > 520 ? `${overview.slice(0, 520).trim()}…` : overview);
  }
  if (stepLines.length > 0) {
    parts.push(`الخطوات الأساسية:\n${stepLines.join("\n")}`);
  }

  return cleanupDeterministicReplyText(parts.filter(Boolean).join("\n\n"));
}

function sanitizeKbAnswer(answer: string): string {
  return cleanupDeterministicReplyText(fixMojibake(answer)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^مراجع داخلية:/i.test(line))
    .join("\n"));
}

function buildDeterministicAiReply(kbAnswer: string, kbConfidence: number, kbChunks: KbChunk[]): string {
  const cleanedKbAnswer = sanitizeKbAnswer(kbAnswer);
  if (cleanedKbAnswer && kbConfidence >= 0.2) return cleanedKbAnswer;
  return buildKbFallbackReply(kbChunks);
}

export function buildClarificationOptions(query: string, chunks: KbChunk[]): string[] {
  const queryNorm = normalizeArabic(query);
  const unique = new Set<string>();

  if (isSpecificFamilyPensionQuery(queryNorm)) {
    if (findDominantSpecificFamilyPensionChunk(queryNorm, chunks)) return [];
  }

  for (const chunk of chunks) {
    const title = getChunkTitle(chunk);
    if (!title || looksOpaqueSourceLabel(title)) continue;
    unique.add(title);
    if (unique.size >= 5) break;
  }

  const options = [...unique];
  if (options.length < 2) return [];

  const isShortQuery = queryNorm.length <= 16 || query.trim().split(/\s+/).length <= 3;
  const isShorthand = /(^|[\s-])([تدمل]\s*\d+|\d+\s*[-/]?\s*[تدمل])($|[\s-])/i.test(query);
  const firstOptionMatchesDirectly = options.some((option) => normalizeArabic(option).includes(queryNorm) || queryNorm.includes(normalizeArabic(option)));

  if (isShorthand) return options;
  if (isShortQuery && !firstOptionMatchesDirectly) return options;
  if (isShortQuery && options.length >= 3) return options;
  return [];
}

export function buildClarificationReply(options: string[]): string {
  const numberedOptions = buildClarificationOptionsWithOther(options)
    .map((option, index) => `${index + 1}. ${option}`)
    .join("\n");
  return `سؤالك قد يشير إلى أكثر من موضوع. اختر العنوان الأقرب لأقدّم لك الإجابة الدقيقة:\n${numberedOptions}\n\nيمكنك اختيار رقم من القائمة أو كتابة اسم الموضوع مباشرة.`;
}

function buildClarificationOptionsWithOther(options: string[], formatter?: (option: string) => string): string[] {
  const formatted = [...new Set(options.filter(Boolean).map((option) => formatter ? formatter(option) : option))];
  if (!formatted.some((option) => normalizeArabic(option) === normalizeArabic(CLARIFICATION_OTHER_OPTION_LABEL))) {
    formatted.push(CLARIFICATION_OTHER_OPTION_LABEL);
  }
  return formatted;
}

export function buildSuggestionIntents(options: string[]): ActionIntent[] {
  return buildClarificationOptionsWithOther(options).map((option) => ({
    type: "suggest_query",
    label: option,
    query: option,
  }));
}

function uniqueOptions(options: string[]): string[] {
  return [...new Set(options.filter(Boolean))].slice(0, 5);
}

export function buildGenericTopicOptions(query = ""): string[] {
  const queryNorm = normalizeArabic(query);

  const mentionsPension = /(تقاعد|معاش|راتب|متقاعد)/.test(queryNorm);
  const mentionsTransactions = /(معامل|طلب|طلبات|اجراء|اجراءات|معامله)/.test(queryNorm);
  const mentionsFamily = /(عائله|ورثه|ارمله|زوجه|ابنه|ابن|والده|والد)/.test(queryNorm);
  const mentionsCoverage = /(طبابه|استشفاء|بطاق|خدمات اجتماعيه|على العاتق)/.test(queryNorm);
  const mentionsDeath = /(وفاه|متوفي|شهيد)/.test(queryNorm);
  const mentionsSchooling = /(مدارس|مدرسه|مدرسية|مدرسيه|مدرس|جامعه|جامعة|دراسه|دراسة|منح|منحه|منحة)/.test(queryNorm);
  const mentionsDocuments = /(اوراق|أوراق|مستندات|وثائق|افاده|إفادة|افادات|إفادات)/.test(queryNorm);

  if (mentionsPension && mentionsTransactions) {
    return uniqueOptions([
      "معاملات التقاعد",
      "معاش الزوجة",
      "معاش الابنة الأرملة",
      "معاش الابنة المطلقة",
      "معاش الابن الذي يتابع الدراسة",
      mentionsFamily ? "معاش الوالدة" : "وفاة العسكري المتقاعد",
    ]);
  }

  if (mentionsPension || mentionsFamily) {
    return uniqueOptions([
      "معاش الزوجة",
      "معاش الوالدة",
      "معاش الابنة الأرملة",
      "معاش الابنة المطلقة",
      "معاش الابن الذي يتابع الدراسة",
      "وفاة العسكري المتقاعد",
    ]);
  }

  if (mentionsCoverage) {
    return uniqueOptions([
      "معاملات على العاتق",
      "الطبابة والاستشفاء",
      "تجديد بطاقات الخدمات الاجتماعية",
      "اعادة الزوجة الى العاتق بعد ترك العمل",
      "التعويض العائلي",
    ]);
  }

  if (mentionsDocuments) {
    return uniqueOptions([
      "معاملات التقاعد",
      "معاملات على العاتق",
      "المساعدات المدرسية",
      "الطبابة والاستشفاء",
      "وفاة العسكري المتقاعد",
    ]);
  }

  if (mentionsSchooling) {
    return uniqueOptions([
      "المساعدات المدرسية",
      "نماذج طلبات المساعدات المدرسية في الجيش",
      "طلب نسبة قيمة المساعدات المدرسية",
      "طلب تنازل عن قيمة المساعدات المدرسية",
      "طلب إلغاء التنازل عن المساعدات المدرسية",
    ]);
  }

  if (mentionsDeath) {
    return uniqueOptions([
      "وفاة العسكري المتقاعد",
      "معاش الزوجة",
      "معاش الابنة الأرملة",
      "معاملات التقاعد",
      "التعويض العائلي",
    ]);
  }

  return [
    "معاملات على العاتق",
    "الطبابة والاستشفاء",
    "التعويض العائلي",
    "معاملات التقاعد",
    "وفاة العسكري المتقاعد",
  ];
}

function addFollowupPrompt(reply: string): string {
  const trimmed = reply.trim();
  if (!trimmed) return "إذا رغبت، يمكنني توضيح الخطوات أو المستندات المطلوبة أو تقديم مزيد من التفصيل.";
  if (/(يمكنني|هل ترغب|هل تريد|أوضح|تفصيل|المستندات المطلوبة)/.test(trimmed)) return trimmed;
  return `${trimmed}\n\nإذا رغبت، يمكنني توضيح الخطوات أو المستندات المطلوبة أو تقديم مزيد من التفصيل.`;
}

function looksLikeRawKbEcho(reply: string): boolean {
  return /\[KB_CONTEXT\]|\[مصدر\s*\d+|أسئلة المستخدم الشائعة:|^\*\s*\d+\s*_/m.test(reply);
}

function normalizeResponse(payload: unknown): ChatResponse {
  const data = (payload || {}) as LegacyChatResponse;
  const replyRaw = typeof data.reply === "string" ? data.reply : (data.answer || "");
  const reply = fixMojibake(replyRaw);
  let rawIntents: string[] = [];
  if (Array.isArray(data.intents)) {
    rawIntents = data.intents;
  } else if (Array.isArray(data.action_intents)) {
    rawIntents = data.action_intents;
  }
  const intents = rawIntents as unknown as ChatResponse["intents"];
  const debug = {
    legacy: {
      clarifying_question: typeof data.clarifying_question === "string"
        ? fixMojibake(data.clarifying_question)
        : (data.clarifying_question ?? null),
    },
    raw: data.debug ?? null,
  };
  return {
    reply: fixMojibake(reply),
    intents,
    whatsapp_payloads: Array.isArray(data.whatsapp_payloads) ? data.whatsapp_payloads : undefined,
    debug,
  };
}

/* ── Dependencies injected from server.ts ────────────────────── */
export interface ChatServiceDeps {
  repoRootPath: string;
  usePython: boolean;
  getPythonBase: () => string;
  getKbStore: () => { stats: () => Promise<unknown> } | null;
  useAi: boolean;
  getAiChat: () => AiChatProvider | null;
  getAiProvider: () => string;
  getAiModel: () => string;
  aiRagTopK: number;
  aiSystemPrompt: string;
  aiConversationHistory: Map<string, AiMessage[]>;
  // AI helpers from ai/index
  retrieveChunks: (query: string, topK: number, scopeHints?: string[]) => KbChunk[];
  buildAiMessages: (query: string, chunks: KbChunk[], history: AiMessage[], systemPrompt?: string) => AiMessage[];
  extractIntents: (text: string) => { intents: unknown[]; clarifyingQuestion?: string | null };
  evaluateRelevance: (query: string, topK: number) => { confidence: string; topScore?: number };
  getRagChunkCount: () => number;
  // KB vNext
  isKbNodesReady: () => boolean;
  searchKbNodes: (query: string, intent?: string | null, limit?: number) => KbSearchResult;
  // Emotional / small-talk
  computeEmotionalScore: (text: string) => number;
  empathySystemInjection: string;
  classifySmallTalk: (text: string) => { name: string; response: string } | null;
  // Unrecognized input
  logUnrecognizedInput: (entry: { ts: string; message: string; userId: string; channel: string; reason: string }) => void;
  getRandomClarifyResponse: () => string;
  // Failure tracking (mutable refs)
  aiFailureCount: { value: number };
  lastAiFailure: { value: { at: number; route: string; message: string } | null };
  pendingProcedureConfirmations?: Map<string, PendingProcedureConfirmation>;
  pendingClarificationSelections?: Map<string, PendingClarificationSelection>;
  conversationContexts?: Map<string, ConversationContext>;
  // Circuit breaker for AI provider
  aiProviderCircuitBreaker?: { call: <T>(fn: () => Promise<T>) => Promise<T> };
  // Logger
  log: { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void };
}

interface KbPrefetchResult {
  kbAnswer: string;
  kbConfidence: number;
  kbHits: unknown[];
  kbChunks: KbChunk[];
  sources: ReturnType<typeof buildChatSources>;
  elapsedMs: number;
  cacheHit?: boolean;
}

function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getConversationKey(body: ChatRequest, fallbackUserId: string): string {
  const sessionId = typeof body.sessionId === "string" ? cleanDisplayText(body.sessionId) : "";
  if (sessionId) return `session:${sessionId}`;

  const userId = typeof body.userId === "string" ? cleanDisplayText(body.userId) : "";
  if (userId) return `user:${userId}`;

  return `user:${fallbackUserId}`;
}

function getConversationContext(
  deps: ChatServiceDeps,
  conversationKey: string,
): ConversationContext | null {
  const store = deps.conversationContexts;
  if (!store) return null;

  const context = store.get(conversationKey);
  if (!context) return null;

  const updatedAt = Date.parse(context.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt + CONVERSATION_CONTEXT_TTL_MS <= Date.now()) {
    store.delete(conversationKey);
    return null;
  }

  return context;
}

function setConversationContext(
  deps: ChatServiceDeps,
  conversationKey: string,
  patch: Partial<ConversationContext>,
): ConversationContext | null {
  const store = deps.conversationContexts;
  if (!store) return null;

  const current = getConversationContext(deps, conversationKey);
  const nextContext: ConversationContext = {
    conversationId: current?.conversationId || conversationKey,
    originalQuestion: patch.originalQuestion ?? current?.originalQuestion,
    originalIntent: patch.originalIntent ?? current?.originalIntent,
    originalModule: patch.originalModule ?? current?.originalModule,
    lastAnswer: patch.lastAnswer ?? current?.lastAnswer,
    pendingClarification: patch.pendingClarification ?? current?.pendingClarification,
    awaitingTopicDecision: patch.awaitingTopicDecision ?? current?.awaitingTopicDecision,
    updatedAt: patch.updatedAt ?? NOW_ISO(),
  };

  if (!nextContext.originalQuestion && !nextContext.lastAnswer && !nextContext.originalModule) {
    store.delete(conversationKey);
    return null;
  }

  store.set(conversationKey, nextContext);
  return nextContext;
}

function clearConversationContext(deps: ChatServiceDeps, conversationKey: string): void {
  deps.conversationContexts?.delete(conversationKey);
}

function sanitizeTimings(timings: ChatTimings): Record<string, number | boolean> {
  return Object.fromEntries(
    Object.entries(timings).filter(([, value]) => value !== undefined),
  ) as Record<string, number | boolean>;
}

function mergeResponseDebug(response: ChatResponse, extra: Record<string, unknown>): ChatResponse {
  const currentDebug = response.debug && typeof response.debug === "object"
    ? response.debug
    : {};
  return {
    ...response,
    debug: {
      ...currentDebug,
      ...extra,
    },
  };
}

function attachTimings(response: ChatResponse, timings: ChatTimings): ChatResponse {
  if (process.env.NODE_ENV === "production") return response;

  const nextTimings = sanitizeTimings(timings);
  if (Object.keys(nextTimings).length === 0) return response;

  const currentDebug = response.debug && typeof response.debug === "object"
    ? response.debug
    : {};
  const currentTimings = currentDebug.timings && typeof currentDebug.timings === "object"
    ? currentDebug.timings as Record<string, unknown>
    : {};

  return {
    ...response,
    debug: {
      ...currentDebug,
      timings: {
        ...currentTimings,
        ...nextTimings,
      },
    },
  };
}

function getKbPrefetchCacheKey(body: ChatRequest): string {
  return [body.lang || "ar", body.channel || "web", normalizeArabic(cleanDisplayText(body.message))].join(":");
}

function isClarificationTriggerMessage(message: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(message));
  if (!normalized) return false;
  return CLARIFICATION_TRIGGER_SIGNALS.some((signal) => normalized.includes(normalizeArabic(signal)));
}

function isSameTopicDecision(message: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(message));
  return SAME_TOPIC_SIGNALS.some((signal) => normalized === normalizeArabic(signal));
}

function isNewTopicDecision(message: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(message));
  return NEW_TOPIC_SIGNALS.some((signal) => normalized === normalizeArabic(signal));
}

function isShortFollowupMessage(message: string): boolean {
  const cleaned = cleanDisplayText(message);
  const normalized = normalizeArabic(cleaned);
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return false;

  if (/^(?:و)?(?:ما|شو)\s+(?:هو|هي)(?:\s|$)/.test(normalized)) return true;

  const toCompactFollowup = (value: string) => value
    .replace(/^(?:ما|شو)\s+(?:هو|هي)\s+/, "")
    .replace(/^(?:ما|شو)\s+/, "")
    .trim();

  const compact = toCompactFollowup(normalized);
  const candidates = [compact];
  const withoutLeadingConjunction = compact.replace(/^[وف]/, "").trim();
  if (withoutLeadingConjunction && withoutLeadingConjunction !== compact) {
    candidates.push(toCompactFollowup(withoutLeadingConjunction));
  }

  return candidates.some((candidate) => {
    return SHORT_FOLLOWUP_PREFIXES.some((prefix) => candidate.startsWith(prefix))
      || SHORT_FOLLOWUP_KEYWORDS.some((keyword) => candidate.startsWith(keyword));
  });
}

function shouldReuseConversationContext(message: string, context: ConversationContext | null): boolean {
  if (!context?.originalQuestion) return false;
  return isClarificationTriggerMessage(message) || isShortFollowupMessage(message);
}

function buildAnchoredMessage(message: string, context: ConversationContext): string {
  const originalQuestion = cleanDisplayText(context.originalQuestion || "");
  const lastAnswer = cleanDisplayText(context.lastAnswer || "");
  const followup = cleanDisplayText(message);

  return [
    originalQuestion,
    `سؤال متابعة على نفس الموضوع: ${followup}`,
    lastAnswer ? `الجواب السابق: ${lastAnswer}` : "",
  ].filter(Boolean).join("\n\n");
}

function mergeHybridIntents(existing: ActionIntent[] | undefined, generated: ActionIntent[]): ActionIntent[] {
  const seen = new Set<string>();
  const merged: ActionIntent[] = [];

  for (const intent of [...(existing || []), ...generated]) {
    const key = [intent.type, intent.label, intent.moduleId, intent.query, intent.url, intent.phone].filter(Boolean).join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(intent);
  }

  return merged;
}

function formatAnnouncementDate(value: string | undefined): string {
  if (!value) return "غير محدد";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ar-LB", { dateStyle: "medium" }).format(parsed);
}

function getPendingProcedureConfirmation(
  deps: ChatServiceDeps,
  conversationKey: string,
): PendingProcedureConfirmation | null {
  const store = deps.pendingProcedureConfirmations;
  if (!store) return null;

  const pending = store.get(conversationKey);
  if (!pending) return null;

  if (pending.expiresAt <= Date.now()) {
    store.delete(conversationKey);
    return null;
  }

  return pending;
}

function setPendingProcedureConfirmation(
  deps: ChatServiceDeps,
  conversationKey: string,
  candidate: ProcedureConfirmationCandidate,
): void {
  deps.pendingProcedureConfirmations?.set(conversationKey, {
    procedureId: candidate.procedureId,
    procedureTitle: candidate.procedureTitle,
    procedureSummary: candidate.procedureSummary,
    expiresAt: Date.now() + PROCEDURE_CONFIRMATION_TTL_MS,
  });
}

function clearPendingProcedureConfirmation(deps: ChatServiceDeps, conversationKey: string): void {
  deps.pendingProcedureConfirmations?.delete(conversationKey);
}

function getPendingClarificationSelection(
  deps: ChatServiceDeps,
  conversationKey: string,
): PendingClarificationSelection | null {
  const store = deps.pendingClarificationSelections;
  if (!store) return null;

  const pending = store.get(conversationKey);
  if (!pending) return null;

  if (pending.expiresAt <= Date.now()) {
    store.delete(conversationKey);
    return null;
  }

  return pending;
}

function setPendingClarificationSelection(
  deps: ChatServiceDeps,
  conversationKey: string,
  options: PendingClarificationOption[],
  clarifyingQuestion: string,
): void {
  deps.pendingClarificationSelections?.set(conversationKey, {
    options,
    clarifyingQuestion,
    expiresAt: Date.now() + CLARIFICATION_SELECTION_TTL_MS,
  });
}

function clearPendingClarificationSelection(deps: ChatServiceDeps, conversationKey: string): void {
  deps.pendingClarificationSelections?.delete(conversationKey);
}

function normalizeSelectionDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String((digit.codePointAt(0) ?? 0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String((digit.codePointAt(0) ?? 0) - 0x06f0));
}

function parseSelectionIndex(text: string): number | null {
  const normalized = normalizeSelectionDigits(cleanDisplayText(text));
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function findPendingClarificationOption(
  text: string,
  pending: PendingClarificationSelection,
): PendingClarificationOption | null {
  const selectionIndex = parseSelectionIndex(text);
  if (selectionIndex !== null) {
    return pending.options[selectionIndex - 1] || null;
  }

  const normalized = normalizeArabic(cleanDisplayText(text).replace(/^\d+\s*[.)-]\s*/, "").trim());
  if (!normalized) return null;

  return pending.options.find((option) => {
    const labelNorm = normalizeArabic(option.label);
    const queryNorm = option.query ? normalizeArabic(option.query) : "";
    return normalized === labelNorm || Boolean(queryNorm && normalized === queryNorm);
  }) || null;
}

function isAffirmativeReply(text: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(text));
  return normalized === "1" || AFFIRMATIVE_REPLIES.some((candidate) => normalizeArabic(candidate) === normalized);
}

function isNegativeReply(text: string): boolean {
  const normalized = normalizeArabic(cleanDisplayText(text));
  return normalized === "2" || NEGATIVE_REPLIES.some((candidate) => normalizeArabic(candidate) === normalized);
}

function looksLikeProcedureLookupQuery(query: string): boolean {
  const cleaned = cleanDisplayText(query);
  if (!cleaned || /[؟?]/.test(cleaned)) return false;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;

  const normalized = normalizeArabic(cleaned);
  return !PROCEDURE_LOOKUP_BLOCKERS.some((blocker) => normalized.includes(normalizeArabic(blocker)));
}

function getProcedureOptionLabel(candidate: ProcedureConfirmationCandidate): string {
  return candidate.displayLabel ? cleanDisplayText(candidate.displayLabel) : formatProcedureOptionLabel(candidate.procedureTitle);
}

function buildProcedureConfirmationIntents(): ActionIntent[] {
  return [
    { type: "suggest_query", label: "نعم، هذا المطلوب", query: "نعم" },
    { type: "suggest_query", label: "لا، شيء آخر", query: "لا" },
  ];
}

function buildProcedureConfirmationResponse(candidate: ProcedureConfirmationCandidate): ChatResponse {
  const candidateLabel = getProcedureOptionLabel(candidate);
  return {
    reply: `غالباً تقصد إجراء "${candidateLabel}". اختر من التالي للمتابعة:\n1. نعم، هذا المطلوب\n2. لا، شيء آخر`,
    intents: buildProcedureConfirmationIntents(),
    clarifying_question: `هل تقصد الإجراء "${candidateLabel}"؟`,
    debug: {
      procedure_confirmation: true,
      procedure_id: candidate.procedureId,
      procedure_title: candidate.procedureTitle,
      procedure_label: candidateLabel,
    },
  };
}

function formatProcedureOptionLabel(title: string): string {
  const cleaned = cleanDisplayText(title).replace(/\s+/g, " ").trim();
  if (cleaned.startsWith("اضافة ")) return `إضافة ${cleaned.slice("اضافة ".length)}`;
  if (cleaned.startsWith("اعادة ")) return `إعادة ${cleaned.slice("اعادة ".length)}`;
  if (cleaned.startsWith("اجراءات ")) return `إجراءات ${cleaned.slice("اجراءات ".length)}`;
  return cleaned;
}

function buildProcedureClarificationIntents(candidates: ProcedureConfirmationCandidate[]): ActionIntent[] {
  return candidates.map((candidate) => ({
    type: "suggest_query",
    label: getProcedureOptionLabel(candidate),
    query: candidate.displayLabel || candidate.procedureTitle,
  }));
}

function buildProcedureClarificationResponse(candidates: ProcedureConfirmationCandidate[]): ChatResponse {
  const options = candidates.map((candidate) => candidate.displayLabel || candidate.procedureTitle);
  const labels = candidates.map((candidate) => getProcedureOptionLabel(candidate));
  const menuOptions = buildClarificationOptionsWithOther(options);
  const numberedLabels = buildClarificationOptionsWithOther(labels)
    .map((label, index) => `${index + 1}. ${label}`)
    .join("\n");

  return {
    reply: `حتى أحدد الإجراء الصحيح بدقة، اختر الحالة المطابقة لطلبك من الخيارات التالية:\n${numberedLabels}`,
    intents: [...buildProcedureClarificationIntents(candidates), { type: "suggest_query", label: CLARIFICATION_OTHER_OPTION_LABEL, query: CLARIFICATION_OTHER_OPTION_LABEL }],
    clarifying_question: "أي حالة تقصد تحديداً؟",
    menu: menuOptions,
    debug: {
      procedure_confirmation_clarification: true,
      procedure_option_titles: options,
      procedure_option_labels: labels,
      procedure_option_ids: candidates.map((candidate) => candidate.procedureId),
    },
  };
}

function extractPendingClarificationOptions(response: ChatResponse): PendingClarificationOption[] {
  const intents = Array.isArray(response.intents) ? response.intents : [];
  const suggestIntents = intents.filter((intent): intent is ActionIntent & { label: string; query: string } => {
    return intent?.type === "suggest_query" && typeof intent.label === "string" && typeof intent.query === "string";
  });

  return suggestIntents.map((intent) => ({
    label: cleanDisplayText(intent.label),
    query: normalizeArabic(intent.label) === normalizeArabic(CLARIFICATION_OTHER_OPTION_LABEL) ? undefined : cleanDisplayText(intent.query),
    kind: normalizeArabic(intent.label) === normalizeArabic(CLARIFICATION_OTHER_OPTION_LABEL) ? "other" : "query",
  }));
}

function buildProcedureDisplayResponse(pending: PendingProcedureConfirmation): ChatResponse {
  return {
    reply: `نعم، هذا هو الإجراء الكامل الخاص بـ "${pending.procedureTitle}".`,
    intents: [],
    sources: [
      {
        id: pending.procedureId,
        title: pending.procedureTitle,
        text: pending.procedureSummary,
        source: "procedure",
      },
    ],
    debug: {
      procedure_confirmation_resolved: true,
      procedure_id: pending.procedureId,
      procedure_title: pending.procedureTitle,
      procedure_auto_expand: true,
    },
  };
}

function handlePendingProcedureReply(
  deps: ChatServiceDeps,
  conversationKey: string,
  message: string,
  pendingProcedure: PendingProcedureConfirmation | null,
): ChatResponse | null {
  if (!pendingProcedure) return null;

  if (isAffirmativeReply(message)) {
    clearPendingProcedureConfirmation(deps, conversationKey);
    clearPendingClarificationSelection(deps, conversationKey);
    return buildProcedureDisplayResponse(pendingProcedure);
  }

  if (isNegativeReply(message)) {
    clearPendingProcedureConfirmation(deps, conversationKey);
    return {
      reply: "تمام. إذا كنت تقصد شيئاً آخر، اكتب اسم الإجراء أو صف الطلب الذي تريد معرفته وسأحدد لك الخيار الصحيح.",
      intents: [],
      debug: { procedure_confirmation_declined: true },
    };
  }

  clearPendingProcedureConfirmation(deps, conversationKey);
  return null;
}

function buildTopicScopeClarificationResponse(): ChatResponse {
  return {
    reply: "هل تقصد نفس الموضوع أو موضوع جديد؟",
    intents: [
      { type: "suggest_query", label: "نفس الموضوع", query: "نفس الموضوع" },
      { type: "suggest_query", label: "موضوع جديد", query: "موضوع جديد" },
    ],
    clarifying_question: "هل تقصد نفس الموضوع أو موضوع جديد؟",
    debug: {
      clarification_other_selected: true,
      awaiting_topic_decision: true,
    },
  };
}

function handlePendingClarificationReply(
  deps: ChatServiceDeps,
  conversationKey: string,
  message: string,
  pendingClarification: PendingClarificationSelection | null,
): { response: ChatResponse | null; selectedQuery: string | null } {
  if (!pendingClarification) return { response: null, selectedQuery: null };

  const selectedOption = findPendingClarificationOption(message, pendingClarification);
  if (selectedOption?.kind === "other") {
    clearPendingClarificationSelection(deps, conversationKey);
    setConversationContext(deps, conversationKey, {
      pendingClarification: true,
      awaitingTopicDecision: true,
    });
    return {
      response: buildTopicScopeClarificationResponse(),
      selectedQuery: null,
    };
  }

  if (selectedOption?.kind === "query" && selectedOption.query) {
    clearPendingClarificationSelection(deps, conversationKey);
    setConversationContext(deps, conversationKey, {
      pendingClarification: false,
      awaitingTopicDecision: false,
    });
    return { response: null, selectedQuery: selectedOption.query };
  }

  clearPendingClarificationSelection(deps, conversationKey);
  return { response: null, selectedQuery: null };
}

function buildProcedureDisplayResponseFromCandidate(candidate: ProcedureConfirmationCandidate): ChatResponse {
  return buildProcedureDisplayResponse({
    procedureId: candidate.procedureId,
    procedureTitle: candidate.procedureTitle,
    procedureSummary: candidate.procedureSummary,
    expiresAt: Date.now(),
  });
}

function buildProcedureLookupMatch(query: string, candidate: ProcedureConfirmationCandidate): ProcedureLookupMatch {
  return isExactProcedureTitleQuery(query, candidate)
    ? { kind: "display", candidate }
    : { kind: "confirm", candidate };
}

async function findAliasProcedureLookupMatch(query: string): Promise<ProcedureLookupMatch | null> {
  const matchedAlias = getMatchingProcedureLookupAlias(query);
  if (!matchedAlias) return null;

  const titleCandidates = matchedAlias.exactTitles
    ? (await Promise.all(
      matchedAlias.exactTitles.map((title, index) => resolveProcedureCandidateByExactTitle(title, matchedAlias.optionLabels?.[index])),
    )).filter((candidate): candidate is ProcedureConfirmationCandidate => Boolean(candidate))
    : [];

  const idCandidates = matchedAlias.exactProcedureIds
    ? (await Promise.all(
      matchedAlias.exactProcedureIds.map((procedureId, index) => resolveProcedureConfirmationCandidate(
        procedureId,
        undefined,
        matchedAlias.optionLabels?.[index],
      )),
    )).filter((candidate): candidate is ProcedureConfirmationCandidate => Boolean(candidate))
    : [];

  const aliasCandidates = dedupeProcedureCandidates([...titleCandidates, ...idCandidates]);

  if (aliasCandidates.length === 0) return null;
  if (aliasCandidates.length > 1) return { kind: "clarify", candidates: aliasCandidates };

  return buildProcedureLookupMatch(query, aliasCandidates[0]);
}

async function findSearchProcedureLookupMatch(query: string): Promise<ProcedureLookupMatch | null> {
  const variant = cleanDisplayText(query);
  const hits = await searchProcedures(variant, 5);
  if (hits.length === 0) return null;

  const top = hits.find((hit) => hit.record_kind === "procedure") || hits[0];
  const title = cleanDisplayText(top.title_clean || top.title_ar || "");
  const titleNorm = normalizeArabic(title);
  const variantNorm = normalizeArabic(variant);
  const hasActionSignal = PROCEDURE_TITLE_ACTION_SIGNALS.some((signal) => titleNorm.includes(signal));
  const looksDirectlyMatched = titleNorm.includes(variantNorm) || variantNorm.includes(titleNorm);

  if (!hasActionSignal || !looksDirectlyMatched) return null;

  const candidate = await resolveProcedureConfirmationCandidate(top.id, title);
  if (!candidate) return null;

  return buildProcedureLookupMatch(query, {
    ...candidate,
    procedureSummary: candidate.procedureSummary || cleanDisplayText(top.summary_clean || top.summary_lb || ""),
  });
}

async function findProcedureLookupMatch(query: string): Promise<ProcedureLookupMatch | null> {
  const aliasMatch = await findAliasProcedureLookupMatch(query);
  if (aliasMatch) return aliasMatch;

  if (!looksLikeProcedureLookupQuery(query)) return null;

  return findSearchProcedureLookupMatch(query);
}

async function withKbDebug(deps: ChatServiceDeps, response: ChatResponse): Promise<ChatResponse> {
  const kbStore = deps.getKbStore();
  if (!kbStore) return response;

  const existingDebug = response.debug && typeof response.debug === "object"
    ? { ...response.debug }
    : {};

  return {
    ...response,
    debug: {
      ...existingDebug,
      kb: await kbStore.stats(),
    },
  };
}

async function requestLegacyCandidate(
  deps: ChatServiceDeps,
  base: string,
  payload: { question: string; lang?: string; channel: string },
): Promise<ChatResponse | null> {
  try {
    const res = await request(`${base}/chat/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.body.text();

    try {
      return await withKbDebug(deps, normalizeResponse(JSON.parse(text) as LegacyChatResponse));
    } catch {
      return await withKbDebug(deps, normalizeResponse({ answer: text }));
    }
  } catch (err) {
    deps.log.warn({ err, base }, "python_proxy_failed");
    return null;
  }
}

async function buildLegacyFallbackResponse(deps: ChatServiceDeps): Promise<ChatResponse> {
  const kbStore = deps.getKbStore();
  const debug = kbStore ? { kb: await kbStore.stats() } : undefined;
  return {
    reply: "بدك تعمل شو؟ 1 تقاعد 2 طبابة 3 منح/مدارس 4 وفاة/ورثة 5 على العاتق 6 إرسال مستند",
    intents: [],
    debug,
  };
}

function buildAgentDebug(agentInput: ReturnType<typeof prepareWatanyAgentInput>): Record<string, unknown> {
  return {
    tagIds: agentInput.tags.map((tag) => tag.tagId),
    kbScopes: agentInput.kbScopes,
    greetingRequired: agentInput.behavior.shouldStartWithGreeting,
    tone: agentInput.behavior.tone,
  };
}

function finalizeAgentAwareResponse(
  userMessage: string,
  response: ChatResponse,
  agentInput: ReturnType<typeof prepareWatanyAgentInput>,
): ChatResponse {
  const debug = response.debug && typeof response.debug === "object"
    ? { ...response.debug }
    : {};

  debug.agent = buildAgentDebug(agentInput);

  return {
    ...response,
    reply: typeof response.reply === "string"
      ? finalizeWatanyAgentAnswer(userMessage, response.reply)
      : response.reply,
    debug,
  };
}

function appendAgentSystemInstruction(messages: AiMessage[], systemInstruction: string): void {
  const trimmedInstruction = systemInstruction.trim();
  if (!trimmedInstruction) return;

  const systemMessage = messages.find((message) => message.role === "system");
  if (systemMessage) {
    systemMessage.content = `${systemMessage.content}\n\n${trimmedInstruction}`;
    return;
  }

  messages.unshift({ role: "system", content: trimmedInstruction });
}

async function fetchKbPrefetch(
  deps: ChatServiceDeps,
  body: ChatRequest,
  hints?: AgentRetrievalHints,
): Promise<KbPrefetchResult> {
  const cacheKey = getKbPrefetchCacheKey(body);
  const cached = kbPrefetchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.result,
      cacheHit: true,
      elapsedMs: 0,
    };
  }

  const startedAt = Date.now();
  const [kbResult, kbChunks] = await Promise.all([
    (async () => {
      const result = { answer: "", confidence: 0, hits: [] as unknown[] };
      if (!deps.usePython) return result;

      try {
        const kbPayload = {
          question: body.message,
          lang: body.lang || "ar",
          channel: body.channel || "web",
          ...(hints?.scopeHints?.length ? { kb_scopes: hints.scopeHints } : {}),
          ...(hints?.tagIds?.length ? { kb_tags: hints.tagIds } : {}),
        };
        const kbRes = await request(`${deps.getPythonBase()}/chat/ask`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(kbPayload),
        });
        const kbText = await kbRes.body.text();
        const kbData = JSON.parse(kbText) as { answer?: string; confidence?: number; kb_hits?: unknown[] };
        const loadedResult = {
          answer: kbData.answer || "",
          confidence: kbData.confidence || 0,
          hits: kbData.kb_hits || [],
        };
        deps.log.info({ confidence: loadedResult.confidence, hitsCount: loadedResult.hits.length }, "Python KB parallel fetch completed");
        return loadedResult;
      } catch (kbErr) {
        deps.log.warn({ err: kbErr }, "Python KB pre-fetch failed, continuing with RAG only");
        return result;
      }
    })(),
    (async () => {
      try {
        return deps.retrieveChunks(body.message, deps.aiRagTopK, hints?.scopeHints);
      } catch (ragErr) {
        deps.log.warn({ err: ragErr }, "RAG chunk retrieval failed");
        return [];
      }
    })(),
  ]);

  const result: KbPrefetchResult = {
    kbAnswer: kbResult.answer,
    kbConfidence: kbResult.confidence,
    kbHits: kbResult.hits,
    kbChunks,
    sources: buildChatSources(kbChunks),
    elapsedMs: Date.now() - startedAt,
  };

  // Evict oldest entry if the cache grows beyond 500 keys (prevent unbounded memory growth)
  if (kbPrefetchCache.size >= 500) {
    const oldestKey = kbPrefetchCache.keys().next().value;
    if (oldestKey !== undefined) kbPrefetchCache.delete(oldestKey);
  }
  kbPrefetchCache.set(cacheKey, {
    expiresAt: Date.now() + KB_PREFETCH_CACHE_TTL_MS,
    result,
  });

  return result;
}

async function buildDeterministicChatResponse(
  deps: ChatServiceDeps,
  prefetch: KbPrefetchResult,
  aiDebug: Record<string, unknown>,
): Promise<ChatResponse | null> {
  const deterministicReply = buildDeterministicAiReply(prefetch.kbAnswer, prefetch.kbConfidence, prefetch.kbChunks);
  if (!deterministicReply) return null;

  const debug: Record<string, unknown> = {
    ai: aiDebug,
    kbPrefetch: { confidence: prefetch.kbConfidence, hits: prefetch.kbHits.length },
  };
  const response = await withKbDebug(deps, {
    reply: addFollowupPrompt(deterministicReply),
    intents: [],
    sources: prefetch.sources,
    debug,
  });
  return response;
}

function buildClarificationResponse(deps: ChatServiceDeps, prefetch: KbPrefetchResult, clarificationOptions: string[]): ChatResponse {
  const clarifyingQuestion = "أي عنوان تقصد تحديداً؟";
  return {
    reply: buildClarificationReply(clarificationOptions),
    intents: buildSuggestionIntents(clarificationOptions),
    clarifying_question: clarifyingQuestion,
    menu: clarificationOptions,
    sources: [],
    debug: {
      clarification: true,
      clarification_options: clarificationOptions,
      ai: { provider: deps.getAiProvider(), model: deps.getAiModel(), ragChunks: prefetch.kbChunks.length, ragTotal: deps.getRagChunkCount() },
      kbPrefetch: { confidence: prefetch.kbConfidence, hits: prefetch.kbHits.length },
    },
  };
}

async function resolveAiPrefetchShortcut(
  deps: ChatServiceDeps,
  body: ChatRequest,
  prefetch: KbPrefetchResult,
  aiChat: AiChatProvider | null,
  fetchLegacyResponse: (body: ChatRequest) => Promise<ChatResponse>,
): Promise<ChatResponse | null> {
  if (shouldPreferDeterministicFamilyPensionReply(body.message, prefetch.kbChunks)) {
    return buildDeterministicChatResponse(deps, prefetch, {
      provider: deps.getAiProvider(),
      model: deps.getAiModel(),
      deterministicFamilyPension: true,
      ragChunks: prefetch.kbChunks.length,
      ragTotal: deps.getRagChunkCount(),
    });
  }

  const clarificationOptions = buildClarificationOptions(body.message, prefetch.kbChunks);
  if (clarificationOptions.length > 0) {
    return buildClarificationResponse(deps, prefetch, clarificationOptions);
  }

  if (shouldForceGenericTopicClarification(body.message)) {
    return buildClarificationResponse(deps, prefetch, buildGenericTopicOptions(body.message));
  }

  if (aiChat) return null;

  const deterministicResponse = await buildDeterministicChatResponse(deps, prefetch, {
    provider: deps.getAiProvider(),
    model: deps.getAiModel(),
    initialized: false,
    deterministicFallback: true,
    ragChunks: prefetch.kbChunks.length,
    ragTotal: deps.getRagChunkCount(),
  });

  return deterministicResponse || fetchLegacyResponse(body);
}

function injectEmotionalContext(deps: ChatServiceDeps, body: ChatRequest, userId: string, messages: AiMessage[]): number {
  const emoScore = deps.computeEmotionalScore(body.message);
  if (emoScore > 0.6) {
    deps.log.info({ emoScore, userId }, "emotional_mode_activated");
    messages.splice(Math.max(messages.length - 1, 1), 0, { role: "system", content: deps.empathySystemInjection });
  }
  return emoScore;
}

function injectKbNodesContext(deps: ChatServiceDeps, body: ChatRequest, messages: AiMessage[]): KbSearchResult | null {
  if (!deps.isKbNodesReady()) return null;

  const kbNodesResult = deps.searchKbNodes(body.message);
  if (kbNodesResult.nodes.length === 0) return kbNodesResult;

  const kbNodesTopK = Math.max(1, Number(process.env.AI_KB_NODES_TOP_K || "2"));
  const kbNodeSummaryMaxChars = Math.max(120, Number(process.env.AI_KB_NODE_SUMMARY_MAX_CHARS || "180"));
  const topNodes = kbNodesResult.nodes.slice(0, kbNodesTopK);
  const nodesCtx = topNodes.map((n, i) => {
    const summary = n.summary_lb.length > kbNodeSummaryMaxChars
      ? `${n.summary_lb.slice(0, kbNodeSummaryMaxChars)}...`
      : n.summary_lb;
    return `${i + 1}. [${n.type}] ${n.title}\n   ${summary}`;
  }).join("\n");

  messages.splice(Math.max(messages.length - 1, 1), 0, {
    role: "system",
    content: `[نتائج قاعدة المعرفة المحلية — ${kbNodesResult.confidence} confidence, ${kbNodesResult.total} hits]:\n${nodesCtx}\n\nاستعمل هالمعلومات كمرجع أساسي بإجابتك.`,
  });
  deps.log.info({
    kbNodesHits: kbNodesResult.total,
    kbNodesConfidence: kbNodesResult.confidence,
    kbNodesIntent: kbNodesResult.intent,
    kbNodesMs: kbNodesResult.elapsed_ms,
  }, "kb_nodes_context_injected");

  return kbNodesResult;
}

function injectStructuredKbAnswer(messages: AiMessage[], kbAnswer: string, kbConfidence: number): void {
  if (!kbAnswer || kbConfidence < 0.2) return;

  messages.splice(Math.max(messages.length - 1, 1), 0, {
    role: "system",
    content: `[مرجع من قاعدة المعرفة - ثقة ${Math.round(kbConfidence * 100)}%]:\n${kbAnswer}\n\nاستخدم هذه المعلومات كمرجع أساسي في إجابتك إذا كانت ذات صلة بسؤال المستخدم.`,
  });
}

async function completeAiWithRetries(
  deps: ChatServiceDeps,
  aiChat: AiChatProvider,
  body: ChatRequest,
  messages: AiMessage[],
  userId: string,
): Promise<{ replyText: string; lastAiErr: unknown }> {
  const maxAiAttempts = Number(process.env.AI_RETRY_COUNT || "2");
  let lastAiErr: unknown = null;

  for (let attempt = 0; attempt <= maxAiAttempts; attempt++) {
    try {
      const doComplete = () => aiChat.complete(messages);
      const replyText = deps.aiProviderCircuitBreaker
        ? await deps.aiProviderCircuitBreaker.call(doComplete)
        : await doComplete();
      return { replyText, lastAiErr: null };
    } catch (error) {
      lastAiErr = error;
      deps.log.warn({
        err: error,
        aiErrMsg: getUnknownErrorMessage(error),
        userId,
        channel: body.channel,
        messagePreview: body.message?.slice(0, 120),
        attempt: attempt + 1,
        maxAiAttempts,
        provider: deps.getAiProvider(),
        model: deps.getAiModel(),
      }, "ai_complete_attempt_failed");

      // Circuit breaker is OPEN — no point retrying; fail immediately
      if (error instanceof CircuitBreakerError) throw error;

      if (attempt < maxAiAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  return { replyText: "", lastAiErr };
}

function applyAiQualityGate(
  deps: ChatServiceDeps,
  body: ChatRequest,
  replyText: string,
  prefetch: KbPrefetchResult,
): string {
  let nextReply = replyText;
  const requestedLang = (body.lang || "ar").toLowerCase();

  if (!nextReply && prefetch.kbAnswer && prefetch.kbConfidence >= 0.2) {
    deps.log.warn({ kbConfidence: prefetch.kbConfidence, model: deps.getAiModel() }, "AI returned empty response — using KB answer");
    nextReply = prefetch.kbAnswer;
  }

  if (requestedLang === "ar" && nextReply) {
    const repaired = fixMojibake(nextReply);
    const arabicChars = countArabic(repaired);
    const totalChars = repaired.replace(/\s+/g, "").length || 1;
    const arabicRatio = arabicChars / totalChars;
    if (arabicRatio < 0.3 && prefetch.kbAnswer && prefetch.kbConfidence >= 0.2) {
      deps.log.warn({ arabicRatio: arabicRatio.toFixed(2), kbConfidence: prefetch.kbConfidence, model: deps.getAiModel() }, "AI response has low Arabic ratio — substituting KB answer");
      nextReply = prefetch.kbAnswer;
    } else if (repaired !== nextReply) {
      nextReply = repaired;
    }
  }

  if (nextReply && looksLikeRawKbEcho(nextReply) && prefetch.kbChunks.length > 0) {
    deps.log.warn({ model: deps.getAiModel(), provider: deps.getAiProvider() }, "AI response echoed raw KB context — substituting cleaned KB fallback");
    nextReply = buildKbFallbackReply(prefetch.kbChunks);
  }

  return cleanupDeterministicReplyText(nextReply);
}

function updateConversationHistory(
  deps: ChatServiceDeps,
  userId: string,
  history: AiMessage[],
  userMessage: string,
  replyText: string,
): void {
  history.push(
    { role: "user", content: userMessage },
    { role: "assistant", content: replyText },
  );
  if (history.length > 12) history.splice(0, history.length - 12);
  deps.aiConversationHistory.set(userId, history);
}

async function buildAiResponseDebug(
  deps: ChatServiceDeps,
  prefetch: KbPrefetchResult,
  emoScore: number,
  clarifyingQuestion?: string | null,
): Promise<Record<string, unknown>> {
  const debug: Record<string, unknown> = {
    ai: { provider: deps.getAiProvider(), model: deps.getAiModel(), ragChunks: prefetch.kbChunks.length, ragTotal: deps.getRagChunkCount() },
    kbPrefetch: { confidence: prefetch.kbConfidence, hits: prefetch.kbHits.length },
    emotionalScore: emoScore,
  };
  if (clarifyingQuestion) debug.legacy = { clarifying_question: clarifyingQuestion };

  const kbStore = deps.getKbStore();
  if (kbStore) debug.kb = await kbStore.stats();
  return debug;
}

export function createChatService(deps: ChatServiceDeps) {
  const hybridRouteEngine = new HybridRouteDecisionEngine();

  function mapRouteModule(module: string, response: ChatResponse): WatanyModule | undefined {
    if (response.module === "salary" || module === "salary") return "salary";
    if (response.module === "payment" || module === "payment" || module === "admin_override") return "payment";
    if (response.module === "recruitment" || module === "recruitment" || module === "announcement") return "recruitment";
    if (response.module === "phonebook" || module === "directory") return "phonebook";
    if (response.module === "procedure" || module === "procedure" || module === "procedure_confirmation") return "procedure";
    if (response.module === "community" || module === "community") return "community";
    if (response.module === "community_group" || module === "community_group") return "community_group";
    if (response.module === "support" || module === "support") return "support";
    if (response.module === "documents" || module === "documents") return "documents";
    if (response.module === "laws" || module === "laws" || module === "kb") return undefined;
    if (response.module === "assistant" || module === "assistant" || module === "smalltalk") return "assistant";
    return undefined;
  }

  function buildHybridDecision(
    conversationKey: string,
    question: string,
    module: string,
    response: ChatResponse,
  ): HybridRouteDecision {
    const conversationContext = getConversationContext(deps, conversationKey) || undefined;
    return hybridRouteEngine.decide({
      rawText: question,
      normalizedText: normalizeArabic(cleanDisplayText(question)),
      currentModule: mapRouteModule(module, response),
      previousIntent: conversationContext?.originalIntent,
      conversationContext,
    });
  }

  function enrichChatResponse(
    conversationKey: string,
    question: string,
    module: string,
    response: ChatResponse,
  ): ChatResponse {
    const routeDecision = response.routeDecision || buildHybridDecision(conversationKey, question, module, response);
    const hydratedCtas = hydrateCtasFromResponse(response.ctas || routeDecision.suggestedActions, response);
    const context = getConversationContext(deps, conversationKey) || {
      conversationId: conversationKey,
      updatedAt: NOW_ISO(),
      activeDestination: routeDecision.destination,
      activeIntent: routeDecision.hybridIntent,
      source: routeDecision.mode === "conversation" ? "assistant" : routeDecision.mode,
    };

    return {
      ...response,
      module: response.module || routeDecision.destination,
      mode: response.mode || routeDecision.mode,
      ctas: hydratedCtas,
      routeDecision: {
        ...routeDecision,
        suggestedActions: hydratedCtas,
      },
      context: {
        ...context,
        activeDestination: routeDecision.destination,
        activeIntent: routeDecision.hybridIntent,
        lastSuggestedActions: hydratedCtas.map((item) => item.label),
      },
      intents: mergeHybridIntents(response.intents, ctasToActionIntents(hydratedCtas)),
    };
  }

  function rememberResponseContext(
    conversationKey: string,
    response: ChatResponse,
    module: string,
    question: string,
    preserveOriginalQuestion?: string,
    routeDecision?: HybridRouteDecision,
  ): void {
    setConversationContext(deps, conversationKey, {
      originalQuestion: preserveOriginalQuestion || cleanDisplayText(question),
      originalIntent: module,
      originalModule: module,
      activeIntent: routeDecision?.hybridIntent,
      activeDestination: routeDecision?.destination,
      lastAnswer: response.reply ? cleanDisplayText(response.reply) : undefined,
      lastSuggestedActions: routeDecision?.suggestedActions.map((item) => item.label),
      pendingClarification: Boolean(response.clarifying_question),
      awaitingTopicDecision: false,
      source: routeDecision?.mode === "conversation" ? "assistant" : routeDecision?.mode,
    });
  }

  function finalizeChatResponse(params: {
    conversationKey: string;
    response: ChatResponse;
    module: string;
    startedAt: number;
    timings: ChatTimings;
    question: string;
    preserveOriginalQuestion?: string;
    skipContextUpdate?: boolean;
    managePendingSelection?: boolean;
  }): ChatResponse {
    const {
      conversationKey,
      response,
      module,
      startedAt,
      timings,
      question,
      preserveOriginalQuestion,
      skipContextUpdate = false,
      managePendingSelection = true,
    } = params;

    if (managePendingSelection) {
      const pendingOptions = response.menu ? extractPendingClarificationOptions(response) : [];
      if (response.clarifying_question && pendingOptions.length > 0) {
        setPendingClarificationSelection(deps, conversationKey, pendingOptions, response.clarifying_question);
      } else {
        clearPendingClarificationSelection(deps, conversationKey);
      }
    }

    const finalized = attachTimings(response, {
      ...timings,
      totalMs: Date.now() - startedAt,
    });

    if (!skipContextUpdate && module !== "smalltalk") {
      const routeDecision = finalized.routeDecision || buildHybridDecision(conversationKey, question, module, finalized);
      rememberResponseContext(conversationKey, finalized, module, question, preserveOriginalQuestion, routeDecision);
    }

    return enrichChatResponse(conversationKey, question, module, finalized);
  }

  async function resolveDeterministicChatResponse(body: ChatRequest): Promise<{
    response: ChatResponse | null;
    timings: ChatTimings;
    preserveOriginalQuestion?: string;
  }> {
    const userId = body.userId || "anonymous";
    const conversationKey = getConversationKey(body, userId);
    const startedAt = Date.now();
    const timings: ChatTimings = {};
    let workingBody = body;
    let preserveOriginalQuestion: string | undefined;
    const conversationContext = getConversationContext(deps, conversationKey);

    if (conversationContext?.awaitingTopicDecision) {
      if (isNewTopicDecision(body.message)) {
        clearConversationContext(deps, conversationKey);
        clearPendingClarificationSelection(deps, conversationKey);
        return {
          response: attachTimings({
            reply: "تمام، اطرح الموضوع الجديد وسأتعامل معه كسؤال مستقل.",
            intents: [],
            debug: { topic_reset: true },
          }, { totalMs: Date.now() - startedAt }),
          timings,
        };
      }

      if (isSameTopicDecision(body.message)) {
        setConversationContext(deps, conversationKey, {
          pendingClarification: false,
          awaitingTopicDecision: false,
        });
        return {
          response: finalizeChatResponse({
            conversationKey,
            response: {
              reply: "تمام، كمّل سؤالك بنفس الموضوع وسأبني على السؤال الأساسي.",
              intents: [],
              debug: { same_topic_confirmed: true },
            },
            module: "clarification",
            startedAt,
            timings,
            question: conversationContext.originalQuestion || body.message,
            preserveOriginalQuestion: conversationContext.originalQuestion,
            skipContextUpdate: true,
            managePendingSelection: false,
          }),
          timings,
          preserveOriginalQuestion: conversationContext.originalQuestion,
        };
      }

      preserveOriginalQuestion = conversationContext.originalQuestion;
      workingBody = { ...body, message: buildAnchoredMessage(body.message, conversationContext) };
      setConversationContext(deps, conversationKey, {
        pendingClarification: false,
        awaitingTopicDecision: false,
      });
    } else if (shouldReuseConversationContext(body.message, conversationContext)) {
      if (conversationContext?.originalQuestion) {
        preserveOriginalQuestion = conversationContext.originalQuestion;
        workingBody = { ...body, message: buildAnchoredMessage(body.message, conversationContext) };
        setConversationContext(deps, conversationKey, {
          pendingClarification: false,
          awaitingTopicDecision: false,
        });
      }
    }

    const pendingProcedure = getPendingProcedureConfirmation(deps, conversationKey);
    const pendingClarification = getPendingClarificationSelection(deps, conversationKey);

    const pendingProcedureResponse = handlePendingProcedureReply(deps, conversationKey, body.message, pendingProcedure);
    if (pendingProcedureResponse) {
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: pendingProcedureResponse,
          module: "procedure_confirmation",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    const pendingClarificationResult = handlePendingClarificationReply(deps, conversationKey, body.message, pendingClarification);
    if (pendingClarificationResult.response) {
      const pendingDecision = Boolean(
        pendingClarificationResult.response.debug
        && typeof pendingClarificationResult.response.debug === "object"
        && pendingClarificationResult.response.debug.awaiting_topic_decision,
      );
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: pendingClarificationResult.response,
          module: "clarification",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
          skipContextUpdate: pendingDecision,
          managePendingSelection: !pendingDecision,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }
    if (pendingClarificationResult.selectedQuery) {
      workingBody = { ...workingBody, message: pendingClarificationResult.selectedQuery };
      preserveOriginalQuestion ||= conversationContext?.originalQuestion || pendingClarificationResult.selectedQuery;
    }

    const adminOverrideStartedAt = Date.now();
    const paymentAnswer = buildPaymentAnswerResponse(workingBody.message);
    timings.adminOverrideMs = Date.now() - adminOverrideStartedAt;
    if (paymentAnswer) {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: paymentAnswer,
          module: "admin_override",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    // ── Deaths / obituary upload — must intercept before recruitment scorer ──
    const obituaryUploadResponse = isObituaryUploadQuery(workingBody.message) ? buildObituaryUploadResponse() : null;
    if (obituaryUploadResponse) {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: obituaryUploadResponse,
          module: "obituary_upload",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    const deathsQueryResponse = isDeathsQuery(workingBody.message) ? buildDeathsResponse() : null;
    if (deathsQueryResponse) {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: deathsQueryResponse,
          module: "deaths",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    // ── ISF laws — must intercept before recruitment scorer picks up "قوى الأمن" ──
    const isfLawsQueryResponse = isIsfLawsQuery(workingBody.message) ? buildIsfLawsResponse() : null;
    if (isfLawsQueryResponse) {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: isfLawsQueryResponse,
          module: "isf_laws",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    // ── Useful links ──────────────────────────────────────────────────────────
    const usefulLinksQueryResponse = isUsefulLinksQuery(workingBody.message) ? buildUsefulLinksResponse() : null;
    if (usefulLinksQueryResponse) {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: usefulLinksQueryResponse,
          module: "useful_links",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    const recruitmentStartedAt = Date.now();
    const recruitmentResponse = buildRecruitmentResponse(workingBody.message);
    const recruitmentKind = recruitmentResponse?.debug && typeof recruitmentResponse.debug === "object"
      ? recruitmentResponse.debug.recruitment_kind
      : null;
    const recruitmentLookupMs = Date.now() - recruitmentStartedAt;
    timings.announcementMs = recruitmentLookupMs;
    if (recruitmentResponse && recruitmentKind === "announcement") {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: recruitmentResponse,
          module: "announcement",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    const directoryLookupResponse = buildDirectoryLookupResponse(deps.repoRootPath, workingBody.message);
    if (directoryLookupResponse) {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: directoryLookupResponse,
          module: "directory",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    const salaryStartedAt = Date.now();
    const welfareResponse = isWelfareSourceQuery(workingBody.message) ? buildWelfareSourceResponse() : null;
    if (welfareResponse) {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: welfareResponse,
          module: "welfare_source",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }
    const salaryAgentInput = prepareWatanyAgentInput(workingBody.message);
    let rawSalaryResponse: ChatResponse | null = null;
    if (isSalaryAttestationQuery(workingBody.message)) {
      rawSalaryResponse = buildSalaryAttestationResponse();
    } else if (isBroadPensionFinanceQuery(workingBody.message)) {
      rawSalaryResponse = buildBroadPensionFinanceResponse();
    } else if (isSalaryModuleQuery(workingBody.message)) {
      rawSalaryResponse = buildSalaryModuleResponse();
    }
    const salaryResponse = rawSalaryResponse
      ? finalizeAgentAwareResponse(workingBody.message, rawSalaryResponse, salaryAgentInput)
      : null;
    timings.salaryMs = Date.now() - salaryStartedAt;
    if (salaryResponse) {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: salaryResponse,
          module: "salary",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    const paymentStartedAt = Date.now();
    const paymentClarification = shouldClarifyPaymentTimingQuery(workingBody.message)
      ? buildPaymentTimingClarificationResponse(workingBody.message)
      : null;
    timings.paymentMs = Date.now() - paymentStartedAt;
    if (paymentClarification) {
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: paymentClarification,
          module: "payment",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    timings.recruitmentMs = recruitmentLookupMs;
    if (recruitmentResponse) {
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: recruitmentResponse,
          module: "recruitment",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    if (shouldForceImmediateTopicClarification(workingBody.message)) {
      const topicOptions = buildGenericTopicOptions(workingBody.message);
      deps.logUnrecognizedInput({
        ts: new Date().toISOString(),
        message: workingBody.message,
        userId,
        channel: body.channel || "web",
        reason: "insufficient_context",
      });
      deps.log.info({ message: workingBody.message, forcedClarification: true, earlyTopicClarification: true }, "unrecognized_short_input");
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: {
            reply: buildClarificationReply(topicOptions),
            intents: buildSuggestionIntents(topicOptions),
            clarifying_question: "أي موضوع تقصد تحديداً؟",
            menu: buildClarificationOptionsWithOther(topicOptions),
            debug: {
              unrecognized: true,
              reason: "insufficient_context",
              forcedClarification: true,
              earlyTopicClarification: true,
              fallbackTopics: topicOptions,
            },
          },
          module: "clarification",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    const procedureLookupMatch = await findProcedureLookupMatch(workingBody.message);
    if (procedureLookupMatch?.kind === "clarify") {
      deps.log.info({ query: workingBody.message, procedureTitles: procedureLookupMatch.candidates.map((candidate) => candidate.procedureTitle) }, "procedure_confirmation_clarified");
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: buildProcedureClarificationResponse(procedureLookupMatch.candidates),
          module: "procedure",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    if (procedureLookupMatch?.kind === "display") {
      deps.log.info({ query: workingBody.message, procedureId: procedureLookupMatch.candidate.procedureId }, "procedure_confirmation_exact_match");
      clearPendingClarificationSelection(deps, conversationKey);
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: buildProcedureDisplayResponseFromCandidate(procedureLookupMatch.candidate),
          module: "procedure",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    if (procedureLookupMatch?.kind === "confirm") {
      setPendingProcedureConfirmation(deps, conversationKey, procedureLookupMatch.candidate);
      clearPendingClarificationSelection(deps, conversationKey);
      deps.log.info({ query: workingBody.message, procedureId: procedureLookupMatch.candidate.procedureId }, "procedure_confirmation_prompted");
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: buildProcedureConfirmationResponse(procedureLookupMatch.candidate),
          module: "procedure",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    const relevance = deps.evaluateRelevance(workingBody.message, deps.aiRagTopK);
    const isShortCasual = (workingBody.message.trim().split(/\s+/).length <= 4) && relevance.confidence === "none";
    const shouldForceGenericClarification = shouldForceGenericTopicClarification(workingBody.message)
      && (!deps.useAi || relevance.confidence !== "high");

    if (isShortCasual || shouldForceGenericClarification) {
      const topicOptions = buildGenericTopicOptions(workingBody.message);
      const reason = isShortCasual ? "short_no_kb_match" : "insufficient_context";
      deps.logUnrecognizedInput({
        ts: new Date().toISOString(),
        message: workingBody.message,
        userId,
        channel: body.channel || "web",
        reason,
      });
      deps.log.info({ message: workingBody.message, relevance, forcedClarification: shouldForceGenericClarification }, "unrecognized_short_input");
      return {
        response: finalizeChatResponse({
          conversationKey,
          response: {
            reply: buildClarificationReply(topicOptions),
            intents: buildSuggestionIntents(topicOptions),
            clarifying_question: "أي موضوع تقصد تحديداً؟",
            menu: buildClarificationOptionsWithOther(topicOptions),
            debug: { unrecognized: true, relevance, reason, fallbackTopics: topicOptions, forcedClarification: shouldForceGenericClarification },
          },
          module: "clarification",
          startedAt,
          timings,
          question: workingBody.message,
          preserveOriginalQuestion,
        }),
        timings,
        preserveOriginalQuestion,
      };
    }

    clearPendingClarificationSelection(deps, conversationKey);
    return { response: null, timings, preserveOriginalQuestion };
  }

  async function fetchChatResponseLegacy(body: ChatRequest): Promise<ChatResponse> {
    if (deps.usePython) {
      const payload = { question: body.message, lang: body.lang, channel: body.channel || "web" };
      const pythonBase = deps.getPythonBase();
      const fallbackBase = pythonBase.includes(":8010") ? "http://localhost:8000" : "";
      const candidates = [pythonBase, fallbackBase].filter(Boolean);

      for (const base of candidates) {
        const response = await requestLegacyCandidate(deps, base, payload);
        if (response) {
          return response;
        }
      }
    }

    return buildLegacyFallbackResponse(deps);
  }

  async function fetchChatResponseAi(
    body: ChatRequest,
    options?: {
      conversationKey?: string;
      startedAt?: number;
      timings?: ChatTimings;
      preserveOriginalQuestion?: string;
      historyMessage?: string;
    },
  ): Promise<ChatResponse> {
    const aiChat = deps.getAiChat();
    let lastAiErr: unknown = null;
    let aiStartedAt: number | null = null;
    const userId = body.userId || "anonymous";
    const conversationKey = options?.conversationKey || getConversationKey(body, userId);
    const startedAt = options?.startedAt ?? Date.now();
    const timings: ChatTimings = { ...options?.timings };
    const historyMessage = options?.historyMessage || body.message;
    const agentInput = prepareWatanyAgentInput(body.message);
    const retrievalHints: AgentRetrievalHints = {
      scopeHints: agentInput.kbScopes,
      tagIds: agentInput.tags.map((tag) => tag.tagId),
    };

    try {
      const prefetch = await fetchKbPrefetch(deps, body, retrievalHints);
      timings.kbMs = prefetch.elapsedMs;
      if (prefetch.cacheHit) timings.cacheHit = true;
      const shortcutResponse = await resolveAiPrefetchShortcut(deps, body, prefetch, aiChat, fetchChatResponseLegacy);
      if (shortcutResponse) {
        return finalizeChatResponse({
          conversationKey,
          response: finalizeAgentAwareResponse(body.message, shortcutResponse, agentInput),
          module: "kb",
          startedAt,
          timings,
          question: body.message,
          preserveOriginalQuestion: options?.preserveOriginalQuestion,
        });
      }
      if (!aiChat) {
        const legacy = await fetchChatResponseLegacy(body);
        return finalizeChatResponse({
          conversationKey,
          response: finalizeAgentAwareResponse(body.message, legacy, agentInput),
          module: "legacy",
          startedAt,
          timings,
          question: body.message,
          preserveOriginalQuestion: options?.preserveOriginalQuestion,
        });
      }

      const aiContextChunks = prefetch.kbChunks.slice(0, MAX_AI_CONTEXT_CHUNKS);
      deps.log.info({ query: body.message, chunks: aiContextChunks.length }, "Parallel RAG retrieval completed");

      const history = deps.aiConversationHistory.get(userId) || [];
      const messages = deps.buildAiMessages(body.message, aiContextChunks, history, deps.aiSystemPrompt || undefined);
  appendAgentSystemInstruction(messages, agentInput.agentSystemInstruction);
      const emoScore = injectEmotionalContext(deps, body, userId, messages);
      injectKbNodesContext(deps, body, messages);
      injectStructuredKbAnswer(messages, prefetch.kbAnswer, prefetch.kbConfidence);

      aiStartedAt = Date.now();
      const aiCompletion = await completeAiWithRetries(deps, aiChat, body, messages, userId);
      timings.openAiMs = Date.now() - aiStartedAt;
      lastAiErr = aiCompletion.lastAiErr;
      const replyText = applyAiQualityGate(deps, body, aiCompletion.replyText, prefetch);

      const extracted = deps.extractIntents(replyText);
      const intents = extracted.intents as unknown as ChatResponse["intents"];
      const clarifyingQuestion = extracted.clarifyingQuestion;

      updateConversationHistory(deps, userId, history, historyMessage, replyText);
      const debug = await buildAiResponseDebug(deps, prefetch, emoScore, clarifyingQuestion);
      debug.agent = buildAgentDebug(agentInput);

      return finalizeChatResponse({
        conversationKey,
        response: {
          reply: finalizeWatanyAgentAnswer(body.message, addFollowupPrompt(replyText)),
          intents,
          sources: prefetch.sources,
          debug,
        },
        module: "ai",
        startedAt,
        timings,
        question: body.message,
        preserveOriginalQuestion: options?.preserveOriginalQuestion,
      });
    } catch (err) {
      if (aiStartedAt !== null && timings.openAiMs === undefined) {
        timings.openAiMs = Date.now() - aiStartedAt;
      }
      const failureMessage = lastAiErr ? getUnknownErrorMessage(lastAiErr) : getUnknownErrorMessage(err);
      deps.aiFailureCount.value++;
      deps.lastAiFailure.value = {
        at: Date.now(),
        route: "complete",
        message: failureMessage,
      };
      deps.log.error({
        err, userId: body.userId || "anonymous",
        provider: deps.getAiProvider(), model: deps.getAiModel(),
        aiFailureCount: deps.aiFailureCount.value,
      }, "AI chat failed");

      // RAG-only fallback
      try {
        const fallbackChunks = deps.retrieveChunks(body.message, deps.aiRagTopK, retrievalHints.scopeHints);
        if (fallbackChunks.length > 0) {
          const ragReply = buildDeterministicAiReply("", 0, fallbackChunks);
          deps.log.info({ chunks: fallbackChunks.length }, "Returning RAG-only fallback (AI timed out)");
          return finalizeChatResponse({
            conversationKey,
            response: finalizeAgentAwareResponse(body.message, {
              reply: addFollowupPrompt(ragReply),
              intents: [],
              sources: buildChatSources(fallbackChunks),
              debug: { ragOnlyFallback: true, chunks: fallbackChunks.length, aiError: getUnknownErrorMessage(err) },
            }, agentInput),
            module: "kb",
            startedAt,
            timings,
            question: body.message,
            preserveOriginalQuestion: options?.preserveOriginalQuestion,
          });
        }
      } catch { /* ignore RAG errors */ }

      deps.logUnrecognizedInput({
        ts: new Date().toISOString(), message: body.message,
        userId: body.userId || "anonymous", channel: body.channel || "web",
        reason: "ai_failed_no_rag",
      });
      return finalizeChatResponse({
        conversationKey,
        response: finalizeAgentAwareResponse(body.message, {
          reply: deps.getRandomClarifyResponse(),
          intents: [],
          debug: { unrecognized: true, reason: "ai_failed_no_rag", aiError: (err instanceof Error ? err.message : String(err)) },
        }, agentInput),
        module: "clarification",
        startedAt,
        timings,
        question: body.message,
        preserveOriginalQuestion: options?.preserveOriginalQuestion,
      });
    }
  }

  async function fetchChatResponse(body: ChatRequest): Promise<ChatResponse> {
    const userId = body.userId || "anonymous";
    const conversationKey = getConversationKey(body, userId);
    const startedAt = Date.now();

    // Small-talk fast path
    const chitchat = deps.classifySmallTalk(body.message);
    if (chitchat) {
      deps.log.info({ intent: chitchat.name }, "chat_chitchat_fast_path");
      clearPendingClarificationSelection(deps, conversationKey);
      return finalizeChatResponse({
        conversationKey,
        response: { reply: chitchat.response, intents: [], debug: { chitchat: chitchat.name }, module: "assistant" },
        module: "assistant",
        startedAt,
        timings: { totalMs: Date.now() - startedAt },
        question: body.message,
      });
    }

    const deterministic = await resolveDeterministicChatResponse(body);
    if (deterministic.response) return deterministic.response;

    if (deps.useAi) {
      return fetchChatResponseAi(body, {
        conversationKey,
        startedAt,
        timings: deterministic.timings,
        preserveOriginalQuestion: deterministic.preserveOriginalQuestion,
        historyMessage: body.message,
      });
    }

    deps.log.info({ useAi: deps.useAi, aiChatInitialized: !!deps.getAiChat() }, "routing_to_legacy_chat");
    const legacyResponse = await fetchChatResponseLegacy(body);
    return finalizeChatResponse({
      conversationKey,
      response: legacyResponse,
      module: "legacy",
      startedAt,
      timings: deterministic.timings,
      question: body.message,
      preserveOriginalQuestion: deterministic.preserveOriginalQuestion,
    });
  }

  return { fetchChatResponse, fetchChatResponseLegacy, fetchChatResponseAi, resolveDeterministicChatResponse };
}
