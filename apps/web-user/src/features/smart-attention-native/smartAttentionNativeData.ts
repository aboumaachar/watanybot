export type SmartAttentionFeatureKey = "most-requested" | "latest" | "for-you";

export type SmartAttentionItem = {
  id: string;
  title: string;
  summary: string;
  kind: string;
  source: string;
  href: string;
  veteransFirst?: boolean;
};

export type SmartAttentionFeature = {
  key: SmartAttentionFeatureKey;
  title: string;
  icon: string;
  href: string;
  items: SmartAttentionItem[];
};

export const smartAttentionFeatures: SmartAttentionFeature[] = [
  {
    key: "most-requested",
    title: "الاكثر طلبا",
    icon: "★",
    href: "/most-requested",
    items: [
      { id: "pension-calculator", title: "حاسبة المعاش", summary: "مدخل مباشر لحساب المعاش التقاعدي ومراجعة الأسئلة المرتبطة بالراتب والبدلات.", kind: "حاسبة", source: "حقوقي ومعاشي", href: "/salary", veteransFirst: true },
      { id: "jobs-feed", title: "الوظائف", summary: "يفتح قسم الوظائف لعرض الفرص المناسبة للعسكريين المتقاعدين والتقديم عليها مباشرة.", kind: "وظائف", source: "الخدمات والفرص", href: "/jobs", veteransFirst: true },
      { id: "market-browse", title: "السوق", summary: "يفتح السوق لعرض الإعلانات والخدمات والمنتجات القريبة وإدارة المشاركات بسهولة.", kind: "إعلانات", source: "السوق", href: "/marketplace" },
    ],
  },
  {
    key: "latest",
    title: "الاحدث",
    icon: "",
    href: "/latest",
    items: [
      { id: "latest-jobs", title: "وظائف جديدة مناسبة للمتقاعدين العسكريين", summary: "تجميع سريع للوظائف المنشورة حديثاً والتي تناسب الخبرات الإدارية والميدانية والعسكرية.", kind: "وظائف", source: "الخدمات والفرص", href: "/jobs", veteransFirst: true },
      { id: "latest-market", title: "إعلانات جديدة في السوق والخدمات", summary: "أحدث الإعلانات والخدمات المضافة ليستطيع المستخدم الوصول إليها قبل ازدحام النتائج.", kind: "إعلانات", source: "السوق", href: "/marketplace" },
      { id: "latest-forms", title: "نماذج ومعاملات مضافة حديثا", summary: "قائمة مختصرة بأحدث النماذج والمسارات الإجرائية التي أضيفت أو تم تحديثها مؤخراً.", kind: "نماذج", source: "معاملاتي", href: "/forms", veteransFirst: true },
    ],
  },
  {
    key: "for-you",
    title: "ممكن يهمك",
    icon: "✓",
    href: "/for-you",
    items: [
      { id: "for-you-pension", title: "متابعة المعاش التقاعدي والتعويضات", summary: "اقتراح مخصص يجمع أكثر الصفحات التي يحتاجها من يتابع ملفات المعاش والتعويضات والبدلات.", kind: "حقوق", source: "حسب اهتمامك", href: "/salary", veteransFirst: true },
      { id: "for-you-jobs", title: "فرص عمل قد تناسب خبرتك العسكرية", summary: "اقتراحات مبنية على طبيعة الخبرة والانضباط المهني والمهارات التنظيمية الشائعة لدى العسكريين.", kind: "وظائف", source: "حسب الخبرة", href: "/jobs", veteransFirst: true },
      { id: "for-you-faq", title: "أسئلة مشابهة لما بحثت عنه سابقا", summary: "مدخل سريع إلى إجابات متقاربة مع أسئلتك الأخيرة لتقليل وقت البحث والتنقل بين الأقسام.", kind: "FAQ", source: "حسب الأسئلة", href: "/faq", veteransFirst: true },
    ],
  },
];

export function getSmartAttentionFeature(key: SmartAttentionFeatureKey): SmartAttentionFeature {
  const found = smartAttentionFeatures.find((feature) => feature.key === key);
  return found || smartAttentionFeatures[0];
}

export function recordSmartAttentionEvent(type: string, id: string): void {
  if (typeof window === "undefined") return;

  try {
    const storageKey = "watany-smart-attention-events-v1";
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const rows = Array.isArray(parsed) ? parsed : [];
    rows.push({ type, id, at: Date.now(), path: window.location.pathname });
    window.localStorage.setItem(storageKey, JSON.stringify(rows.slice(-120)));
  } catch {
    // never block user flow
  }
}

export function loadSmartAttentionItems(featureKey: SmartAttentionFeatureKey): Promise<SmartAttentionItem[]> {
  return Promise.resolve(getSmartAttentionFeature(featureKey).items);
}