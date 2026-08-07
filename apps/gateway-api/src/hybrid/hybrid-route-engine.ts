import { normalizeArabic } from "@watany/shared/arabic";
import type {
  ConversationContext,
  HybridIntent,
  HybridRouteDecision,
  HybridRouteInput,
  HybridRouteMode,
  WatanyModule,
} from "@watany/types";
import { generateHybridSuggestions } from "./suggestion-engine";

const SALARY_TERMS = ["احسب", "معاش", "راتب", "حساب", "حاسبه", "حاسبة", "تعويض"];
const PAYMENT_TERMS = ["دفع", "دفعات", "منحة", "مستحق", "مستحقات", "مصارف", "بنك", "نزلت"];
const RECRUITMENT_TERMS = ["تطويع", "تجنيد", "جيش", "عسكري", "مباراة", "دورة"];
const PHONE_TERMS = ["رقم", "هاتف", "تلفون", "اتصال", "مستشفى", "جهة", "دليل"];
const PROCEDURE_TERMS = ["معاملة", "إجراء", "طلب", "نموذج", "مستندات", "كيف", "إخراج قيد"];
const LAW_TERMS = ["قانون", "حقوق", "مادة", "مرسوم", "تشريع", "نص"];
const COMMUNITY_TERMS = ["شو رأيكن", "شو رايكن", "شو رأيكم", "المجموعة", "المجتمع", "اسال المجموعة", "نقاش", "جروب"];
const LIVE_TERMS = ["جلسة", "مباشر", "لايف", "live"];
const SUPPORT_TERMS = ["دعم", "مشكلة", "ساعدني", "لا يعمل", "ما عم يشتغل", "ما اشتغل"];
const FOLLOWUP_TERMS = ["وين", "كيف", "امتى", "شو", "هل", "مكان", "", "المستندات"];

function normalizeHybridText(text: string): string {
  return normalizeArabic(String(text || "").trim().toLowerCase()).replace(/\s+/g, " ");
}

function includesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(normalizeHybridText(term)));
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function moduleDecision(
  destination: WatanyModule,
  mode: HybridRouteMode,
  reason: string,
  confidence: number,
  hybridIntent: HybridIntent,
  context?: ConversationContext,
): HybridRouteDecision {
  const base: Omit<HybridRouteDecision, "suggestedActions"> = {
    mode,
    destination,
    confidence,
    reason,
    shouldOpenFlow: mode === "service",
    shouldAnswerInline: mode === "lookup",
    contextPatch: {
      activeDestination: destination,
      activeIntent: hybridIntent,
      awaitingTopicDecision: false,
      pendingClarification: false,
      source: mode === "conversation" ? "assistant" : mode,
    },
    hybridIntent,
  };

  return {
    ...base,
    suggestedActions: generateHybridSuggestions({ conversationContext: context, routeDecision: base }),
  };
}

function contextFollowupDecision(context: ConversationContext | undefined, normalizedText: string): HybridRouteDecision | null {
  if (!context?.activeDestination) return null;
  if (!context.originalQuestion) return null;

  const shortFollowup = wordCount(normalizedText) <= 4 || includesAny(normalizedText, FOLLOWUP_TERMS);
  if (!shortFollowup) return null;

  switch (context.activeDestination) {
    case "recruitment":
      return moduleDecision("recruitment", "lookup", "active_conversation_followup_recruitment", 0.91, "ask_recruitment", context);
    case "payment":
      return moduleDecision("payment", normalizedText.includes("كيف") ? "service" : "lookup", "active_conversation_followup_payment", 0.9, "ask_payment", context);
    case "procedure":
      return moduleDecision("procedure", "service", "active_conversation_followup_procedure", 0.9, "procedure_help", context);
    case "laws":
      return moduleDecision("laws", "lookup", "active_conversation_followup_laws", 0.88, "legal_lookup", context);
    default:
      return moduleDecision(context.activeDestination, context.activeDestination === "community" || context.activeDestination === "community_group" ? "conversation" : "service", "active_conversation_followup_context", 0.82, context.activeIntent || "general_assistant", context);
  }
}

function currentModuleDecision(
  currentModule: WatanyModule,
  normalizedText: string,
  context: ConversationContext | undefined,
): HybridRouteDecision {
  if (currentModule === "community_group") {
    return moduleDecision("community_group", "conversation", "explicit_current_module", 0.98, includesAny(normalizedText, LIVE_TERMS) ? "join_live_session" : "community_discussion", context);
  }

  if (currentModule === "community") {
    return moduleDecision("community", "conversation", "explicit_current_module", 0.98, "community_discussion", context);
  }

  if (currentModule === "assistant") {
    return moduleDecision("assistant", "conversation", "explicit_current_module", 0.74, "general_assistant", context);
  }

  const moduleIntentMap: Record<Exclude<WatanyModule, "assistant" | "community" | "community_group" | "support">, HybridIntent> = {
    salary: "calculate_salary",
    procedure: "procedure_help",
    payment: "ask_payment",
    recruitment: "ask_recruitment",
    phonebook: "phone_lookup",
    documents: "procedure_help",
    laws: "legal_lookup",
  };

  const explicitMode: HybridRouteMode = currentModule === "phonebook" || currentModule === "laws" || currentModule === "recruitment"
    ? "lookup"
    : "service";

  return moduleDecision(currentModule, explicitMode, "explicit_current_module", 0.98, moduleIntentMap[currentModule as keyof typeof moduleIntentMap] || "general_assistant", context);
}

function simpleKeywordDecision(
  normalizedText: string,
  options: {
    readonly terms: readonly string[];
    readonly destination: WatanyModule;
    readonly mode: HybridRouteMode;
    readonly reason: string;
    readonly confidence: number;
    readonly hybridIntent: HybridIntent;
    readonly context: ConversationContext | undefined;
  },
): HybridRouteDecision | null {
  if (!includesAny(normalizedText, options.terms)) {
    return null;
  }

  return moduleDecision(options.destination, options.mode, options.reason, options.confidence, options.hybridIntent, options.context);
}

function paymentKeywordDecision(normalizedText: string, context: ConversationContext | undefined): HybridRouteDecision | null {
  if (!includesAny(normalizedText, PAYMENT_TERMS)) {
    return null;
  }

  const lookup = includesAny(normalizedText, ["نزلت", "امتى", "ايمتى", "متى", "شو صار"]);
  return moduleDecision("payment", lookup ? "lookup" : "service", lookup ? "payment_lookup_keywords" : "payment_service_keywords", lookup ? 0.9 : 0.86, "ask_payment", context);
}

function communityKeywordDecision(normalizedText: string, context: ConversationContext | undefined): HybridRouteDecision | null {
  if (!includesAny(normalizedText, COMMUNITY_TERMS)) {
    return null;
  }

  const destination: WatanyModule = includesAny(normalizedText, ["المجموعة", "جروب", "شو رأيكن", "شو رايكن", "اسال المجموعة"])
    ? "community_group"
    : "community";
  return moduleDecision(destination, "conversation", "community_keywords", 0.85, includesAny(normalizedText, LIVE_TERMS) ? "join_live_session" : "community_discussion", context);
}

function keywordDecision(normalizedText: string, context: ConversationContext | undefined): HybridRouteDecision | null {
  const salaryRoute = simpleKeywordDecision(normalizedText, { terms: SALARY_TERMS, destination: "salary", mode: "service", reason: "salary_keywords", confidence: 0.96, hybridIntent: "calculate_salary", context });
  if (salaryRoute) {
    return salaryRoute;
  }

  const paymentRoute = paymentKeywordDecision(normalizedText, context);
  if (paymentRoute) {
    return paymentRoute;
  }

  const recruitmentRoute = simpleKeywordDecision(normalizedText, { terms: RECRUITMENT_TERMS, destination: "recruitment", mode: "lookup", reason: "recruitment_keywords", confidence: 0.91, hybridIntent: "ask_recruitment", context });
  if (recruitmentRoute) {
    return recruitmentRoute;
  }

  const phoneRoute = simpleKeywordDecision(normalizedText, { terms: PHONE_TERMS, destination: "phonebook", mode: "lookup", reason: "phone_lookup_keywords", confidence: 0.93, hybridIntent: "phone_lookup", context });
  if (phoneRoute) {
    return phoneRoute;
  }

  const procedureRoute = simpleKeywordDecision(normalizedText, { terms: PROCEDURE_TERMS, destination: "procedure", mode: "service", reason: "procedure_keywords", confidence: 0.89, hybridIntent: "procedure_help", context });
  if (procedureRoute) {
    return procedureRoute;
  }

  const lawsRoute = simpleKeywordDecision(normalizedText, { terms: LAW_TERMS, destination: "laws", mode: "lookup", reason: "legal_lookup_keywords", confidence: 0.87, hybridIntent: "legal_lookup", context });
  if (lawsRoute) {
    return lawsRoute;
  }

  const communityRoute = communityKeywordDecision(normalizedText, context);
  if (communityRoute) {
    return communityRoute;
  }

  const supportRoute = simpleKeywordDecision(normalizedText, { terms: SUPPORT_TERMS, destination: "support", mode: "conversation", reason: "support_keywords", confidence: 0.81, hybridIntent: "support_request", context });
  if (supportRoute) {
    return supportRoute;
  }

  return null;
}

export class HybridRouteDecisionEngine {
  decide(input: HybridRouteInput): HybridRouteDecision {
    const normalizedText = normalizeHybridText(input.normalizedText || input.rawText);
    const context = input.conversationContext;

    if (context?.userRole === "superadmin" && includesAny(normalizedText, ["اعلان", "تعميم", "نشر", "ادارة"])) {
      return moduleDecision("support", "conversation", "superadmin_override", 0.97, "support_request", context);
    }

    if (input.currentModule) {
      return currentModuleDecision(input.currentModule, normalizedText, context);
    }

    if (context?.activeAnnouncementId && includesAny(normalizedText, ["اعلان", "تفاصيل", "متى", "مكان"])) {
      return moduleDecision("recruitment", "lookup", "active_announcement", 0.9, "ask_recruitment", context);
    }

    const followup = contextFollowupDecision(context, normalizedText);
    if (followup) {
      return followup;
    }

    const keywordRoute = keywordDecision(normalizedText, context);
    if (keywordRoute) {
      return keywordRoute;
    }

    return moduleDecision("assistant", "conversation", "openai_fallback", 0.51, "general_assistant", context);
  }
}