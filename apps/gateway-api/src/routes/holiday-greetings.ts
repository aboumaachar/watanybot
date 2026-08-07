import { getTodayHoliday, prependHolidayGreeting, type HolidayAudience } from "../services/watany-holiday-greetings";

type FastifyLike = {
  get: (route: string, handler: (req: any, reply: any) => Promise<any> | any) => void;
};

const SCENARIOS: Record<string, { nowOverride: Date; audience: HolidayAudience; label: string }> = {
  "army-day": {
    nowOverride: new Date(new Date().getFullYear(), 7, 1),
    audience: "ARMY",
    label: "عيد الجيش اللبناني (1 آب) - جمهور: الجيش",
  },
  "independence-day": {
    nowOverride: new Date(new Date().getFullYear(), 10, 22),
    audience: "ALL",
    label: "عيد الاستقلال (22 تشرين الثاني) - جمهور: الكل",
  },
  "liberation-day": {
    nowOverride: new Date(new Date().getFullYear(), 4, 25),
    audience: "ALL",
    label: "عيد التحرير (25 أيار) - جمهور: الكل",
  },
  "martyrs-day": {
    nowOverride: new Date(new Date().getFullYear(), 4, 6),
    audience: "ALL",
    label: "عيد الشهداء (6 أيار) - جمهور: الكل",
  },
  "normal-day": {
    nowOverride: new Date(new Date().getFullYear(), 5, 15),
    audience: "ALL",
    label: "يوم عادي (15 حزيران) - لا عطلة",
  },
};

const SAMPLE_ANSWER = "المعاش العسكري يُصرف في بداية كل شهر ميلادي. يمكنك مراجعة مديرية الشؤون للتحقق من التفاصيل.";

export function registerHolidayGreetingsRoutes(app: FastifyLike) {
  app.get("/api/holiday-greetings/chatbot-preview/:scenario", (req: any, reply: any) => {
    const { scenario } = req.params as { scenario: string };
    const config = SCENARIOS[scenario];
    if (!config) {
      return reply.status(404).send({
        error: "UNKNOWN_SCENARIO",
        availableScenarios: Object.keys(SCENARIOS),
      });
    }
    const holiday = getTodayHoliday({ audience: config.audience, nowOverride: config.nowOverride });
    const finalAnswer = prependHolidayGreeting(SAMPLE_ANSWER, {
      audience: config.audience,
      nowOverride: config.nowOverride,
    });
    return reply.send({
      scenario,
      label: config.label,
      holiday: holiday ? { nameAr: holiday.nameAr, greetingAr: holiday.greetingAr } : null,
      holidayActive: holiday !== null,
      sampleAnswer: SAMPLE_ANSWER,
      finalAnswer,
    });
  });

  app.get("/api/holiday-greetings/today", (req: any, reply: any) => {
    const audience = ((req.query as any)?.audience as HolidayAudience) ?? "ALL";
    const holiday = getTodayHoliday({ audience });
    return reply.send({
      today: new Date().toISOString().slice(0, 10),
      audience,
      holiday: holiday ? { nameAr: holiday.nameAr, greetingAr: holiday.greetingAr } : null,
      holidayActive: holiday !== null,
    });
  });
}