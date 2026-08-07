/**
 * watany-holiday-greetings.ts
 * Holiday greeting layer for the WatanyBot live chatbot pipeline.
 */

export type HolidayAudience = "ARMY" | "ISF" | "ALL";

export interface HolidayGreetingOptions {
  audience?: HolidayAudience;
  nowOverride?: Date;
}

interface HolidayDefinition {
  month: number;
  day: number;
  nameAr: string;
  audiences: HolidayAudience[];
  greetingAr: string;
}

const HOLIDAYS: HolidayDefinition[] = [
  { month: 1,  day: 1,  nameAr: "ras el sane",       audiences: ["ALL"],   greetingAr: "كل عام وأنتم بخير بمناسبة رأس السنة الميلادية." },
  { month: 5,  day: 6,  nameAr: "eid el shohada",     audiences: ["ALL"],   greetingAr: "في ذكرى عيد الشهداء، نحني رؤوسنا إجلالاً لأرواح من ضحّوا من أجل الوطن. وطنك معك." },
  { month: 5,  day: 25, nameAr: "eid el tahrir",      audiences: ["ALL"],   greetingAr: "بمناسبة عيد التحرير والمقاومة، نُحيّي كل من حمل راية الوطن. تحية إجلال لكل عسكري موطني." },
  { month: 8,  day: 1,  nameAr: "eid el jaish",       audiences: ["ARMY"],  greetingAr: "بمناسبة عيد الجيش اللبناني، كل عيد وأنتم سند الوطن وحماته. عيد الجيش مبارك!" },
  { month: 11, day: 22, nameAr: "eid el istiqlal",    audiences: ["ALL"],   greetingAr: "بمناسبة عيد الاستقلال اللبناني، كل عام ولبنان بألف خير. تحيا لبنان!" },
  { month: 12, day: 25, nameAr: "eid el milad",       audiences: ["ALL"],   greetingAr: "كل عام وأنتم بخير بمناسبة عيد الميلاد المجيد." },
];

export function getTodayHoliday(opts: HolidayGreetingOptions = {}): HolidayDefinition | null {
  const now = opts.nowOverride ?? new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const audience = opts.audience ?? "ALL";
  return (
    HOLIDAYS.find(
      (h) =>
        h.month === month &&
        h.day === day &&
        (h.audiences.includes("ALL") || h.audiences.includes(audience))
    ) ?? null
  );
}

export function prependHolidayGreeting(answer: string, opts: HolidayGreetingOptions = {}): string {
  const holiday = getTodayHoliday(opts);
  if (!holiday) return answer;
  const trimmed = answer.trim();
  if (trimmed.startsWith(holiday.greetingAr)) return trimmed;
  return holiday.greetingAr + "\n\n" + trimmed;
}