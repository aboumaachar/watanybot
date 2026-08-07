export type TickerLinkableItem = {
  kind?: string;
  title: string;
  url?: string;
  linkType?: string;
  linkId?: string;
};

export type TickerTarget =
  | { type: "external"; href: string; actionLabel: string }
  | { type: "internal"; href: string; actionLabel: string }
  | { type: "draft"; draft: string; actionLabel: string };

export function extractTickerQuestion(text: string): string {
  return text.replace(/^[^\s]+\s*(سؤال (متكرر|شائع)|نصيحة اليوم)?:?\s*/i, "").trim();
}

function internalTarget(href: string, actionLabel: string): TickerTarget {
  return { type: "internal", href, actionLabel };
}

export function resolveTickerTarget(item: TickerLinkableItem): TickerTarget | null {
  const nextUrl = item.url?.trim();
  if (nextUrl) {
    if (/^https?:\/\//i.test(nextUrl)) {
      return { type: "external", href: nextUrl, actionLabel: "افتح المصدر" };
    }
    if (nextUrl.startsWith("/")) {
      return internalTarget(nextUrl, "افتح الوجهة");
    }
  }

  const linkType = item.linkType?.trim().toLowerCase();
  const linkId = item.linkId?.trim();

  if (linkType === "route" && linkId) {
    if (/^https?:\/\//i.test(linkId)) {
      return { type: "external", href: linkId, actionLabel: "افتح المصدر" };
    }
    if (linkId.startsWith("/")) {
      return internalTarget(linkId, "افتح الوجهة");
    }
  }

  switch (linkType) {
    case "faq":
    case "hash":
      return internalTarget("/faq", "افتح الأسئلة الشائعة");
    case "case":
    case "cases":
    case "case_update":
    case "ticket":
    case "ticket_reply":
    case "transaction":
      return internalTarget("/cases", "افتح المعاملات");
    case "document":
    case "documents":
    case "doc":
    case "file":
      return internalTarget("/documents", "افتح المستندات");
    case "form":
    case "forms":
      return internalTarget("/forms", "افتح النماذج");
    case "procedure":
    case "procedures":
      return internalTarget("/procedures", "افتح المعاملات");
    case "job":
    case "jobs":
      return internalTarget("/jobs", "افتح الوظائف");
    case "circular":
    case "circulars":
      return internalTarget("/services/recruitment", "افتح التطويع");
    case "notification":
    case "notifications":
    case "alert":
      return internalTarget("/updates", "افتح التحديثات");
    case "official_service":
    case "official_service_detail":
    case "official-services":
      return internalTarget(linkId ? `/services/official/${encodeURIComponent(linkId)}` : "/services/official", "افتح الخدمة");
    case "community":
    case "group":
    case "groups":
      return internalTarget("/groups", "افتح المجتمع");
    default:
      break;
  }

  if (item.kind === "suggest" || item.kind === "popular" || item.kind === "qotd") {
    const draft = extractTickerQuestion(item.title);
    if (draft) {
      return { type: "draft", draft, actionLabel: "اسأل عن هذا" };
    }
  }

  return null;
}