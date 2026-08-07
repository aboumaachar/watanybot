/**
 * Emotional score computation — mirrors Python intent_classifier.emotional_score
 * Extracted from server.ts.
 */
import { normalizeArabic } from "@watany/shared/arabic";

const _emotionKeywords: [RegExp, number][] = [
  [/تعبت/, 0.45], [/مش قادر/, 0.50], [/مش عم اقدر/, 0.50],
  [/الوضع صعب/, 0.45], [/ما عم بكفي/, 0.45], [/ظلم/, 0.55],
  [/مش عارف شو اعمل/, 0.50], [/ضايع/, 0.45], [/قلقان/, 0.40],
  [/مقهور/, 0.55], [/مستحيل/, 0.40], [/يائس/, 0.55],
  [/خايف/, 0.40], [/محبط/, 0.50], [/زهقت/, 0.35],
  [/مش طايق/, 0.45], [/بدي حدا يساعدني/, 0.50],
  [/مش مبسوط/, 0.30], [/صعب/, 0.20], [/مشكلة/, 0.20],
  [/حزين/, 0.35], [/وجعني/, 0.30], [/كرمال الله/, 0.35],
  [/ما حدا بيسمعني/, 0.50], [/حرام/, 0.25],
];

export function computeEmotionalScore(text: string): number {
  const normalized = normalizeArabic(text);
  let score = 0;
  for (const [re, w] of _emotionKeywords) {
    if (re.test(normalized)) score += w;
  }
  const bangs = (text.match(/[!؟]/g) || []).length;
  score += Math.min(bangs * 0.05, 0.15);
  if (/(.)\1{2,}/.test(text)) score += 0.10;
  return Math.round(Math.min(score, 1.0) * 100) / 100;
}

export const EMPATHY_SYSTEM_INJECTION = `
[تنبيه عاطفي]: المستخدم يبدو محبط أو متعب. من فضلك:
- اختصر الجواب (جملتين أو ثلاثة بالكتير)
- ابدأ بعبارة تعاطف مثل "بفهم عليك" أو "حقك"
- قلل المصطلحات التقنية والأرقام الطويلة
- ركّز على الخطوة الأولى يلّي لازم يعملها
- خلي النبرة دافئة وداعمة
`;
