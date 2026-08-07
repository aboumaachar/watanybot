export type KbTagDefinition = {
  id: string;
  labelAr: string;
  aliases: string[];
  priority: number;
  kbScopes: string[];
};

export type KbTagMatch = {
  tagId: string;
  labelAr: string;
  score: number;
  matchedAliases: string[];
  kbScopes: string[];
};

export const watanyKbTags: KbTagDefinition[] = [
  {
    id: "pension",
    labelAr: "المعاش التقاعدي",
    aliases: ["معاش", "راتب تقاعدي", "تقاعد", "افادة معاش", "إفادة معاش", "راتبي", "قبض"],
    priority: 100,
    kbScopes: ["pension", "salary", "mof", "retirement"]
  },
  {
    id: "healthcare",
    labelAr: "الصحة والاستشفاء",
    aliases: ["طبابة", "استشفاء", "مستشفى", "دواء", "مساعدة مرضية", "صحة", "فحوصات", "مختبر"],
    priority: 95,
    kbScopes: ["health", "medical", "hospitalization"]
  },
  {
    id: "school_grants",
    labelAr: "المساعدات المدرسية",
    aliases: ["مدرسة", "مساعدة مدرسية", "منحة", "مدارس", "اولاد", "أولاد", "تعليم"],
    priority: 90,
    kbScopes: ["school-grants", "education"]
  },
  {
    id: "documents",
    labelAr: "المستندات والإفادات",
    aliases: ["مستند", "افادة", "إفادة", "ورقة", "طلب", "اخراج قيد", "إخراج قيد", "بيان قيد"],
    priority: 85,
    kbScopes: ["documents", "forms", "procedures"]
  },
  {
    id: "procedures",
    labelAr: "الإجراءات والمعاملات",
    aliases: ["معاملة", "اجراء", "إجراء", "كيف قدم", "طلب", "مراجعة", "دائرة"],
    priority: 80,
    kbScopes: ["procedures", "forms"]
  },
  {
    id: "laws_directives",
    labelAr: "القوانين والتعاميم",
    aliases: ["قانون", "مرسوم", "تعميم", "تعليمات", "نظام", "حقوق"],
    priority: 78,
    kbScopes: ["laws", "directives", "legal"]
  },
  {
    id: "al_wafiyat",
    labelAr: "الوفيات",
    aliases: ["وفيات", "وفاة", "نعوة", "متوفي", "المتوفى", "توفي"],
    priority: 76,
    kbScopes: ["al-wafiyat", "army-deceased", "isf-deaths"]
  },
  {
    id: "army_services",
    labelAr: "خدمات الجيش اللبناني",
    aliases: ["الجيش", "الطبابة العسكرية", "مديرية", "تطوع", "شروط التطوع", "معاملات الجيش"],
    priority: 74,
    kbScopes: ["laf", "army", "military-services"]
  },
  {
    id: "isf_services",
    labelAr: "خدمات قوى الأمن الداخلي",
    aliases: ["قوى الأمن", "قوى الامن", "isf", "رادار", "ميكانيك", "مخالفات"],
    priority: 72,
    kbScopes: ["isf", "traffic", "mechanic", "medical-allowances"]
  },
  {
    id: "other",
    labelAr: "أو شي تاني",
    aliases: ["شي تاني", "موضوع تاني", "غير ذلك", "غيره", "اخر", "آخر"],
    priority: 10,
    kbScopes: ["general"]
  }
];

function normalize(input: string) {
  return input
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchKbTags(message: string, maxResults = 5): KbTagMatch[] {
  const normalized = normalize(message);

  const matches = watanyKbTags
    .map((tag) => {
      const matchedAliases = tag.aliases.filter((alias) => {
        const normalizedAlias = normalize(alias);
        return normalized.includes(normalizedAlias);
      });

      const exactLabel = normalized.includes(normalize(tag.labelAr));
      const score = matchedAliases.length * 20 + (exactLabel ? 25 : 0) + tag.priority / 10;

      return {
        tagId: tag.id,
        labelAr: tag.labelAr,
        score,
        matchedAliases,
        kbScopes: tag.kbScopes
      } satisfies KbTagMatch;
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return matches.length > 0
    ? matches
    : [
        {
          tagId: "other",
          labelAr: "أو شي تاني",
          score: 1,
          matchedAliases: [],
          kbScopes: ["general"]
        }
      ];
}

export function getKbScopesForRequest(message: string) {
  return Array.from(new Set(matchKbTags(message).flatMap((match) => match.kbScopes)));
}