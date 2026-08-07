import { teamArabicNameByCode, worldCupOfficialTeamSeeds } from "@watany/shared/worldcup-official-data";

export type ResolvedPlayerImage = {
  imageUrl: string;
  imageSource: "wikimedia" | "fallback";
};

const fallbackAvatarDataUri =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="24" fill="#E2E8F0"/><circle cx="120" cy="92" r="42" fill="#94A3B8"/><path d="M48 206c7-37 35-62 72-62s65 25 72 62" stroke="#64748B" stroke-width="18" stroke-linecap="round"/></svg>`);

const imageCache = new Map<string, ResolvedPlayerImage>();

function normalizeSearchTerm(playerName: string, teamNameAr?: string): string {
  return `${playerName}${teamNameAr ? ` ${teamNameAr}` : ""}`.trim();
}

async function resolveWikipediaThumbnail(searchTerm: string): Promise<string | null> {
  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("srlimit", "1");
  searchUrl.searchParams.set("srsearch", searchTerm);

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    return null;
  }

  const searchPayload = (await searchResponse.json()) as { query?: { search?: Array<{ title?: string }> } };
  const title = searchPayload.query?.search?.[0]?.title;
  if (!title) {
    return null;
  }

  const thumbUrl = new URL("https://en.wikipedia.org/w/api.php");
  thumbUrl.searchParams.set("action", "query");
  thumbUrl.searchParams.set("format", "json");
  thumbUrl.searchParams.set("origin", "*");
  thumbUrl.searchParams.set("prop", "pageimages");
  thumbUrl.searchParams.set("piprop", "thumbnail");
  thumbUrl.searchParams.set("pithumbsize", "360");
  thumbUrl.searchParams.set("titles", title);

  const thumbResponse = await fetch(thumbUrl);
  if (!thumbResponse.ok) {
    return null;
  }

  const thumbPayload = (await thumbResponse.json()) as {
    query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
  };
  const page = Object.values(thumbPayload.query?.pages ?? {})[0];
  return page?.thumbnail?.source ?? null;
}

export async function resolveWorldCupPlayerImage(playerName: string, teamCode: string): Promise<ResolvedPlayerImage> {
  const cacheKey = `${teamCode}:${playerName}`;
  const cached = imageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const team = worldCupOfficialTeamSeeds.find((item) => item.code === teamCode);
  const searchTerm = normalizeSearchTerm(playerName, team ? teamArabicNameByCode(team.code) : undefined);

  try {
    const thumbnail = await resolveWikipediaThumbnail(searchTerm);
    if (thumbnail) {
      const result = { imageUrl: thumbnail, imageSource: "wikimedia" as const };
      imageCache.set(cacheKey, result);
      return result;
    }
  } catch {
    // fall through to fallback avatar
  }

  const fallback = { imageUrl: fallbackAvatarDataUri, imageSource: "fallback" as const };
  imageCache.set(cacheKey, fallback);
  return fallback;
}

export function getCachedWorldCupPlayerImage(playerName: string, teamCode: string): ResolvedPlayerImage | null {
  return imageCache.get(`${teamCode}:${playerName}`) ?? null;
}

export function primeWorldCupPlayerImageCache(playerName: string, teamCode: string): void {
  const cacheKey = `${teamCode}:${playerName}`;
  if (imageCache.has(cacheKey)) {
    return;
  }

  // In test environments, avoid performing external network requests
  // (Wikipedia) — populate cache with fallback avatar to keep tests fast
  // and deterministic.
  if (process.env.NODE_ENV === "test") {
    const fallback = { imageUrl: fallbackAvatarDataUri, imageSource: "fallback" as const };
    imageCache.set(cacheKey, fallback);
    return;
  }

  void resolveWorldCupPlayerImage(playerName, teamCode).catch(() => undefined);
}
