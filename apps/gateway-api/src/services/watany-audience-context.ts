import type { HolidayAudience, HolidayGreetingOptions } from "./watany-holiday-greetings";

export type WatanyAudienceContext = {
  audience?: HolidayAudience;
  apparatus?: unknown;
  userProfile?: Record<string, unknown> | null;
  requestLike?: {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };
  nowOverride?: Date;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeHolidayAudience(value: unknown): HolidayAudience | undefined {
  const text = normalizeText(value);

  if (!text) return undefined;

  if (["all", "عام", "الجميع", "كل", "كلن"].includes(text)) return "ALL";
  if (["army", "laf", "جيش", "الجيش", "الجيش اللبناني", "عسكري جيش", "متقاعد جيش"].some((x) => text.includes(normalizeText(x)))) return "ARMY";
  if (["isf", "قوى الامن", "قوى الأمن", "امن داخلي", "أمن داخلي", "الدرك", "شرطة"].some((x) => text.includes(normalizeText(x)))) return "ISF";

  return undefined;
}

export function extractHolidayAudienceFromUserProfile(profile?: Record<string, unknown> | null): HolidayAudience | undefined {
  if (!profile || typeof profile !== "object") return undefined;

  const candidateKeys = [
    "holidayAudience",
    "audience",
    "apparatus",
    "securityApparatus",
    "service",
    "force",
    "branch",
    "sector",
    "militaryBranch",
    "retirementSource",
    "employer",
    "role"
  ];

  for (const key of candidateKeys) {
    const audience = normalizeHolidayAudience(profile[key]);
    if (audience) return audience;
  }

  return undefined;
}

export function extractHolidayAudienceFromRequestLike(requestLike?: WatanyAudienceContext["requestLike"]): HolidayAudience | undefined {
  if (!requestLike) return undefined;

  const body = requestLike.body || {};
  const query = requestLike.query || {};
  const headers = requestLike.headers || {};
  const user = requestLike.user || {};

  const directCandidates = [
    body["holidayAudience"],
    body["audience"],
    body["apparatus"],
    body["securityApparatus"],
    query["holidayAudience"],
    query["audience"],
    query["apparatus"],
    headers["x-watany-holiday-audience"],
    headers["x-watany-audience"],
    headers["x-watany-apparatus"],
    headers["x-watany-security-apparatus"]
  ];

  for (const value of directCandidates) {
    const audience = normalizeHolidayAudience(value);
    if (audience) return audience;
  }

  const bodyProfile =
    body["userProfile"] && typeof body["userProfile"] === "object"
      ? (body["userProfile"] as Record<string, unknown>)
      : undefined;

  return extractHolidayAudienceFromUserProfile(bodyProfile) || extractHolidayAudienceFromUserProfile(user);
}

export function extractHolidayNowOverrideFromRequestLike(requestLike?: WatanyAudienceContext["requestLike"]): Date | undefined {
  if (!requestLike) return undefined;

  const body = requestLike.body || {};
  const query = requestLike.query || {};
  const headers = requestLike.headers || {};

  const raw =
    readString(body["holidayDate"]) ||
    readString(query["holidayDate"]) ||
    readString(headers["x-watany-holiday-date"]);

  if (!raw) return undefined;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function resolveHolidayGreetingOptions(input?: HolidayAudience | WatanyAudienceContext): HolidayGreetingOptions {
  if (!input) return { audience: "ALL" };

  if (typeof input === "string") {
    return { audience: normalizeHolidayAudience(input) || "ALL" };
  }

  const fromRequest = extractHolidayAudienceFromRequestLike(input.requestLike);
  const fromProfile = extractHolidayAudienceFromUserProfile(input.userProfile);
  const fromApparatus = normalizeHolidayAudience(input.apparatus);
  const direct = normalizeHolidayAudience(input.audience);

  const nowOverride =
    input.nowOverride ||
    extractHolidayNowOverrideFromRequestLike(input.requestLike);

  return {
    audience: direct || fromRequest || fromProfile || fromApparatus || "ALL",
    nowOverride
  };
}

export function extractHolidayAudienceContextFromFastifyRequest(req: unknown): WatanyAudienceContext {
  const request = (req || {}) as {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };

  return {
    requestLike: {
      body: request.body,
      query: request.query,
      headers: request.headers,
      user: request.user
    },
    userProfile:
      request.body?.["userProfile"] && typeof request.body["userProfile"] === "object"
        ? (request.body["userProfile"] as Record<string, unknown>)
        : request.user,
    nowOverride: extractHolidayNowOverrideFromRequestLike({
      body: request.body,
      query: request.query,
      headers: request.headers,
      user: request.user
    })
  };
}