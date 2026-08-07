import type { ComponentType, SVGProps } from "react";
import {
  DataBarVertical24Regular,
  Globe24Regular,
  News24Regular,
  People24Regular,
  TextBulletList24Regular,
  Trophy24Regular,
  QuestionCircle24Regular,
  ShieldRegular,
  BookRegular,
  CalculatorRegular,
  Chat24Regular,
  Settings24Regular,
  DocumentRegular,
  MoreHorizontal24Regular,
} from "../../theme/watany-v4/legacyIconBridge";

export type UnifiedPillarId =
  | "market"
  | "jobs"
  | "procedures"
  | "network"
  | "services"
  | "documents"
  | "salary"
  | "faq"
  | "legal"
  | "chat"
  | "world-cup";

export type UnifiedPillarItem = {
  id: string;
  label: string;
  icon: string | ComponentType<SVGProps<SVGSVGElement>>;
  route: string;
  description: string;
};

export type UnifiedPillarWidget = {
  label: string;
  value: string;
  detail: string;
};

export type UnifiedPillarFilter = {
  id: string;
  label: string;
  options: string[];
};

export type UnifiedPillarConfig = {
  id: UnifiedPillarId;
  title: string;
  route: string;
  subtitle: string;
  icon: string | ComponentType<SVGProps<SVGSVGElement>>;
  accent: string;
  searchPlaceholder: string;
  helperText: string;
  primaryAction: UnifiedPillarItem;
  navItems: UnifiedPillarItem[];
  filters: UnifiedPillarFilter[];
  widgets: UnifiedPillarWidget[];
  emptyState: string;
};


export const unifiedPillarIds: UnifiedPillarId[] = [
  "market",
  "jobs",
  "procedures",
  "network",
  "services",
  "documents",
  "salary",
  "faq",
  "legal",
  "chat",
  "world-cup",
];

export const unifiedPillars: Record<UnifiedPillarId, UnifiedPillarConfig> = {
  "world-cup": {
    id: "world-cup",
    title: "World Cup",
    route: "/world-cup",
    subtitle: "Matches, results, teams, polls, news, live links, and bracket.",
    icon: Trophy24Regular,
    accent: "green",
    searchPlaceholder: "Search World Cup",
    helperText: "Browse World Cup sections.",
    primaryAction: {
      id: "wc-today",
      label: "Today",
      icon: Trophy24Regular,
      route: "/world-cup/today",
      description: "Today's matches.",
    },
    navItems: [
      {
        id: "wc-today",
        label: "Today",
        icon: Trophy24Regular,
        route: "/world-cup/today",
        description: "Today's matches.",
      },
    ],
    filters: [],
    widgets: [],
    emptyState: "No World Cup content is available.",
  },
  market: {
    id: "market",
    title: "السوق والخدمات",
    route: "/market",
    subtitle: "سوق موثوق للتبادل والخدمات بين المتقاعدين والعائلات، مع مراجعة إدارية قبل النشر.",
    icon: TextBulletList24Regular,
    accent: "amber",
    searchPlaceholder: "بحث السوق عن سلعة أو خدمة أو مدينة",
    helperText: "استخدم البحث والتصفية للوصول إلى الإعلانات بسرعة.",
    primaryAction: { id: "browse-market", label: "تصفح السوق", icon: Globe24Regular, route: "/market", description: "تصفح الإعلانات المعتمدة." },
    navItems: [
      { id: "browse-market", label: "تصفح السوق", icon: Globe24Regular, route: "/market", description: "كل الإعلانات المنشورة." },
      { id: "my-listings", label: "إعلاناتي", icon: TextBulletList24Regular, route: "/market?tab=my-listings", description: "متابعة حالة إعلاناتي." },
      { id: "create-listing", label: "إنشاء إعلان", icon: DataBarVertical24Regular, route: "/market?tab=create", description: "إضافة إعلان جديد." },
      { id: "categories", label: "الفئات", icon: MoreHorizontal24Regular, route: "/market?tab=categories", description: "سيارات، أجهزة، خدمات، ومستلزمات." },
    ],
    filters: [
      { id: "category", label: "فئة الإعلان", options: ["الكل", "معدات طبية", "سيارات", "إلكترونيات", "خدمات", "أخرى"] },
      { id: "region", label: "المنطقة", options: ["كل لبنان", "بيروت", "الشمال", "البقاع", "الجنوب", "جبل لبنان"] },
      { id: "status", label: "حالة الإعلان", options: ["منشور", "بانتظار مراجعة الإدارة", "مرفوض", "محذوف"] },
      { id: "sort", label: "الترتيب", options: ["الأحدث", "الأقرب", "الأكثر ثقة"] }
    ],
    widgets: [
      { label: "البحث", value: "مفعّل", detail: "حسب العنوان والمدينة" },
      { label: "التصفية", value: "4", detail: "فئة، منطقة، حالة، ترتيب" },
      { label: "إعلاناتي", value: "متاحة", detail: "متابعة حالات النشر" }
    ],
    emptyState: "لا توجد إعلانات مطابقة. جرّب تغيير البحث أو التصفية."
  },
  jobs: {
    id: "jobs",
    title: "الوظائف والفرص",
    route: "/jobs",
    subtitle: "فرص عمل وخدمات مهنية للمتقاعدين والعائلات.",
    icon: People24Regular,
    accent: "emerald",
    searchPlaceholder: "ابحث عن وظيفة أو اختصاص",
    helperText: "فرز سريع حسب القطاع والمنطقة.",
    primaryAction: { id: "job-feed", label: "فرص العمل", icon: People24Regular, route: "/jobs", description: "قائمة الوظائف." },
    navItems: [
      { id: "job-feed", label: "فرص العمل", icon: People24Regular, route: "/jobs", description: "أحدث الفرص." },
      { id: "saved", label: "المحفوظة", icon: Trophy24Regular, route: "/jobs?tab=saved", description: "فرص محفوظة." },
      { id: "applications", label: "طلباتي", icon: TextBulletList24Regular, route: "/jobs?tab=applications", description: "متابعة الطلبات." },
    ],
    filters: [
      { id: "sector", label: "القطاع", options: ["الكل", "حراسة", "إدارة", "تقنية", "تعليم"] },
      { id: "region", label: "المنطقة", options: ["كل لبنان", "بيروت", "الشمال", "الجنوب"] }
    ],
    widgets: [
      { label: "بحث", value: "متاح", detail: "حسب الوظيفة" },
      { label: "فلترة", value: "متاحة", detail: "حسب القطاع" }
    ],
    emptyState: "لا توجد فرص مطابقة حالياً."
  },
  procedures: {
    id: "procedures",
    title: "المعاملات",
    route: "/procedures",
    subtitle: "تقسيم شامل للمعاملات الإدارية والخدمات المرتبطة.",
    icon: TextBulletList24Regular,
    accent: "indigo",
    searchPlaceholder: "ابحث عن معاملة",
    helperText: "اختر الفئة المطلوبة من الأعلى.",
    primaryAction: { id: "categories", label: "الفئات", icon: TextBulletList24Regular, route: "/procedures", description: "الفئات الرئيسية." },
    navItems: [
      { id: "categories", label: "الفئات", icon: TextBulletList24Regular, route: "/procedures", description: "كل الفئات." },
      { id: "saved", label: "المحفوظة", icon: Trophy24Regular, route: "/procedures?tab=saved", description: "ما احفظته." },
      { id: "documents", label: "المستندات", icon: DocumentRegular, route: "/procedures?tab=documents", description: "المستندات المرتبطة." },
    ],
    filters: [
      { id: "category", label: "الفئة", options: ["الكل", "جديد", "أهم", "متكرر"] }
    ],
    widgets: [
      { label: "فئات", value: "6", detail: "تقاعد وراتب وصحة وتعليم وإعانات وتأمين" },
      { label: "معاملة", value: "29", detail: "متوسط وقت: 10 دقائق" }
    ],
    emptyState: "اختر قسماً من الأعلى لعرض المعاملات."
  },
  network: {
    id: "network",
    title: "الشبكة والدليل",
    route: "/network",
    subtitle: "دليل مناطق، مؤسسات، وخدمات قريبة من المستخدم.",
      icon: Globe24Regular,
      accent: "sky",
    searchPlaceholder: "ابحث في الشبكة أو المنطقة",
    helperText: "تنقل حسب المحافظة أو الفئة.",
    primaryAction: { id: "directory", label: "الدليل", icon: "📍", route: "/network", description: "دليل المناطق والخدمات." },
    navItems: [
      { id: "directory", label: "الدليل", icon: People24Regular, route: "/network", description: "قائمة الخدمات." },
      { id: "regions", label: "المناطق", icon: Globe24Regular, route: "/network?tab=regions", description: "محافظات وأقضية." },
      { id: "contacts", label: "أرقام مهمة", icon: Settings24Regular, route: "/network?tab=contacts", description: "هواتف وخدمات." },
    ],
    filters: [
      { id: "region", label: "المحافظة", options: ["الكل", "بيروت", "الشمال", "البقاع", "الجنوب"] },
      { id: "category", label: "الفئة", options: ["الكل", "مستشفى", "بلدية", "خدمات"] }
    ],
    widgets: [
      { label: "شبكة", value: "محلية", detail: "حسب المنطقة" },
      { label: "بحث", value: "مفعّل", detail: "بالاسم والفئة" }
    ],
    emptyState: "لا توجد نتيجة في هذا الدليل."
  },
  services: {
    id: "services",
    title: "الخدمات",
    route: "/services",
    subtitle: "خدمات عامة ومساندة قابلة للبحث والتصفية.",
      icon: Settings24Regular,
      accent: "amber",
    searchPlaceholder: "ابحث عن خدمة",
    helperText: "اختر الخدمة أو الفئة المناسبة.",
      primaryAction: { id: "service-list", label: "قائمة الخدمات", icon: Settings24Regular, route: "/services", description: "الخدمات المتاحة." },
    navItems: [
        { id: "service-list", label: "قائمة الخدمات", icon: Settings24Regular, route: "/services", description: "الخدمات المتاحة." },
      { id: "categories", label: "التصنيفات", icon: MoreHorizontal24Regular, route: "/services?tab=categories", description: "حسب النوع." },
      { id: "support", label: "الدعم", icon: QuestionCircle24Regular, route: "/services?tab=support", description: "مساندة ومساعدة." },
    ],
    filters: [
      { id: "category", label: "الفئة", options: ["الكل", "صحية", "تعليمية", "إدارية"] }
    ],
    widgets: [
      { label: "خدمات", value: "منظمة", detail: "بطاقات واضحة" },
      { label: "فلترة", value: "متاحة", detail: "حسب الفئة" }
    ],
    emptyState: "لا توجد خدمات مطابقة."
  },
  documents: {
    id: "documents",
    title: "القوانين والمراجع",
    route: "/documents",
    subtitle: "مكتبة مستندات وقوانين ومراجع قابلة للبحث.",
      icon: BookRegular,
      accent: "purple",
    searchPlaceholder: "ابحث عن قانون أو مستند",
    helperText: "اعثر على المرجع بسرعة.",
      primaryAction: { id: "library", label: "المكتبة", icon: BookRegular, route: "/documents", description: "كل المستندات." },
    navItems: [
        { id: "library", label: "المكتبة", icon: BookRegular, route: "/documents", description: "المراجع والقوانين." },
      { id: "laws", label: "القوانين", icon: ShieldRegular, route: "/documents?tab=laws", description: "نصوص قانونية." },
      { id: "downloads", label: "التنزيل", icon: DocumentRegular, route: "/documents?tab=downloads", description: "تنزيل ومشاركة." },
    ],
    filters: [
      { id: "type", label: "النوع", options: ["الكل", "قانون", "تعميم", "نموذج"] }
    ],
    widgets: [
      { label: "مراجع", value: "منظمة", detail: "حسب النوع" },
      { label: "بحث", value: "مفعّل", detail: "بالعنوان" }
    ],
    emptyState: "لا توجد مستندات مطابقة."
  },
  salary: {
    id: "salary",
    title: "الراتب والتقاعد",
    route: "/salary",
    subtitle: "حسابات ومعلومات الراتب والتقاعد بطريقة مبسطة.",
      icon: CalculatorRegular,
      accent: "emerald",
    searchPlaceholder: "ابحث عن رتبة أو درجة أو تعويض",
    helperText: "ابدأ بالحاسبة أو التعليمات.",
      primaryAction: { id: "calculator", label: "الحاسبة", icon: CalculatorRegular, route: "/salary", description: "حساب الراتب والتقاعد." },
    navItems: [
        { id: "calculator", label: "الحاسبة", icon: CalculatorRegular, route: "/salary", description: "حساب مبدئي." },
      { id: "rules", label: "القواعد", icon: BookRegular, route: "/salary?tab=rules", description: "شرح القواعد." },
      { id: "examples", label: "أمثلة", icon: TextBulletList24Regular, route: "/salary?tab=examples", description: "أمثلة تطبيقية." },
    ],
    filters: [
      { id: "rank", label: "الرتبة", options: ["الكل", "جندي", "ملازم", "عميد"] }
    ],
    widgets: [
      { label: "حساب", value: "موجّه", detail: "رتبة ودرجة" },
      { label: "مراجع", value: "مرتبطة", detail: "قوانين وتعليمات" }
    ],
    emptyState: "أدخل البيانات المطلوبة للحساب."
  },
  faq: {
    id: "faq",
    title: "الأسئلة والمساعدة",
    route: "/faq",
    subtitle: "إجابات مختصرة وموجهة للأسئلة الشائعة.",
      icon: QuestionCircle24Regular,
    accent: "rose",
    searchPlaceholder: "ابحث في الأسئلة",
    helperText: "اختر سؤالاً أو اطلب مساعدة إضافية.",
      primaryAction: { id: "faq-list", label: "الأسئلة", icon: QuestionCircle24Regular, route: "/faq", description: "أسئلة شائعة." },
    navItems: [
        { id: "faq-list", label: "الأسئلة", icon: QuestionCircle24Regular, route: "/faq", description: "الأكثر تكراراً." },
      { id: "trending", label: "الأكثر تداولاً", icon: Trophy24Regular, route: "/faq?tab=trending", description: "أسئلة رائجة." },
      { id: "contact", label: "تواصل", icon: Settings24Regular, route: "/faq?tab=contact", description: "طلب مساعدة." },
    ],
    filters: [
      { id: "topic", label: "الموضوع", options: ["الكل", "راتب", "طبابة", "مدارس", "معاملات"] }
    ],
    widgets: [
      { label: "إرشاد", value: "مبسط", detail: "سؤال وجواب" },
      { label: "بحث", value: "متاح", detail: "بالكلمات" }
    ],
    emptyState: "لا توجد أسئلة مطابقة."
  },
  chat: {
    id: "chat",
    title: "المساعد الذكي",
    route: "/chat",
    subtitle: "واجهة محادثة موجهة وسهلة لكبار السن والعائلات.",
      icon: Chat24Regular,
      accent: "cyan",
    searchPlaceholder: "ابحث في المحادثات أو ابدأ سؤالاً",
    helperText: "اسأل بطريقة بسيطة أو اختر من القوائم.",
      primaryAction: { id: "new-chat", label: "محادثة جديدة", icon: Chat24Regular, route: "/chat", description: "ابدأ سؤالاً جديداً." },
    navItems: [
        { id: "new-chat", label: "محادثة جديدة", icon: Chat24Regular, route: "/chat", description: "ابدأ الآن." },
      { id: "history", label: "السجل", icon: TextBulletList24Regular, route: "/chat?tab=history", description: "محادثات سابقة." },
      { id: "voice", label: "الصوت", icon: News24Regular, route: "/chat?tab=voice", description: "مساعدة صوتية." },
    ],
    filters: [
      { id: "mode", label: "النمط", options: ["الكل", "كتابة", "صوت", "إرشاد"] }
    ],
    widgets: [
      { label: "عربي", value: "أولاً", detail: "محادثة مبسطة" },
      { label: "إرشاد", value: "موجّه", detail: "خطوة بخطوة" }
    ],
    emptyState: "ابدأ محادثة جديدة أو اختر من السجل."
  },
  legal: {
    id: "legal",
    title: "القوانين والحقوق",
    route: "/legal",
    subtitle: "مرجع قانوني موثوق يوفر نصوص القوانين واللوائح المتعلقة بالعاملين والمتقاعدين.",
      icon: ShieldRegular,
    accent: "slate",
    searchPlaceholder: "ابحث عن قانون أو مادة قانونية",
    helperText: "ابحث حسب المجال أو اطلع على النصوص الكاملة.",
      primaryAction: { id: "laws-search", label: "البحث القانوني", icon: ShieldRegular, route: "/legal", description: "ابحث في النصوص القانونية." },
    navItems: [
        { id: "laws-search", label: "البحث القانوني", icon: ShieldRegular, route: "/legal", description: "البحث عن القوانين واللوائح." },
      { id: "browse-laws", label: "تصفح القوانين", icon: BookRegular, route: "/legal?tab=browse", description: "تصفح حسب المجال." },
      { id: "rights", label: "الحقوق", icon: Settings24Regular, route: "/legal?tab=rights", description: "معلومات الحقوق والواجبات." },
    ],
    filters: [
      { id: "domain", label: "المجال", options: ["الكل", "تقاعد", "تعويضات", "صحة", "تعليم"] }
    ],
    widgets: [
      { label: "بحث", value: "مفعّل", detail: "حسب المادة والنص" },
      { label: "قوانين", value: "محدثة", detail: "نصوص رسمية" }
    ],
    emptyState: "لا توجد قوانين مطابقة لبحثك."
  }
};

export function getUnifiedPillarConfig(pillarId: UnifiedPillarId): UnifiedPillarConfig {
  return unifiedPillars[pillarId];
}


