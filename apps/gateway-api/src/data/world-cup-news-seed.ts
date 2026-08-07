export type WorldCupNewsItem = {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  sourceLabel: string;
  sourceUrl: string;
  tags: string[];
  isBreaking: boolean;
};

export type WorldCupNewsCrawlSource = {
  id: string;
  label: string;
  baseUrl: string;
  feedUrl?: string;
  crawlIntervalMinutes: number;
  parser: "rss" | "html" | "api";
  enabled: boolean;
};

export const worldCupNewsSeed: WorldCupNewsItem[] = [
  {
    id: "wc-news-001",
    title: "إعلان المواعيد النهائية لافتتاح كأس العالم 2026",
    summary: "تم تثبيت التوقيت الرسمي لمباراة الافتتاح مع تحديث نافذة الحضور الإعلامي والاعتماد الصحفي.",
    publishedAt: "2026-05-29T09:30:00Z",
    sourceLabel: "فيفا الرسمية",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures",
    tags: ["افتتاح", "جدول", "رسمي"],
    isBreaking: false,
  },
  {
    id: "wc-news-002",
    title: "خبر عاجل: تحديث عاجل على لائحة الإصابات قبل الجولة الأولى",
    summary: "تحديث طبي رسمي لعدد من القوائم المبدئية، مع تأكيد إعادة تقييم نهائي قبل 48 ساعة من المباريات.",
    publishedAt: "2026-05-29T11:10:00Z",
    sourceLabel: "النشرة الطبية لفيفا",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
    tags: ["عاجل", "إصابات", "قوائم"],
    isBreaking: true,
  },
  {
    id: "wc-news-003",
    title: "تأكيد جاهزية الملاعب الرئيسية في المدن المستضيفة",
    summary: "تقارير التشغيل الأولي تؤكد اكتمال اختبارات الإضاءة والبث وشبكات الوصول للجماهير.",
    publishedAt: "2026-05-29T08:20:00Z",
    sourceLabel: "اللجنة المحلية 2026",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
    tags: ["ملاعب", "تنظيم", "مدن مستضيفة"],
    isBreaking: false,
  },
  {
    id: "wc-news-004",
    title: "برنامج النقل الجماهيري يضيف مسارات جديدة ليوم المباراة",
    summary: "إضافة خطوط مباشرة حول الملاعب لتقليل الازدحام وتحسين زمن الوصول قبل وبعد المباريات.",
    publishedAt: "2026-05-28T19:15:00Z",
    sourceLabel: "مكتب النقل للبطولة",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
    tags: ["جماهير", "نقل", "خدمات"],
    isBreaking: false,
  },
  {
    id: "wc-news-005",
    title: "تفعيل منصة المتطوعين للمرحلة التشغيلية النهائية",
    summary: "المرحلة الأخيرة من جداول المتطوعين بدأت مع تحديثات خاصة بالتوزيع داخل مناطق المشجعين.",
    publishedAt: "2026-05-28T15:05:00Z",
    sourceLabel: "إدارة المتطوعين",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
    tags: ["متطوعون", "تشغيل", "تنظيم"],
    isBreaking: false,
  },
  {
    id: "wc-news-006",
    title: "خبر عاجل: تعديل بروتوكول الدخول الأمني لمناطق الإعلام",
    summary: "تعديل فوري في بوابات الإعلام لتسريع الفحص وإدارة الحشود أثناء الذروة.",
    publishedAt: "2026-05-29T12:25:00Z",
    sourceLabel: "العمليات الأمنية 2026",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
    tags: ["عاجل", "أمن", "إعلام"],
    isBreaking: true,
  },
];

export const worldCupNewsCrawlSources: WorldCupNewsCrawlSource[] = [
  {
    id: "kooora-world-cup",
    label: "كووورة لكأس العالم 2026",
    baseUrl: "https://www.kooora.com/كرة-القدم/مسابقة/كأس-العالم/70excpe1synn9kadnbppahdn7",
    feedUrl: "https://www.kooora.com/كرة-القدم/مسابقة/كأس-العالم/أخبار/70excpe1synn9kadnbppahdn7",
    crawlIntervalMinutes: 20,
    parser: "html",
    enabled: true,
  },
];

export function getBreakingWorldCupNews(): WorldCupNewsItem[] {
  return worldCupNewsSeed
    .filter((item) => item.isBreaking)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
}
