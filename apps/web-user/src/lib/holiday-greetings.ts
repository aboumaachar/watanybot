export type HolidayGreetingOptions = {
  audience?: string;
};

const SECURITY_AUDIENCE_RE = /(جيش|الجيش|قوى\s*الأمن|الامن|الأمن|امن\s*الدولة|الأمن\s*العام|الدفاع\s*المدني|laf|isf|gsf)/i;
const HOLIDAY_PREFIX = "كل عام وأنتم بخير يا حماة الوطن.";

export function prependHolidayGreeting(answer: string, options: HolidayGreetingOptions): string {
  const base = (answer || "").trim();
  if (!base) return base;

  const audience = (options.audience || "").trim();
  if (!SECURITY_AUDIENCE_RE.test(audience)) return base;

  if (base.startsWith(HOLIDAY_PREFIX)) return base;
  return `${HOLIDAY_PREFIX}\n\n${base}`;
}
