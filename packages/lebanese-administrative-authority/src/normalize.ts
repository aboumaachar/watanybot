import type { Language } from './types';

const arabicDiacritics = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const punctuation = /[\u0021-\u0040\u005B-\u0060\u007B-\u007E،؛؟«»]+/g;

export function normalizeAdministrativeText(value: string, language?: Language): string {
  let normalized = value.normalize('NFKC').trim().toLocaleLowerCase(language === 'ar' ? 'ar' : 'en');
  normalized = normalized.replace(arabicDiacritics, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  if (language === 'fr' || language === 'en' || language === 'arabizi') normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(punctuation, ' ').replace(/[\s_\-]+/g, '');
}
