import type { ActionIntent, CTAAction, ConversationContext, HybridRouteDecision, WatanyModule } from "@watany/types";

function action(id: string, label: string, type: CTAAction["type"], target?: string, payload?: Record<string, unknown>): CTAAction {
  return { id, label, type, ...(target ? { target } : {}), ...(payload ? { payload } : {}) };
}

export function otherAction(): CTAAction {
  return action("other", "أو شي تاني", "reply", undefined, { query: "أو شي تاني" });
}

export function ensureOtherOption(actions: CTAAction[]): CTAAction[] {
  const withoutOther = actions.filter((item) => item.label !== "أو شي تاني");
  return [...withoutOther.slice(0, 3), otherAction()];
}

export function generateDestinationCtas(
  destination: WatanyModule,
  context?: ConversationContext,
): CTAAction[] {
  switch (destination) {
    case "salary":
      return ensureOtherOption([
        action("start_salary", "ابدأ الحاسبة", "open_service_flow", "salary", { source: context?.source || "assistant" }),
        action("explain_salary", "شرح قبل البدء", "reply", undefined, { query: "شرح قبل البدء" }),
        action("salary_compare", "مقارنة السيناريوهات", "reply", undefined, { query: "مقارنة السيناريوهات" }),
      ]);
    case "procedure":
      return ensureOtherOption([
        action("procedure_docs", "المستندات المطلوبة", "reply", undefined, { query: "المستندات المطلوبة" }),
        action("procedure_form", "تحميل النموذج", "reply", undefined, { query: "تحميل النموذج" }),
        action("procedure_start", "ابدأ المعاملة", "open_service_flow", "procedure", { source: context?.source || "assistant" }),
      ]);
    case "payment":
      return ensureOtherOption([
        action("payment_explain", "شرح أكثر", "reply", undefined, { query: "شرح أكثر" }),
        action("payment_history", "الدفعات السابقة", "open_service_flow", "payment", { source: context?.source || "assistant" }),
        action("payment_banks", "المصارف", "reply", undefined, { query: "المصارف" }),
      ]);
    case "recruitment":
      return ensureOtherOption([
        action("recruitment_terms", "", "reply", undefined, { query: "" }),
        action("recruitment_docs", "المستندات", "reply", undefined, { query: "المستندات" }),
        action("recruitment_location", "مكان التقديم", "open_service_flow", "recruitment", { source: context?.source || "assistant" }),
      ]);
    case "phonebook":
      return ensureOtherOption([
        action("phone_call", "اتصال", "call"),
        action("phone_share", "مشاركة", "share"),
        action("phone_other", "جهة أخرى", "reply", undefined, { query: "جهة أخرى" }),
      ]);
    case "documents":
      return ensureOtherOption([
        action("documents_preview", "معاينة الملف", "open_service_flow", "documents", { source: context?.source || "assistant" }),
        action("documents_download", "تحميل المستند", "download"),
        action("documents_share", "مشاركة", "share"),
      ]);
    case "laws":
      return ensureOtherOption([
        action("laws_explain", "شرح مبسط", "reply", undefined, { query: "شرح مبسط" }),
        action("laws_related", "المواد ذات الصلة", "reply", undefined, { query: "المواد ذات الصلة" }),
        action("laws_download", "تحميل النص", "download"),
      ]);
    case "community_group":
      return ensureOtherOption([
        action("community_group_open", "افتح المجموعة", "navigate", "community_group"),
        action("community_live", "انضم للجلسة", "join_session", "community_group"),
        action("community_support", " الفني", "navigate", "support"),
      ]);
    case "community":
      return ensureOtherOption([
        action("community_open", "ادخل المجتمع", "navigate", "community"),
        action("community_groups", "المجموعات", "navigate", "community_group"),
        action("community_live", "مباشر الآن", "join_session", "community_group"),
      ]);
    case "support":
      return ensureOtherOption([
        action("support_open", "ابدأ ", "navigate", "support"),
        action("support_ticket", "طلب متابعة", "reply", undefined, { query: "أريد متابعة بشرية" }),
        action("support_context", "نفس الموضوع", "reply", undefined, { query: "نفس الموضوع" }),
      ]);
    case "assistant":
    default:
      return ensureOtherOption([
        action("assistant_open", "", "navigate", "assistant"),
        action("assistant_services", "الخدمات", "navigate", "services"),
        action("assistant_community", "المجتمع", "navigate", "community"),
      ]);
  }
}

export function hydrateCtasFromResponse(actions: CTAAction[], response: { intents?: ActionIntent[]; sources?: { id?: string; title?: string }[] }): CTAAction[] {
  const intents = Array.isArray(response.intents) ? response.intents : [];
  const firstPhone = intents.find((intent) => intent.type === "call_phone" && typeof intent.phone === "string" && intent.phone.trim())?.phone;
  const firstUrl = intents.find((intent) => intent.type === "open_url" && typeof intent.url === "string" && intent.url.trim())?.url;
  const sourceRef = response.sources?.[0]?.id;

  return actions.map((item) => {
    if (item.type === "call" && firstPhone) {
      return { ...item, payload: { ...(item.payload || {}), phone: firstPhone } };
    }

    if ((item.type === "share" || item.type === "download" || item.type === "join_session") && firstUrl) {
      return { ...item, payload: { ...(item.payload || {}), url: firstUrl } };
    }

    if (!item.payload && sourceRef && item.type === "open_service_flow") {
      return { ...item, payload: { sourceRef } };
    }

    return item;
  });
}

export function ctasToActionIntents(actions: CTAAction[]): ActionIntent[] {
  return actions.map((item) => {
    if (item.type === "reply") {
      return {
        type: "suggest_query",
        label: item.label,
        query: typeof item.payload?.query === "string" ? item.payload.query : item.label,
      };
    }

    if (item.type === "call") {
      return {
        type: "call_phone",
        label: item.label,
        phone: typeof item.payload?.phone === "string" ? item.payload.phone : undefined,
      };
    }

    if (item.type === "download" || item.type === "share" || item.type === "join_session") {
      return {
        type: "open_url",
        label: item.label,
        url: typeof item.payload?.url === "string" ? item.payload.url : undefined,
      };
    }

    return {
      type: "open_module",
      label: item.label,
      moduleId: item.target || "assistant",
    };
  });
}

export function rebuildDecisionSuggestions(
  decision: HybridRouteDecision,
  context?: ConversationContext,
): HybridRouteDecision {
  return {
    ...decision,
    suggestedActions: generateDestinationCtas(decision.destination, context),
  };
}