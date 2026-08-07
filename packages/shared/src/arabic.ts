/**
 * Arabic text utilities — shared across gateway-api modules.
 * Normalizes Arabic text for matching: strips diacritics, unifies alef variants, etc.
 */

const _diacriticsRe = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;
const _alefVariantsRe = /[إأآٱ]/g;
const _punctSpaceRe = /[؟?!.,،؛\s]+/g;
const _hiddenCharsRe = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const _arabiziHintsRe = /[A-Za-z0-9]/;

const _arabiziAliases: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bbde\b/gi, "بدي"],
  [/\ba?7s[eu]b\b/gi, "احسب"],
  [/\bm(?:a)?3a?ash(?:e|eh|i|y)?\b/gi, "معاشي"],
  [/\brat(?:e|i)b(?:e|eh|i|y)?\b/gi, "راتب"],
  [/\b(?:ta2a?od|taqa?od|t2a?od)\b/gi, "تقاعد"],
  [/\b(?:wen|wein|wayn)\b/gi, "وين"],
  [/\b(?:shu|sho)\b/gi, "شو"],
  [/\b(?:shorou?t|shurut|shorot)\b/gi, "شروط"],
  [/\b(?:awra2|awraq|wra2)\b/gi, "اوراق"],
  [/\b(?:mostanadat|mustanadat)\b/gi, "مستندات"],
  [/\btaqdim\b/gi, "تقديم"],
  [/\btatw[iy]3\b/gi, "تطويع"],
  [/\b(?:bel|bil|bl)\b/gi, "بال"],
  [/\b(?:jesh|jeish|jaysh)\b/gi, "جيش"],
  [/\bmadaris\b/gi, "مدارس"],
  [/\b(?:man7a|min7a?h?)\b/gi, "منحه"],
  [/\b(?:madrasiyye|madrasiye|madrasiyeh|madrasiy)\b/gi, "مدرسيه"],
  [/\b(?:ra2em|ra2m|raqam)\b/gi, "رقم"],
  [/\b(?:mostashfa|moustashfa)\b/gi, "مستشفى"],
  [/\b(?:3askari|askari)\b/gi, "عسكري"],
  [/\b(?:dayeret|dayret|da2eret|da2ret)\b/gi, "دائره"],
  [/\bta3weed\b/gi, "تعويض"],
  [/\bzawj[eh]\b/gi, "زوجه"],
  [/\barmal[eh]\b/gi, "ارمله"],
  [/\bmotallaq[eh]\b/gi, "مطلقه"],
  [/\bbint\b/gi, "بنت"],
  [/\bbnt\b/gi, "بنت"],
  [/\bibn\b/gi, "ابن"],
  [/\b(?:3ndi|andi)\b/gi, "عندي"],
  [/\b(?:so2al|su2al|soal)\b/gi, "سؤال"],
  [/\b3an\b/gi, "عن"],
];

function applyArabiziAliases(text: string): string {
  if (!_arabiziHintsRe.test(text)) return text;

  return _arabiziAliases.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}

/** Strip diacritics, unify alef variants, normalize taa-marbuta, collapse whitespace. */
export function normalizeArabic(text: string): string {
  let t = applyArabiziAliases(text.trim());
  t = t.replace(_hiddenCharsRe, "");
  t = t.replace(_diacriticsRe, "");
  t = t.replace(/\u0640/g, "");
  t = t.replace(_alefVariantsRe, "ا");
  t = t.replace(/ة/g, "ه");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/ؤ/g, "و");
  t = t.replace(/ئ/g, "ي");
  t = t.replace(_punctSpaceRe, " ").trim();
  return t.toLowerCase();
}

/** Count Arabic-script characters in a string. */
export function countArabic(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 0x0600 && c <= 0x06ff) || (c >= 0xfb50 && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff)) n++;
  }
  return n;
}
