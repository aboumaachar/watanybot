export type SmartAttentionFeatureKey = "most-requested" | "latest" | "for-you";

export type SmartAttentionItem = {
  id: string;
  title: string;
  summary: string;
  kind: string;
  source: string;
  href: string;
  veteransFirst?: boolean;
  publishedAt?: number;
  demandCount?: number;
};

export type SmartAttentionFeature = {
  key: SmartAttentionFeatureKey;
  title: string;
  icon: string;
  href: string;
  items: SmartAttentionItem[];
};

type EngagementPayload = {
  ok?: boolean;
  latest?: SmartAttentionItem[];
  mostRequested?: SmartAttentionItem[];
  recommended?: SmartAttentionItem[];
};
const latestFallback: SmartAttentionItem[] = [];

const relevantFallback: SmartAttentionItem[] = [
  { id: "salary", title: "المعاش", summary: "حساب المعاش ومراجعة الراتب والبدلات والتعويضات.", kind: "حقوق", source: "حقوقي ومعاشي", href: "/salary", veteransFirst: true },
  { id: "jobs", title: "الوظائف", summary: "فرص عمل وخدمات مهنية يمكن أن تهم العسكريين المتقاعدين.", kind: "وظائف", source: "الخدمات والفرص", href: "/jobs", veteransFirst: true },
  { id: "procedures", title: "المعاملات", summary: "مسارات وإجراءات رسمية يحتاجها المستخدم بصورة متكررة.", kind: "معاملات", source: "معاملاتي", href: "/procedures", veteransFirst: true },
  { id: "marketplace", title: "السوق", summary: "إعلانات وخدمات ومنتجات منشورة في سوق موطني.", kind: "سوق", source: "السوق", href: "/marketplace" },
];

export const smartAttentionFeatures: SmartAttentionFeature[] = [
  { key: "most-requested", title: "الأكثر طلباً", icon: "★", href: "/most-requested", items: [] },
  { key: "latest", title: "جديد", icon: "", href: "/latest", items: latestFallback },
  { key: "for-you", title: "يهمك", icon: "✓", href: "/for-you", items: relevantFallback },
];

export function getSmartAttentionFeature(key: SmartAttentionFeatureKey): SmartAttentionFeature {
  return smartAttentionFeatures.find((feature) => feature.key === key) || smartAttentionFeatures[0];
}
const activityStorageKey = "watany-smart-attention-events-v1";

function localActivityCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  if (typeof window === "undefined") return counts;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(activityStorageKey) || "[]");
    const rows = Array.isArray(parsed) ? parsed : [];
    for (const row of rows.slice(-120)) {
      if (row?.type !== "open_item" || typeof row.id !== "string") continue;
      counts.set(row.id, (counts.get(row.id) || 0) + 1);
    }
  } catch { /* use empty history */ }
  return counts;
}

export function recordSmartAttentionEvent(type: string, id: string): void {
  if (typeof window === "undefined") return;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(activityStorageKey) || "[]");
    const rows = Array.isArray(parsed) ? parsed : [];
    rows.push({ type, id, at: Date.now(), path: window.location.pathname });
    window.localStorage.setItem(activityStorageKey, JSON.stringify(rows.slice(-120)));
  } catch { /* never block user flow */ }
}
function normalizeBase(apiBaseUrl: string): string {
  return String(apiBaseUrl || "").replace(/\/$/u, "");
}

export async function loadSmartAttentionItems(featureKey: SmartAttentionFeatureKey, apiBaseUrl = ""): Promise<SmartAttentionItem[]> {
  const fallback = getSmartAttentionFeature(featureKey).items;
  try {
    const response = await fetch(`${normalizeBase(apiBaseUrl)}/api/engagement/highlights`, { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) return fallback;
    const payload = await response.json() as EngagementPayload;
    if (featureKey === "latest") return Array.isArray(payload.latest) && payload.latest.length ? payload.latest : fallback;
    if (featureKey === "most-requested") return Array.isArray(payload.mostRequested) ? payload.mostRequested : [];
    const base = Array.isArray(payload.recommended) && payload.recommended.length ? payload.recommended : fallback;
    const counts = localActivityCounts();
    return [...base].sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
  } catch {
    return fallback;
  }
}

function engagementFeatureKey(item: SmartAttentionItem): string | null {
  const routeKey = item.href.replace(/^\//u, "").split("/")[0];
  return ["salary", "jobs", "marketplace", "forms", "procedures", "news", "community"].includes(routeKey) ? routeKey : null;
}

export function recordEngagementOpen(item: SmartAttentionItem, apiBaseUrl = ""): void {
  const featureKey = engagementFeatureKey(item);
  if (!featureKey) return;
  void fetch(`${normalizeBase(apiBaseUrl)}/api/engagement/event`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ featureKey }), credentials: "include" }).catch(() => undefined);
}
