/**
 * Small-talk intent classifier — gateway fast-path for common greetings/chitchat.
 * Extracted from server.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeArabic } from "@watany/shared/arabic";

export type SmallTalkIntent = { name: string; patterns: string[]; responses: string[] };

let _smallTalkIntents: SmallTalkIntent[] = [];

const DOMAIN_KEYWORDS = new Set([
  "معاش", "راتب", "تقاعد", "متقاعد", "تقاعدي", "حقوق", "حق", "طبابه", "استشفاء",
  "معامله", "معاملات", "مستند", "مستندات", "وفاه", "ورثه", "ارث", "ارمله", "زوج", "زوجه",
  "ابن", "ابنه", "بنت", "اولاد", "خدمه", "رتبه", "درجه", "تعويض", "منحه", "منح",
  "مدرسيه", "مساعده", "قانون", "قضيه", "قضايا", "طلب", "طلبات", "نموذج", "نماذج",
]);

function tokenizeNormalized(text: string): string[] {
  return normalizeArabic(text).split(/\s+/).filter(Boolean);
}

function containsTokenSequence(tokens: string[], sequence: string[]): boolean {
  if (sequence.length === 0 || sequence.length > tokens.length) return false;

  for (let start = 0; start <= tokens.length - sequence.length; start += 1) {
    let matched = true;
    for (let index = 0; index < sequence.length; index += 1) {
      if (tokens[start + index] !== sequence[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }

  return false;
}

function hasDomainSignal(tokens: string[]): boolean {
  return tokens.some((token) => {
    if (DOMAIN_KEYWORDS.has(token)) return true;
    return token.startsWith("معاش") || token.startsWith("راتب") || token.startsWith("تقاعد");
  });
}

function matchesSmallTalkPattern(queryTokens: string[], patternTokens: string[]): boolean {
  if (queryTokens.length > 6 || patternTokens.length === 0) return false;
  if (patternTokens.length === 1) return queryTokens.includes(patternTokens[0]);
  return containsTokenSequence(queryTokens, patternTokens);
}

export function resolveSmallTalkIntentsPath(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function getDefaultSmallTalkIntentsCandidates(versionRootPath: string): string[] {
  return [
    path.resolve(versionRootPath, "data/intents.json"),
    path.resolve(versionRootPath, "../data/intents.json"),
    path.resolve(versionRootPath, "../api-backend/data/intents.json"),
    path.resolve(versionRootPath, "../api-backend/data/small_talk_intents.json"),
    path.resolve(versionRootPath, "../api-backend/data/kb_v2/intents.json"),
  ];
}

export function loadSmallTalkIntents(intentsPath: string): void {
  try {
    const raw = fs.readFileSync(intentsPath, "utf-8").replace(/^\uFEFF/, "");
    const intentsData = JSON.parse(raw) as { intents: SmallTalkIntent[] };
    _smallTalkIntents = (intentsData.intents ?? []).filter((intent): intent is SmallTalkIntent => {
      return Boolean(
        intent
        && typeof intent.name === "string"
        && Array.isArray(intent.patterns)
        && Array.isArray(intent.responses),
      );
    });
    console.log(`[intent-classifier] Loaded ${_smallTalkIntents.length} small-talk intents from ${intentsPath}`);
  } catch (err) {
    console.warn(`[intent-classifier] Could not load small-talk intents from ${intentsPath}:`, err);
  }
}

export function getSmallTalkIntents(): SmallTalkIntent[] {
  return _smallTalkIntents;
}

export function setSmallTalkIntents(intents: SmallTalkIntent[]): void {
  _smallTalkIntents = intents;
}

export function classifySmallTalk(text: string): { name: string; response: string } | null {
  if (!_smallTalkIntents.length) return null;
  const normalized = normalizeArabic(text);
  const tokens = tokenizeNormalized(text);
  const wordCount = tokens.length;
  const domainSignal = hasDomainSignal(tokens);
  if (wordCount > 8) return null;

  for (const intent of _smallTalkIntents) {
    const patterns = Array.isArray(intent.patterns) ? intent.patterns : [];
    const responses = Array.isArray(intent.responses) ? intent.responses : [];
    if (patterns.length === 0 || responses.length === 0) continue;

    for (const pattern of patterns) {
      const normPat = normalizeArabic(pattern);
      if (normalized === normPat) {
        const response = responses[Math.floor(Math.random() * responses.length)] ?? "";
        return { name: intent.name, response };
      }

      if (domainSignal) continue;

      const patternTokens = tokenizeNormalized(pattern);
      if (matchesSmallTalkPattern(tokens, patternTokens)) {
        const response = responses[Math.floor(Math.random() * responses.length)] ?? "";
        return { name: intent.name, response };
      }
    }
  }
  return null;
}
