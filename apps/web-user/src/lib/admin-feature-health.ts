/**
 * admin-feature-health.ts
 * Static metadata for the Wave 9 admin feature-visibility audit panel.
 * Describes each user-facing module: enabled gate, route/action, visible
 * surfaces, and known health warnings.
 */
import type { FeatureId } from "../store/features";

export type SurfaceId = "home" | "services" | "drawer" | "bottomnav";

export type AdminFeatureHealth = {
  /** Unique key within the audit list */
  id: string;
  /** FeatureId gate — undefined means the feature is always on */
  featureId?: FeatureId;
  /** Arabic display name */
  title: string;
  /** Internal route path (undefined for event-based access) */
  route?: string;
  /** How to open a preview from the admin panel */
  previewAction: "route" | "event" | "coming_soon";
  /** Route path or event name, depending on previewAction */
  previewPayload?: string;
  /** Which UI surfaces render a link/button to this feature */
  visibleSurfaces: SurfaceId[];
  /** Whether the route is wrapped in a FeatureGate / ProtectedRoute */
  routeGated: boolean;
  status: "ok" | "warning" | "blocked" | "unknown";
  warnings: string[];
  notes?: string;
};

export const SURFACE_LABELS: Record<SurfaceId, string> = {
  home:      "الرئيسية",
  services:  "الخدمات",
  drawer:    "الدرج",
  bottomnav: "الشريط السفلي",
};

export const FEATURE_AUDIT: AdminFeatureHealth[] = [
  {
    id: "chat",
    title: "المحادثة — ",
    route: "/chat",
    previewAction: "route",
    previewPayload: "/chat",
    visibleSurfaces: ["home", "services", "drawer"],
    routeGated: false,
    status: "ok",
    warnings: [],
    notes: "متاح دائماً — لا توجد فلاق لتعطيله",
  },
  {
    id: "salary",
    featureId: "salary",
    title: "حاسبة المعاش",
    route: "/salary",
    previewAction: "route",
    previewPayload: "/salary",
    visibleSurfaces: ["home", "services", "drawer"],
    routeGated: true,
    status: "ok",
    warnings: [],
  },
  {
    id: "forms",
    featureId: "forms",
    title: "النماذج الرسمية",
    route: "/forms",
    previewAction: "route",
    previewPayload: "/forms",
    visibleSurfaces: ["home", "services", "drawer"],
    routeGated: true,
    status: "warning",
    warnings: ["لا يوجد تحميل PDF حقيقي — يعتمد على المعاينة والطباعة فقط"],
    notes: "المصادر: تقاعد، منحة، جيش لبناني (LAF)",
  },
  {
    id: "procedures",
    featureId: "procedures",
    title: "المعاملات",
    route: "/procedures",
    previewAction: "route",
    previewPayload: "/procedures",
    visibleSurfaces: ["services", "drawer"],
    routeGated: true,
    status: "warning",
    warnings: ["بعض المعاملات قد تفتقر إلى نماذج أو مرفقات مرتبطة"],
  },
  {
    id: "jobs",
    featureId: "jobs",
    title: "الوظائف",
    route: "/jobs",
    previewAction: "route",
    previewPayload: "/jobs",
    visibleSurfaces: ["services", "drawer"],
    routeGated: true,
    status: "ok",
    warnings: [],
    notes: "المعرّف الداخلي هو «jobs» لقسم الوظائف المدنية وفرص المحاربين، بينما التطويع في /services/recruitment.",
  },
  {
    id: "marketplace",
    featureId: "marketplace",
    title: "السوق المجتمعي",
    route: "/marketplace",
    previewAction: "route",
    previewPayload: "/marketplace",
    visibleSurfaces: ["services", "drawer"],
    routeGated: true,
    status: "warning",
    warnings: ["لا توجد أدوات إشراف أو إدارة إعلانات السوق في لوحة الإدارة"],
  },
  {
    id: "faq",
    featureId: "ticker_faq",
    title: "الأسئلة الشائعة",
    route: "/faq",
    previewAction: "route",
    previewPayload: "/faq",
    visibleSurfaces: ["services", "drawer"],
    routeGated: true,
    status: "ok",
    warnings: [],
    notes: "تمت المراجعة في Wave 5 — 12 فئة مخصصة للمتقاعدين، نظام الموظفين غير مرئي",
  },
  {
    id: "directory",
    title: "الدليل (أرقام وجهات)",
    previewAction: "event",
    previewPayload: "watany-open-directory",
    visibleSurfaces: ["services", "drawer"],
    routeGated: false,
    status: "ok",
    warnings: [],
    notes: "يُفتح كـ Sheet عبر حدث — لا مسار URL مستقل. الفئات: مستشفيات، طوارئ، جهات رسمية، طبابة عسكرية، مصارف، مراجعة",
  },
  {
    id: "search",
    featureId: "search",
    title: "البحث في قاعدة المعرفة",
    route: "/search",
    previewAction: "route",
    previewPayload: "/search",
    visibleSurfaces: ["services", "drawer"],
    routeGated: true,
    status: "ok",
    warnings: [],
  },
  {
    id: "cases",
    featureId: "cases",
    title: "معاملاتي (القضايا)",
    route: "/cases",
    previewAction: "route",
    previewPayload: "/cases",
    visibleSurfaces: ["home", "services", "drawer"],
    routeGated: true,
    status: "ok",
    warnings: [],
  },
  {
    id: "alerts",
    featureId: "alerts",
    title: "تنبيهات الطوارئ",
    route: "/alerts",
    previewAction: "route",
    previewPayload: "/alerts",
    visibleSurfaces: ["services", "drawer"],
    routeGated: true,
    status: "ok",
    warnings: [],
  },
  {
    id: "notifications",
    featureId: "notifications",
    title: "الإشعارات",
    route: "/notifications",
    previewAction: "route",
    previewPayload: "/notifications",
    visibleSurfaces: [],
    routeGated: true,
    status: "warning",
    warnings: ["لا تظهر في سلة الخدمات أو الدرج — يُصل إليها فقط عبر زر TopMenu"],
    notes: "الإشعارات مرئية كزر في TopMenu فقط",
  },
  {
    id: "profile",
    featureId: "profile",
    title: "الملف الشخصي",
    route: "/profile",
    previewAction: "route",
    previewPayload: "/profile",
    visibleSurfaces: ["bottomnav"],
    routeGated: true,
    status: "ok",
    warnings: [],
  },
  {
    id: "community",
    title: "المجتمع",
    route: "/community",
    previewAction: "route",
    previewPayload: "/community",
    visibleSurfaces: ["drawer", "bottomnav"],
    routeGated: false,
    status: "ok",
    warnings: [],
    notes: "متاح دائماً كتبويب في الشريط السفلي",
  },
];
