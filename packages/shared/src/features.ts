export type FeatureId =
  | "news"
  | "media"
  | "salary"
  | "school-grants"
  | "cases"
  | "documents"
  | "browse"
  | "jobs"
  | "marketplace"
  | "alerts"
  | "forms"
  | "saved"
  | "bookmarks"
  | "govservices"
  | "groups"
  | "chat-sessions"
  | "procedures"
  | "knowledge"
  | "disaster"
  | "search"
  | "notifications"
  | "profile"
  | "dictation"
  | "speak-replies"
  | "whatsapp-mode"
  | "ticker_bar"
  | "ticker_faq"
  | "ticker_announcements"
  | "ticker_case_updates"
  | "ticker_highlights";

export type FeatureCategory = "core" | "services" | "communication" | "account";

export type FeatureMeta = {
  id: FeatureId;
  label: string;
  desc: string;
  icon: string;
  category: FeatureCategory;
  canDisable: boolean;
};

export const FEATURES: FeatureMeta[] = [
  { id: "news", label: "الأخبار", desc: "أخبار وإعلانات وزارة الدفاع والشأن العسكري", icon: "news", category: "core", canDisable: true },
  { id: "search", label: "البحث", desc: "البحث في قاعدة المعرفة", icon: "search", category: "core", canDisable: true },
  { id: "notifications", label: "الإشعارات", desc: "نظام الإشعارات والتنبيهات", icon: "alert", category: "core", canDisable: true },
  { id: "ticker_bar", label: "شريط الأخبار", desc: "عرض شريط التحديثات في أعلى الشات", icon: "news", category: "core", canDisable: true },
  { id: "ticker_faq", label: "أسئلة شائعة", desc: "إظهار أبرز الأسئلة المتكررة", icon: "faq", category: "core", canDisable: true },
  { id: "ticker_announcements", label: "إعلانات الشريط", desc: "عرض إعلانات الإدارة", icon: "alert", category: "core", canDisable: true },
  { id: "ticker_case_updates", label: "تحديثات القضايا", desc: "عرض أحدث التحديثات على القضايا", icon: "folder", category: "core", canDisable: true },
  { id: "ticker_highlights", label: "النقاط البارزة", desc: "عرض التنبيهات والهايلايت", icon: "star", category: "core", canDisable: true },
  { id: "profile", label: "الملف الشخصي", desc: "صفحة الحساب الشخصي", icon: "person", category: "core", canDisable: false },
  { id: "media", label: "المركز الإعلامي", desc: "غرف بث مباشر واجتماعات ومشاركة الشاشة", icon: "video", category: "services", canDisable: true },
  { id: "salary", label: "حاسبة المعاش", desc: "احسب معاشك ومستحقاتك", icon: "calculator", category: "services", canDisable: true },
  { id: "school-grants", label: "المساعدات المدرسية", desc: "احتساب المنح المدرسية بشكل مستقل", icon: "education", category: "services", canDisable: true },
  { id: "cases", label: "معاملاتي", desc: "تتبع القضايا والطلبات", icon: "folder", category: "services", canDisable: true },
  { id: "documents", label: "مستنداتي", desc: "إدارة المستندات الخاصة", icon: "document", category: "services", canDisable: true },
  { id: "jobs", label: "فرص عمل", desc: "وظائف شاغرة للعسكريين", icon: "briefcase", category: "services", canDisable: true },
  { id: "marketplace", label: "السوق", desc: "بيع وشراء بين المتقاعدين", icon: "apps", category: "services", canDisable: true },
  { id: "alerts", label: "تنبيهات طوارئ", desc: "تنبيهات أمنية وطوارئ", icon: "warning", category: "services", canDisable: true },
  { id: "forms", label: "الملفات والنماذج", desc: "النماذج والملفات الرسمية المرتبطة بالإجراءات", icon: "document", category: "services", canDisable: true },
  { id: "saved", label: "محادثات محفوظة", desc: "الأسئلة والأجوبة المحفوظة", icon: "bookmark", category: "services", canDisable: true },
  { id: "bookmarks", label: "المفضّلة", desc: "معاملات حفظتها سابقاً", icon: "star", category: "services", canDisable: true },
  { id: "govservices", label: "الخدمات الرسمية السريعة", desc: "الخدمات الرسمية المدمجة مثل المساعدات المرضية والرادار وإخراج القيد", icon: "building", category: "services", canDisable: true },
  { id: "groups", label: "المجموعات", desc: "مجموعات النقاش المجتمعية", icon: "people", category: "services", canDisable: true },
  { id: "chat-sessions", label: "طلبات المحادثة", desc: "إدارة جلسات المحادثة", icon: "chat", category: "services", canDisable: true },
  { id: "procedures", label: "الإجراءات", desc: "بحث وعرض الإجراءات والمعاملات", icon: "check", category: "services", canDisable: true },
  { id: "knowledge", label: "المراجع الرسمية", desc: "مراجع الشؤون والجيش والمالية الرسمية", icon: "education", category: "services", canDisable: true },
  { id: "disaster", label: "إدارة الكوارث", desc: "مراكز إيواء، طوارئ، متطوعين", icon: "warning", category: "services", canDisable: true },
  { id: "dictation", label: "الإملاء الصوتي", desc: "إدخال النص بالصوت", icon: "mic", category: "communication", canDisable: true },
  { id: "speak-replies", label: "قراءة الردود صوتياً", desc: "تحويل ردود البوت إلى صوت", icon: "alert", category: "communication", canDisable: true },
  { id: "whatsapp-mode", label: "وضع واتساب", desc: "واجهة تشبه واتساب", icon: "phone", category: "communication", canDisable: true },
];

export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  core: "الأساسيات",
  services: "الخدمات",
  communication: "الاتصال والصوت",
  account: "الحساب",
};

export function defaultFeatureFlags(): Record<FeatureId, boolean> {
  const map: Partial<Record<FeatureId, boolean>> = {};
  for (const feature of FEATURES) {
    map[feature.id] = true;
  }
  return map as Record<FeatureId, boolean>;
}