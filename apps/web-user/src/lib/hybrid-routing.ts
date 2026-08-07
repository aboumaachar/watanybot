import type { ActionIntent, CTAAction } from "../types/domain";
import type { Mode } from "../store/app";

export type { CTAAction } from "../types/domain";

export type UXMode = "conversation" | "service" | "lookup";

export type WatanyRouteTarget =
  | "community"
  | "assistant"
  | "forms"
  | "salary"
  | "procedure"
  | "payment"
  | "recruitment"
  | "phonebook"
  | "documents"
  | "laws";

export type WatanyRouteDecision = {
  mode: UXMode;
  target: WatanyRouteTarget;
  confidence: number;
  suggestedActions: string[];
};

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function normalizeWatanyText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .trim();
}

function createNavigateAction(id: string, label: string, mode: Mode, moduleId: string = mode): CTAAction {
  return {
    id,
    label,
    type: "navigate",
    target: moduleId,
    payload: { mode, moduleId },
  };
}

function createReplyAction(id: string, label: string, query = label): CTAAction {
  return {
    id,
    label,
    type: "reply",
    payload: { query },
  };
}

function createPhonebookAction(id: string, label: string): CTAAction {
  return {
    id,
    label,
    type: "navigate",
    target: "phonebook",
    payload: { moduleId: "phonebook" },
  };
}

export function getDecisionActions(target: WatanyRouteTarget): CTAAction[] {
  switch (target) {
    case "forms":
      return [
        {
          id: "forms-open",
          label: "فتح النماذج",
          type: "navigate",
          target: "forms",
          payload: { moduleId: "forms" },
        },
        {
          id: "forms-search",
          label: "بحث عن نموذج",
          type: "navigate",
          target: "forms",
          payload: { moduleId: "forms", query: "نموذج" },
        },
      ];
    case "community":
      return [
        createNavigateAction("community-open", "ادخل المجتمع", "community", "community"),
        createNavigateAction("community-assistant", "", "chat", "assistant"),
        createNavigateAction("community-groups", "المجموعات", "community", "groups"),
      ];
    case "salary":
      return [
        createNavigateAction("salary-start", "ابدأ الحاسبة", "salary", "salary"),
        createReplyAction("salary-explain", "شرح قبل البدء"),
        createReplyAction("salary-compare", "مقارنة السيناريوهات"),
      ];
    case "procedure":
      return [
        createNavigateAction("procedure-open", "ابدأ المعاملة", "procedures", "procedures"),
        createReplyAction("procedure-docs", "المستندات المطلوبة"),
        createReplyAction("procedure-form", "تحميل النموذج"),
      ];
    case "payment":
      return [
        createNavigateAction("payment-open", "الدفعات والمستحقات", "services", "payment"),
        createNavigateAction("payment-docs", "المستندات المرتبطة", "documents", "documents"),
        createReplyAction("payment-status", "آخر مستحقاتي"),
      ];
    case "recruitment":
      return [
        createNavigateAction("recruitment-open", "إعلانات التطويع", "services", "recruitment"),
        createReplyAction("recruitment-terms", ""),
        createReplyAction("recruitment-docs", "المستندات"),
      ];
    case "phonebook":
      return [
        createPhonebookAction("phonebook-open", "افتح دليل الأرقام"),
        createReplyAction("phonebook-share", "مشاركة الرقم"),
        createReplyAction("phonebook-other", "جهة أخرى"),
      ];
    case "documents":
      return [
        createNavigateAction("documents-open", "افتح المستندات", "documents", "documents"),
        createReplyAction("documents-preview", "معاينة الملف"),
        createReplyAction("documents-download", "تحميل المستند"),
      ];
    case "laws":
      return [
        createNavigateAction("laws-open", "القوانين والحقوق", "search", "laws"),
        createReplyAction("laws-summary", "شرح الحق القانوني"),
        createReplyAction("laws-related", "المواد ذات الصلة"),
      ];
    case "assistant":
    default:
      return [
        createNavigateAction("assistant-open", "", "chat", "assistant"),
        createNavigateAction("assistant-services", "الخدمات", "services", "services"),
        createNavigateAction("assistant-community", "المجتمع", "community", "community"),
      ];
  }
}

export function decideWatanyRoute(query: string): WatanyRouteDecision {
  const text = normalizeWatanyText(query);

  if (/(نموذج|نماذج|استماره|استمارة|تحميل نموذج|وين النماذج|ta3wid|ta2aod|namouzaj|namothaj|namozaj|badde namouzaj|badi namouzaj)/.test(text)) {
    const actions = getDecisionActions("forms");
    return { mode: "service", target: "forms", confidence: 0.95, suggestedActions: actions.map((action) => action.label) };
  }

  if (/(شو رايكن|شو رايكم|مجتمع|مجموعه|نقاش|دردشه|جروب|جماعه)/.test(text)) {
    const actions = getDecisionActions("community");
    return { mode: "conversation", target: "community", confidence: 0.94, suggestedActions: actions.map((action) => action.label) };
  }

  if (/(راتب|راتبي|معاش|تعويض|رواتب|منحه مدرس)/.test(text)) {
    const actions = getDecisionActions("salary");
    return { mode: "service", target: "salary", confidence: 0.96, suggestedActions: actions.map((action) => action.label) };
  }

  if (/(معامله|اجراء|نموذج|اخراج قيد|افاده|طلب)/.test(text)) {
    const actions = getDecisionActions("procedure");
    return { mode: "service", target: "procedure", confidence: 0.91, suggestedActions: actions.map((action) => action.label) };
  }

  if (/(دفعه|دفعات|مستحق|مستحقات|قبض|صرف)/.test(text)) {
    const actions = getDecisionActions("payment");
    return { mode: "service", target: "payment", confidence: 0.84, suggestedActions: actions.map((action) => action.label) };
  }

  if (/(تطويع|تجنيد|جيش|عسكري|مباراة|دورة)/.test(text)) {
    const actions = getDecisionActions("recruitment");
    return { mode: "service", target: "recruitment", confidence: 0.9, suggestedActions: actions.map((action) => action.label) };
  }

  if (/(رقم|هاتف|اتصال|مستشفي|جهه|دليل)/.test(text)) {
    const actions = getDecisionActions("phonebook");
    return { mode: "lookup", target: "phonebook", confidence: 0.88, suggestedActions: actions.map((action) => action.label) };
  }

  if (/(مستند|وثيقه|ملف|تحميل|pdf|صوره رسميه)/.test(text)) {
    const actions = getDecisionActions("documents");
    return { mode: "service", target: "documents", confidence: 0.86, suggestedActions: actions.map((action) => action.label) };
  }

  if (/(قانون|حقوق|ماده|مرسوم|تعليمات)/.test(text)) {
    const actions = getDecisionActions("laws");
    return { mode: "lookup", target: "laws", confidence: 0.82, suggestedActions: actions.map((action) => action.label) };
  }

  const actions = getDecisionActions("assistant");
  return { mode: "conversation", target: "assistant", confidence: 0.62, suggestedActions: actions.map((action) => action.label) };
}

export function ctaActionsToIntents(actions: CTAAction[]): ActionIntent[] {
  return actions.map((action): ActionIntent => {
    if (action.type === "reply") {
      return {
        type: "suggest_query",
        label: action.label,
        query: firstString(action.payload?.query, action.label) ?? "",
      };
    }

    if (action.type === "call") {
      return {
        type: "call_phone",
        label: action.label,
        phone: typeof action.payload?.phone === "string" ? action.payload.phone : "",
      };
    }

    if (action.type === "download" || action.type === "share") {
      return {
        type: "open_url",
        label: action.label,
        url: typeof action.payload?.url === "string" ? action.payload.url : "",
      };
    }

    return {
      type: "open_module",
      label: action.label,
      moduleId: firstString(action.target, action.payload?.moduleId, action.payload?.mode) ?? "services",
    };
  });
}

function isOtherIntent(intent: ActionIntent): boolean {
  return intent.moduleId === "home";
}

function intentKey(intent: ActionIntent): string {
  return [intent.type, intent.label, intent.moduleId, intent.query, intent.url, intent.phone].filter(Boolean).join("::");
}

export function mergeHybridActionIntents(existing: ActionIntent[] | undefined, query: string): ActionIntent[] | undefined {
  const existingIntents = existing ?? [];
  const fallback = ctaActionsToIntents(getDecisionActions(decideWatanyRoute(query).target));
  const primaryPool = [...existingIntents.filter((intent) => !isOtherIntent(intent)), ...fallback.filter((intent) => !isOtherIntent(intent))];
  const seen = new Set<string>();
  const primary: ActionIntent[] = [];

  for (const intent of primaryPool) {
    const key = intentKey(intent);
    if (seen.has(key)) continue;
    seen.add(key);
    primary.push(intent);
    if (primary.length === 3) break;
  }

  const otherIntent = [...existingIntents, ...fallback].find(isOtherIntent);
  const merged = otherIntent ? [...primary, otherIntent] : primary;

  return merged.length > 0 ? merged : undefined;
}