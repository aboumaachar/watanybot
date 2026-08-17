export type UniversalFeatureMenuItem = Readonly<{
  id: string;
  label: string;
  route: string;
  iconFeatureId: string;
  description?: string;
}>;

export type UniversalFeatureMenuGroup = Readonly<{
  id: string;
  label: string;
  route: string;
  iconFeatureId: string;
  items: readonly UniversalFeatureMenuItem[];
  drawerLevel?: "group" | "top-level";
}>;

export const DRAWER_MENU_GROUPS: readonly UniversalFeatureMenuGroup[] = [
  {
    id: "procedures",
    label: "الإجراءات",
    route: "/procedures",
    iconFeatureId: "procedures",
    items: [
      { id: "schools", label: "مدارس", route: "/school-grants", iconFeatureId: "schools" },
      { id: "procedures", label: "معاملات", route: "/procedures", iconFeatureId: "procedures" },
      { id: "pension", label: "المعاش", route: "/salary", iconFeatureId: "salary" },
      { id: "forms", label: "نماذج", route: "/forms", iconFeatureId: "forms" },
    ],
  },
  {
    id: "daily-services",
    label: "الخدمات والفرص",
    route: "/taxi",
    iconFeatureId: "taxi",
    items: [
      { id: "taxi", label: "تاكسي", route: "/taxi", iconFeatureId: "taxi" },
      { id: "market", label: "السوق", route: "/marketplace", iconFeatureId: "marketplace" },
      { id: "jobs", label: "وظائف", route: "/jobs", iconFeatureId: "jobs" },
      { id: "network", label: "الشبكة", route: "/network", iconFeatureId: "network" },
      { id: "tools", label: "أدوات", route: "/tools", iconFeatureId: "tools" },
    ],
  },
  {
    id: "information",
    label: "المعلومات والمراجع",
    route: "/legal",
    iconFeatureId: "laws",
    items: [
      { id: "laws", label: "قوانين", route: "/legal", iconFeatureId: "laws" },
      { id: "questions", label: "أسئلة", route: "/faq", iconFeatureId: "faq" },
      { id: "links", label: "روابط", route: "/services/official", iconFeatureId: "links" },
      { id: "circulars", label: "التعاميم", route: "/circulars", iconFeatureId: "circulars" },
      { id: "deaths", label: "وفيات", route: "/deaths", iconFeatureId: "deaths" },
    ],
  },
  {
    id: "community-media",
    label: "المجتمع والإعلام",
    route: "/community",
    iconFeatureId: "community",
    items: [
      { id: "community", label: "مجتمعي", route: "/community", iconFeatureId: "community" },
      { id: "vote", label: "صوّت", route: "/voting", iconFeatureId: "voting" },
      { id: "fake", label: "زائف", route: "/fake-fact", iconFeatureId: "fake-fact" },
      { id: "news", label: "أخبار", route: "/news", iconFeatureId: "news" },
      { id: "articles", label: "مقالات", route: "/news", iconFeatureId: "news" },
    ],
  },
  {
    id: "account",
    label: "الحساب والإعدادات",
    route: "/profile",
    iconFeatureId: "profile",
    items: [
      { id: "profile", label: "ملفي", route: "/profile", iconFeatureId: "profile" },
      { id: "settings", label: "الإعدادات", route: "/settings", iconFeatureId: "settings" },
    ],
  },
];

export const UNIVERSAL_FEATURE_GROUPS: readonly UniversalFeatureMenuGroup[] = [
  {
    id: "home",
    label: "الرئيسية",
    route: "/",
    iconFeatureId: "home",
    items: [
      { id: "all-features", label: "كل الخدمات", route: "/watany-all-features.html", iconFeatureId: "services" },
    ],
  },
  {
    id: "chat-community",
    label: "الدردشة والمجتمع",
    route: "/chat",
    iconFeatureId: "community",
    items: [
      { id: "hybrid-chat", label: "المساعد الذكي", route: "/chat", iconFeatureId: "chat" },
      { id: "voice-chat", label: "الدردشة الصوتية", route: "/voice-chat", iconFeatureId: "chat" },
      { id: "community", label: "المجتمع", route: "/community", iconFeatureId: "community" },
      { id: "messages", label: "رسائلي", route: "/messages", iconFeatureId: "chat" },
      { id: "saved", label: "المحفوظات", route: "/saved", iconFeatureId: "bookmarks" },
    ],
  },
  {
    id: "news-updates",
    label: "الأخبار والتعاميم",
    route: "/news",
    iconFeatureId: "news",
    items: [
      { id: "announcements", label: "التعاميم", route: "/announcements", iconFeatureId: "news" },
      { id: "news", label: "الأخبار", route: "/news", iconFeatureId: "news" },
      { id: "alerts", label: "التنبيهات", route: "/alerts", iconFeatureId: "alerts" },
      { id: "death-notices", label: "الوفيات", route: "/death-notices", iconFeatureId: "death-notices" },
    ],
  },
  {
    id: "procedures-documents",
    label: "معاملاتي ومراجعي",
    route: "/procedures",
    iconFeatureId: "procedures",
    items: [
      { id: "procedures", label: "المعاملات", route: "/procedures", iconFeatureId: "procedures" },
      { id: "forms", label: "النماذج", route: "/forms", iconFeatureId: "forms" },
      { id: "laws", label: "القوانين", route: "/laws", iconFeatureId: "laws" },
      { id: "documents", label: "الملفات والمستندات", route: "/documents", iconFeatureId: "documents" },
    ],
  },
  {
    id: "rights-pension",
    label: "حقوقي ومعاشي",
    route: "/salary",
    iconFeatureId: "payment",
    items: [
      { id: "salary", label: "حاسبة المعاش", route: "/salary", iconFeatureId: "calculator" },
      { id: "school-aid", label: "المساعدات المدرسية", route: "/school-grants", iconFeatureId: "assistance" },
      { id: "payments", label: "حالة الدفعات", route: "/payments", iconFeatureId: "payment" },
    ],
  },
  {
    id: "services-opportunities",
    label: "الخدمات والفرص",
    route: "/jobs",
    iconFeatureId: "jobs",
    items: [
      { id: "jobs", label: "الوظائف", route: "/jobs", iconFeatureId: "jobs" },
      { id: "recruitment", label: "التطويع", route: "/recruitment", iconFeatureId: "volunteering" },
      { id: "market", label: "السوق", route: "/market", iconFeatureId: "market" },
      { id: "taxi", label: "تاكسي", route: "/taxi", iconFeatureId: "services" },
      { id: "tourism", label: "المرشد السياحي", route: "/tourism", iconFeatureId: "services" },
      { id: "freelance", label: "الخدمات الحرة", route: "/freelance", iconFeatureId: "services" },
      { id: "providers", label: "مزودو الخدمات", route: "/providers", iconFeatureId: "services" },
      { id: "address-network", label: "أداة العنوان", route: "/address-network", iconFeatureId: "network" },
      { id: "emergency", label: "الدعم الطارئ", route: "/emergency", iconFeatureId: "support" },
    ],
  },
  {
    id: "participation-events",
    label: "المشاركة والفعاليات",
    route: "/events",
    iconFeatureId: "events",
    items: [
      { id: "voting", label: "صوّت", route: "/voting", iconFeatureId: "community" },
      { id: "polls", label: "الاستطلاعات", route: "/polls", iconFeatureId: "community" },
      { id: "events", label: "الفعاليات", route: "/events", iconFeatureId: "events" },
    ],
  },
  {
    id: "tools-account",
    label: "الأدوات والحساب",
    route: "/profile",
    iconFeatureId: "profile",
    items: [
      { id: "profile", label: "الملف الشخصي", route: "/profile", iconFeatureId: "profile" },
      { id: "settings", label: "الإعدادات", route: "/settings", iconFeatureId: "theme_system" },
      { id: "admin", label: "أدوات الإدارة", route: "/admin", iconFeatureId: "admin" },
      { id: "kb-studio", label: "KB Studio", route: "/kb-studio", iconFeatureId: "documents" },
      { id: "feature-flags", label: "إدارة ظهور الميزات", route: "/feature-flags", iconFeatureId: "settings" },
    ],
  },
];

export function getUniversalFeatureGroupForPath(pathname: string): UniversalFeatureMenuGroup {
  if (pathname === "/") return UNIVERSAL_FEATURE_GROUPS[0];

  const routeGroups: Array<[string, string]> = [
    ["chat-community", "/chat"], ["chat-community", "/voice-chat"], ["chat-community", "/community"], ["chat-community", "/messages"], ["chat-community", "/saved"],
    ["news-updates", "/announcements"], ["news-updates", "/news"], ["news-updates", "/alerts"], ["news-updates", "/death-notices"],
    ["procedures-documents", "/procedures"], ["procedures-documents", "/forms"], ["procedures-documents", "/laws"], ["procedures-documents", "/legal"], ["procedures-documents", "/documents"],
    ["rights-pension", "/salary"], ["rights-pension", "/school-grants"], ["rights-pension", "/payments"],
    ["services-opportunities", "/jobs"], ["services-opportunities", "/recruitment"], ["services-opportunities", "/market"], ["services-opportunities", "/taxi"], ["services-opportunities", "/tourism"], ["services-opportunities", "/freelance"], ["services-opportunities", "/providers"], ["services-opportunities", "/address-network"], ["services-opportunities", "/emergency"],
    ["participation-events", "/voting"], ["participation-events", "/polls"], ["participation-events", "/events"],
    ["tools-account", "/profile"], ["tools-account", "/settings"], ["tools-account", "/admin"], ["tools-account", "/kb-studio"], ["tools-account", "/feature-flags"],
  ];

  const match = routeGroups.find(([, prefix]) => pathname.startsWith(prefix));
  return UNIVERSAL_FEATURE_GROUPS.find((group) => group.id === match?.[0]) ?? UNIVERSAL_FEATURE_GROUPS[3];
}