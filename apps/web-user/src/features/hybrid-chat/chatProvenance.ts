/** User-facing provenance from a chat API response. Presence is NOT proof a claim is true. */
export type ChatReference = {
  id: string;
  title: string;
  excerpt?: string;
  href?: string;
};

export type ChatProvenance = {
  references: ChatReference[];
  status: "attached" | "unavailable";
  reviewWarnings?: string[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function plainText(value: unknown, max = 160): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeLink(value: unknown): string | undefined {
  const link = plainText(value, 1000);
  if (!link || /[\\\x00-\x1f]/.test(link)) return undefined;
  // Allow only an on-site root-relative path or an HTTPS origin, never script/data links.
  if (link.startsWith("/") && !link.startsWith("//")) return link;
  try {
    const url = new URL(link);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    return undefined;
  }
  return undefined;
}

function sourceArray(value: Record<string, unknown>): unknown[] {
  if (Array.isArray(value.sources) && value.sources.length > 0) return value.sources;
  if (Array.isArray(value.kb_hits) && value.kb_hits.length > 0) return value.kb_hits;
  const listing = record(value.listing);
  if (Array.isArray(listing?.sources)) return listing.sources;
  return [];
}

export function getChatProvenance(payload: unknown): ChatProvenance {
  const data = record(payload);
  if (!data) return { references: [], status: "unavailable" };
  const references: ChatReference[] = [];
  const seen = new Set<string>();
  for (const item of sourceArray(data)) {
    const hit = record(item);
    if (!hit) continue;
    const title = plainText(hit.title || hit.label);
    if (!title || title === "مرجع من قاعدة المعرفة" || /^(?:rag|law|doc|kb)_[a-z0-9]+$/i.test(title)) continue;
    const href = safeLink(hit.sourceUrl || hit.url);
    const id = plainText(hit.id || hit.kbId, 120) || title;
    const uniqueKey = href || id + ":" + title;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);
    const excerpt = plainText(hit.excerpt || hit.body, 240);
    references.push({ id, title, ...(excerpt ? { excerpt } : {}), ...(href ? { href } : {}) });
    if (references.length >= 3) break;
  }
  const rawReviews = Array.isArray(data.sourceReviews) ? data.sourceReviews : [];
  const knownSources = sourceArray(data).map(record).filter((item): item is Record<string, unknown> => item !== null);
  const reviewWarnings: string[] = [];
  for (const entry of rawReviews) {
    const review = record(entry);
    if (!review) continue;
    const id = plainText(review.sourceId, 120);
    const sourceUrl = plainText(review.sourceUrl, 1000);
    if (!id || !sourceUrl || !knownSources.some((item) =>
      plainText(item.id, 120) === id && plainText(item.sourceUrl || item.url, 1000) === sourceUrl
    )) continue;
    const state = review.reviewState;
    const snapshot = review.snapshotState;
    if (state === "expired" || state === "due_soon" || state === "invalid") {
      const label = state === "expired" ? "انتهت مراجعة المصدر" : state === "invalid" ? "تاريخ مراجعة المصدر غير صالح" : "اقترب موعد إعادة مراجعة المصدر";
      reviewWarnings.push(`${label}: ${id}. تحقق من الجهة المختصة.`);
    } else if (snapshot === "excerpt_missing" || snapshot === "fetch_failed" || snapshot === "source_mismatch") {
      reviewWarnings.push(`تعذّر إعادة التحقق من المرجع ${id}؛ لا تعتمد عليه دون مراجعة.`);
    }
    if (reviewWarnings.length === 3) break;
  }
  return {
    references,
    status: references.length ? "attached" : "unavailable",
    ...(reviewWarnings.length ? { reviewWarnings } : {}),
  };
}
