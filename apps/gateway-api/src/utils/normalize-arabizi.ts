const ARABIZI_DICTIONARY: Record<string, string[]> = {
  madaris: ["مدارس", "منح مدرسية", "مساعدة مدرسية"],
  madrase: ["مدرسة", "مدارس", "منح مدرسية"],
  school: ["مدرسة", "مدارس", "منح مدرسية"],
  tebabe: ["طبابة", "استشفاء", "طبيب"],
  tebaba: ["طبابة", "استشفاء", "طبيب"],
  hospital: ["مستشفى", "طبابة", "استشفاء"],
  salary: ["راتب", "معاش", "تقاعد"],
  pension: ["راتب تقاعدي", "معاش", "تقاعد"],
  ta3wid: ["تعويض", "تعويضات"],
  taawid: ["تعويض", "تعويضات"],
  daf3a: ["دفعة", "مدفوعات", "مساعدة"],
  payment: ["دفعة", "مدفوعات", "مساعدة"],
  awseme: ["اوسمة", "وسام"],
  medal: ["اوسمة", "وسام"],
  procedure: ["معاملة", "اجراء", "مستندات"],
  mou3amale: ["معاملة", "اجراء", "مستندات"]
};

export function expandArabiziAliases(input?: string | null): string[] {
  if (!input) {
    return [];
  }

  const lower = String(input).toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const expansions = new Set<string>();

  for (const word of words) {
    const direct = ARABIZI_DICTIONARY[word];
    if (direct) {
      direct.forEach((entry) => expansions.add(entry));
    }
  }

  for (const [key, values] of Object.entries(ARABIZI_DICTIONARY)) {
    if (lower.includes(key)) {
      values.forEach((entry) => expansions.add(entry));
    }
  }

  return Array.from(expansions);
}