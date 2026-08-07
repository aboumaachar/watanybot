import contextualChatRules, { type ContextualChatRule, type WatanyChatMode } from "./contextualChatRules";

export type ResolvedContextualChat = {
  pageContext: string;
  chatMode: WatanyChatMode;
  useHybrid: boolean;
  searchScope: string[];
  pageKeywords: string[];
};

const WORLD_CUP_KEYWORDS = [
  "world cup",
  "world-cup",
  "fifa",
  "match",
  "matches",
  "team",
  "teams",
  "player",
  "players",
  "كاس العالم",
  "مباراة",
  "مباريات",
  "منتخب",
  "منتخبات",
  "لاعب",
  "لاعبين",
  "فيفا",
];

const SOCIAL_PREFIXES = ["/community", "/groups"] as const;
const WORK_PREFIXES = ["/jobs", "/market", "/marketplace", "/opportunities"] as const;
const WORLD_CUP_PREFIXES = ["/world-cup"] as const;
const PROCEDURE_PREFIXES = ["/procedures", "/search"] as const;
const FORMS_PREFIXES = ["/forms"] as const;
const DOCUMENTS_PREFIXES = ["/documents"] as const;
const USEFUL_LINKS_PREFIXES = ["/useful-links"] as const;
const OFFICIAL_SERVICES_PREFIXES = ["/services/official"] as const;
const ALERTS_PREFIXES = ["/alerts"] as const;
const NOTIFICATIONS_PREFIXES = ["/notifications"] as const;
const NETWORK_PREFIXES = ["/network"] as const;

function matchPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function resolvePageContext(pathname: string): string {
  if (matchPrefix(pathname, SOCIAL_PREFIXES)) {
    return "social";
  }

  if (matchPrefix(pathname, WORK_PREFIXES)) {
    return "work";
  }

  if (matchPrefix(pathname, WORLD_CUP_PREFIXES)) {
    return "world-cup";
  }

  if (matchPrefix(pathname, PROCEDURE_PREFIXES)) {
    return "procedures";
  }

  if (matchPrefix(pathname, ALERTS_PREFIXES) || matchPrefix(pathname, NOTIFICATIONS_PREFIXES)) {
    return "updates";
  }

  if (matchPrefix(pathname, NETWORK_PREFIXES)) {
    return "network";
  }

  return "default";
}

function findRule(pageContext: string): ContextualChatRule {
  return contextualChatRules.find((rule) => rule.pageContext === pageContext)
    || contextualChatRules.find((rule) => rule.pageContext === "default")
    || {
      id: "default-hybrid-contextual-chat-fallback",
      pageContext: "default",
      defaultMode: "hybrid",
      searchScope: ["current-page-items", "database-text", "kb-records"],
      promptBehavior: "hidden_until_focus",
    };
}

function buildPathKeywords(pathname: string): string[] {
  const segments = pathname
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
    .map((segment) => segment.replace(/[-_]+/g, " "));

  return Array.from(new Set(segments));
}

function buildPageKeywords(pathname: string, pageContext: string): string[] {
  if (pageContext === "world-cup") {
    return WORLD_CUP_KEYWORDS;
  }

  if (pageContext === "procedures") {
    return ["procedures", "procedure", "metadata", "tags", "forms", "اجراءات", "إجراءات", "معاملات", "نماذج", "وسوم"];
  }

  if (matchPrefix(pathname, FORMS_PREFIXES)) {
    return ["forms", "official forms", "documents", "نماذج", "استمارات", "تحميل", "طباعة"];
  }

  if (matchPrefix(pathname, DOCUMENTS_PREFIXES)) {
    return ["documents", "files", "attachments", "مستندات", "ملفات", "مرفقات"];
  }

  if (matchPrefix(pathname, USEFUL_LINKS_PREFIXES)) {
    return ["useful links", "official links", "external services", "روابط مفيدة", "روابط رسمية", "بوابات"];
  }

  if (matchPrefix(pathname, OFFICIAL_SERVICES_PREFIXES)) {
    return ["official services", "government services", "service lookup", "خدمات رسمية", "روابط مفيدة", "استعلام رسمي"];
  }

  if (matchPrefix(pathname, ALERTS_PREFIXES)) {
    return ["alerts", "emergency", "urgent updates", "تنبيهات", "إنذار", "عاجل"];
  }

  if (matchPrefix(pathname, NOTIFICATIONS_PREFIXES)) {
    return ["notifications", "inbox", "unread", "إشعارات", "غير مقروء", "متابعة"];
  }

  if (matchPrefix(pathname, NETWORK_PREFIXES)) {
    return ["network", "family network", "membership", "privacy", "الشبكة", "عضوية", "خصوصية", "خريطة"];
  }

  if (pageContext === "social") {
    return ["community", "groups", "live session", "مجتمع", "مجموعات", "جلسة مباشرة", "رسائل"];
  }

  if (pageContext === "work") {
    return ["jobs", "marketplace", "work", "وظائف", "سوق", "إعلانات", "مهن"];
  }

  if (pageContext === "updates") {
    return ["alerts", "notifications", "urgent updates", "تنبيهات", "إشعارات", "تحديثات"];
  }

  if (pageContext === "network") {
    return ["network", "family network", "membership", "community points", "الشبكة", "عضوية", "نقاط المجتمع"];
  }

  return buildPathKeywords(pathname);
}

export function resolveContextualChat(pathnameRaw: string): ResolvedContextualChat {
  const pathname = String(pathnameRaw || "").trim().toLowerCase() || "/";
  const pageContext = resolvePageContext(pathname);
  const rule = findRule(pageContext);

  // Force hybrid chat globally per user request.
  const chatMode: WatanyChatMode = "hybrid";
  const useHybrid = true;

  return {
    pageContext,
    chatMode,
    useHybrid,
    searchScope: rule.searchScope,
    pageKeywords: buildPageKeywords(pathname, pageContext),
  };
}

export default resolveContextualChat;
