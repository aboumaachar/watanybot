export type WatanyRouteSpec = {
  id: string;
  path: string;
  title: string;
  description: string;
  icon: string;
  category: "services" | "account" | "support" | "information" | "core";
};

export const watanyCoreRouteSpecs: WatanyRouteSpec[] = [
  { id: "documents",             path: "/documents",         title: "المستندات",           description: "المستندات والملفات المطلوبة.",                                                       icon: "document",  category: "services" },
  { id: "forms",                 path: "/forms",             title: "النماذج",             description: "نماذج ومعاملات جاهزة للاستخدام.",                                                     icon: "calculator",category: "services" },
  { id: "procedures",            path: "/procedures",        title: "المعاملات",           description: "خطوات واضحة لإنجاز المعاملات.",                                                       icon: "document",  category: "services" },
  { id: "salary",                path: "/salary",            title: "حاسبة المعاش",       description: "احسب معاشك التقاعدي بحسب الرتبة والدرجة والوضع العائلي.",                            icon: "calculator",category: "services" },
  { id: "pension",               path: "/pension",           title: "",                   description: "اطلب  مباشرة من خدمة وزارة المالية.",                                                   icon: "money",     category: "services" },
  { id: "official-services",     path: "/services/official", title: "روابط مفيدة",        description: "روابط ومراجع رسمية في مكان واحد داخل موطني.",                                          icon: "building",  category: "services" },
  { id: "official-service-detail",path: "/services/official",title: "تفاصيل الرابط الرسمي",description: "استعلام أو دليل أو بوابة رسمية ضمن تجربة موطني.",                                     icon: "folder",    category: "services" },
  { id: "al-wafiyat",            path: "/al-wafiyat",        title: "الوفيات الرسمية",     description: "متابعة الإعلانات الرسمية للوفيات بعد الاعتماد الإداري.",                              icon: "document",  category: "services" },
  { id: "alerts",                path: "/alerts",            title: "التنبيهات",           description: "متابعة التنبيهات والإشعارات المهمة.",                                                 icon: "warning",   category: "core" },
  { id: "notifications",         path: "/notifications",     title: "الإشعارات",           description: "كل التحديثات في مكان واحد.",                                                          icon: "megaphone", category: "core" },
  { id: "search",                path: "/search",            title: "البحث",               description: "ابحث في الخدمات والمعلومات.",                                                         icon: "search",    category: "core" },
  { id: "profile",               path: "/profile",           title: "ملفي",               description: "إدارة المعلومات الشخصية والتفضيلات.",                                                  icon: "person",    category: "account" },
  { id: "faq",                   path: "/faq",               title: "الأسئلة الشائعة",     description: "إجابات سريعة عن الأسئلة المتكررة.",                                                   icon: "faq",       category: "support" },
  { id: "useful-links",          path: "/useful-links",      title: "روابط مفيدة",         description: "روابط ومراجع مهمة.",                                                                  icon: "apps",      category: "information" },
  { id: "the-network",           path: "/network",             title: "الشبكة",             description: "دليل شبكة موطني والجهات والخدمات المرتبطة بها.",                                         icon: "network",   category: "services" },
  { id: "legal",                 path: "/legal",             title: "قانوني",              description: "معلومات قانونية وإرشادية.",                                                            icon: "law",       category: "information" },
];

export function getWatanyRouteSpec(pathname: string) {
  return watanyCoreRouteSpecs.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
}

// APEX THE NETWORK WEB ROUTE REVIEW HOOK
// The Network is registered on /network and exposed in route specs.
// Marker: APEX_THE_NETWORK_WEB_ROUTE_REGISTRATION_REQUIRED