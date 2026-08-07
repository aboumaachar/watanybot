export type KbTagDefinition = {
  id: string;
  label: string;
  labelAr: string;
  labelEn?: string;
  aliases: string[];
  category: string;
  priority: number;
  suggestedQuestions: string[];
};

export const DEFAULT_WATANY_KB_TAGS: KbTagDefinition[] = [
  {
    id: "school-grants",
    label: "منح مدرسية",
    labelAr: "منح مدرسية",
    labelEn: "School grants",
    aliases: ["مدرسة", "مدارس", "تعليم", "school", "school grant", "مساعدة مدرسية", "منحة مدرسية"],
    category: "payments",
    priority: 100,
    suggestedQuestions: ["ما هي المستندات المطلوبة؟", "كيف أقدم الطلب؟", "متى تصدر الدفعة؟", "او شي تاني"]
  },
  {
    id: "medical-support",
    label: "طبابة واستشفاء",
    labelAr: "طبابة واستشفاء",
    labelEn: "Medical support",
    aliases: ["طبابة", "استشفاء", "مستشفى", "طبيب", "دواء", "hospital", "medical", "tebabe"],
    category: "healthcare",
    priority: 95,
    suggestedQuestions: ["كيف أقدم طلب طبابة؟", "ما هي المستندات المطلوبة؟", "أين أراجع؟", "او شي تاني"]
  },
  {
    id: "salary-pension",
    label: "راتب ومعاش تقاعدي",
    labelAr: "راتب ومعاش تقاعدي",
    labelEn: "Salary and pension",
    aliases: ["راتب", "معاش", "تقاعد", "أساس الراتب", "حسم 1.5", "salary", "pension"],
    category: "salary",
    priority: 90,
    suggestedQuestions: ["كيف يتم احتساب المعاش؟", "ما هو أساس الراتب؟", "ما أثر الدرجة والرتبة؟", "او شي تاني"]
  },
  {
    id: "compensations",
    label: "تعويضات ومساعدات",
    labelAr: "تعويضات ومساعدات",
    labelEn: "Compensations and assistance",
    aliases: ["تعويض", "تعويضات", "مساعدة", "مساعدات", "ta3wid", "taawid"],
    category: "payments",
    priority: 85,
    suggestedQuestions: ["ما هي أنواع التعويضات؟", "من يستفيد؟", "كيف أتابع الطلب؟", "او شي تاني"]
  },
  {
    id: "payment-status",
    label: "حالة الدفعات",
    labelAr: "حالة الدفعات",
    labelEn: "Payment status",
    aliases: ["دفعة", "مدفوعات", "قبض", "نزلت", "payment", "daf3a"],
    category: "payment-intelligence",
    priority: 80,
    suggestedQuestions: ["هل الدفعة ثابتة أم متغيرة؟", "هل يوجد إعلان إداري؟", "كيف أتحقق؟", "او شي تاني"]
  },
  {
    id: "documents-procedures",
    label: "مستندات ومعاملات",
    labelAr: "مستندات ومعاملات",
    labelEn: "Documents and procedures",
    aliases: ["مستند", "مستندات", "معاملة", "معاملات", "طلب", "procedure", "documents"],
    category: "procedures",
    priority: 75,
    suggestedQuestions: ["ما هي المستندات المطلوبة؟", "ما هي الخطوات؟", "أين أقدم المعاملة؟", "او شي تاني"]
  },
  {
    id: "medals",
    label: "أوسمة",
    labelAr: "أوسمة",
    labelEn: "Medals",
    aliases: ["وسام", "اوسمة", "أوسمة", "medal", "awseme"],
    category: "salary",
    priority: 65,
    suggestedQuestions: ["هل الوسام يؤثر على الاحتساب؟", "كيف أضيف وسام؟", "او شي تاني"]
  }
];

export function getDefaultWatanyTags(): KbTagDefinition[] {
  return DEFAULT_WATANY_KB_TAGS;
}