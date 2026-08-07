/**
 * Watany Intent Extractor
 *
 * Post-processes AI-generated replies to extract ActionIntents
 * that the Watany UI can act upon (phone calls, URLs, tickets, forms, etc.).
 *
 * This preserves the existing intent system used by the legacy
 * Python API and Watany frontend.
 */
import type { ActionIntent } from "@watany/types";
import type { ExtractedIntents } from "./types";

/**
 * Lebanese phone pattern (landline + mobile).
 * Matches: 01XXXXXX, 03XXXXXX, +961XXXXXXXX, etc.
 */
const PHONE_RE = /(?:\+961[\s-]?|0)([1-9]\d{6,7})/g;

/**
 * URL pattern — matches http(s) links.
 */
const URL_RE = /https?:\/\/[^\s<>"'،\u060C\u061B]+/gi;

/**
 * Form code references in reply text (ت2, ت11, ت12, ت22, etc.)
 */
const FORM_CODE_RE = /(?:نموذج|طلب|تعبئة|استمارة)\s*(?:[""])?(?:ت\d+|بطاقة[\s-]خ|رخصة[\s-]س)(?:[""])?/gi;
const FORM_CODE_EXTRACT_RE = /ت(\d+)/g;

const FORM_CODE_TO_ID: Record<string, string> = {
  "ت2": "form_t2",
  "ت11": "form_t11",
  "ت12": "form_t12",
  "ت22": "form_t22",
};

/**
 * Arabic clarifying question patterns.
 */
const CLARIFY_PATTERNS = [
  /هل تقصد\b/,
  /أي من التالي/,
  /يرجى التوضيح/,
  /هل تريد/,
  /ما المقصود/,
  /أيّ نوع/,
  /حدد\s+.*\s+التالي/,
];

/**
 * Extract Watany-compatible ActionIntents from an AI reply text.
 */
export function extractIntents(replyText: string): ExtractedIntents {
  const intents: ActionIntent[] = [];

  // Extract phone numbers
  const phones = [...replyText.matchAll(PHONE_RE)];
  const seenPhones = new Set<string>();
  for (const m of phones) {
    const phone = m[0].replace(/[\s-]/g, "");
    if (!seenPhones.has(phone)) {
      seenPhones.add(phone);
      intents.push({ type: "call_phone", phone });
    }
  }

  // Extract URLs
  const urls = [...replyText.matchAll(URL_RE)];
  const seenUrls = new Set<string>();
  for (const m of urls) {
    const url = m[0];
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      intents.push({ type: "open_url", url });
    }
  }

  // Detect clarifying question
  let clarifyingQuestion: string | undefined;
  for (const pattern of CLARIFY_PATTERNS) {
    if (pattern.test(replyText)) {
      // Extract the sentence containing the clarifying question
      const sentences = replyText.split(/[.؟?\n]/).filter(Boolean);
      const match = sentences.find((s) => pattern.test(s));
      if (match) {
        clarifyingQuestion = match.trim();
      }
      break;
    }
  }

  // Detect form code references in AI reply (e.g. "تعبئة نموذج ت2")
  const seenFormIds = new Set<string>();
  if (FORM_CODE_RE.test(replyText)) {
    // Reset lastIndex after test
    const codeMatches = [...replyText.matchAll(FORM_CODE_EXTRACT_RE)];
    for (const m of codeMatches) {
      const code = `ت${m[1]}`;
      const formId = FORM_CODE_TO_ID[code];
      if (formId && !seenFormIds.has(formId)) {
        seenFormIds.add(formId);
        intents.push({ type: "open_form", label: `📋 فتح نموذج ${code}`, formId });
      }
    }
  }

  // Also check for specific form keywords even without "نموذج" prefix
  if (seenFormIds.size === 0) {
    if (/بطاقة\s*(الخدمات\s*)?(الاجتماعية)?/.test(replyText) && /تجديد|تنظيم|بدل/.test(replyText)) {
      intents.push({ type: "open_form", label: "📋 فتح طلب تجديد بطاقة الخدمات", formId: "form_service_card" });
    }
  }

  return { intents, clarifyingQuestion };
}
