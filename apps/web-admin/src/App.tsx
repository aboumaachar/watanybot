import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { defaultLocale, dirForLocale } from "@watany/i18n";
import { ErrorBoundary } from "./ErrorBoundary";
import { useAdminWS } from "./hooks/useAdminWS";
import AdminLoginPage from "./pages/AdminLoginPage";
import { adminFetch, getAdminProfile, getApiUrl, hasAdminCapability, SERVERS, logoutAdmin, type AdminSession } from "./lib/api";
import { AdminFluentIcon } from "./components/AdminFluentIcon";
import { DASHBOARD_MODULES } from "./dashboardModuleRegistry";


import AdminMarketPage from "./pages/AdminMarketPage";
import AdminKBStudioPage from "./pages/AdminKBStudioPage";
import AdminDocumentsPage from "./pages/AdminDocumentsPage";
import CmsPage from "./pages/CmsPage";
import AdminCommandCenterPage from "./pages/AdminCommandCenterPage";
import SuperadminShellPage from "./pages/SuperadminShellPage";
import AdminSalaryPage from "./pages/AdminSalaryPage";
import AdminSchoolGrantsPage from "./pages/AdminSchoolGrantsPage";
import AdminCrmPage from "./pages/AdminCrmPage";
import AdminDiagnosticsPage from "./pages/AdminDiagnosticsPage";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";
import AdminErmPage from "./pages/AdminErmPage";
import AdminAdsPage from "./pages/AdminAdsPage";
import AdminPluginsPage from "./pages/AdminPluginsPage";
import ContentStudioPage from "./pages/ContentStudioPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import UserPage from "./pages/UserPage";
import AuditPage from "./pages/AuditPage";
const ChatMonitorPage = lazy(() => import("./pages/ChatMonitorPage"));
const RulesPage = lazy(() => import("./pages/RulesPage"));
const KBEditorPage = lazy(() => import("./pages/KBEditorPage"));
const NewsAdminPage = lazy(() => import("./pages/NewsAdminPage"));
const NetworkAdminPage = lazy(() => import("./pages/NetworkAdminPage"));
const JobsAdminPage = lazy(() => import("./pages/JobsAdminPage"));
const UniversalFormsAdminPage = lazy(() => import("./pages/UniversalFormsAdminPage"));
const AinMreissehApplicationsAdminPage = lazy(() => import("./pages/AinMreissehApplicationsAdminPage"));
const MiddleEastSecurityApplicationsAdminPage = lazy(() => import("./pages/MiddleEastSecurityApplicationsAdminPage"));
const Veterans2019ApplicationsAdminPage = lazy(() => import("./pages/Veterans2019ApplicationsAdminPage"));
const SeasonalAppleApplicationsAdminPage = lazy(() => import("./pages/SeasonalAppleApplicationsAdminPage"));

function RedirectToWebUser() {
  const location = useLocation();

  useEffect(() => {
    const targetOrigin = (import.meta.env.VITE_WEB_USER_ORIGIN as string | undefined) || "http://127.0.0.1:5174";
    const hash = location.hash || "";
    const target = `${targetOrigin}${location.pathname}${location.search}${hash}`;
    globalThis.location.replace(target);
  }, [location]);

  return <div className="page-loading">Redirecting...</div>;
}

type NavItem = { path: string; label: string; icon: string; capability: string; action?: string; section?: string };

function sectionForCategory(category: string): string {
  if (category === "CONTENT") return "cms";
  if (category === "SYSTEM") return "system";
  return "operations";
}

const REGISTERED_NAV_ITEMS: NavItem[] = DASHBOARD_MODULES.filter((module) => module.status === "ACTIVE").map((module) => ({
  path: module.route,
  label: module.labelAr,
  icon: module.icon,
  capability: module.requiredCapability,
  section: sectionForCategory(module.category),
}));

const pickRegistered = (...paths: string[]) => REGISTERED_NAV_ITEMS.filter((item) => paths.includes(item.path));

const NAV_SECTIONS: Array<{ id: string; label: string; items: NavItem[] }> = [
  { id: "overview", label: "الرئيسية", items: [{ path: "/", label: "لوحة الإدارة", icon: "dashboard", capability: "admin.dashboard" }, { path: "/admin/command-center", label: "مركز العمليات", icon: "briefcase", capability: "admin.dashboard" }] },
  { id: "cms", label: "المحتوى", items: [...pickRegistered("/admin/procedures", "/kb", "/admin/documents", "/news"), { path: "/content-studio", label: "استوديو المحتوى", icon: "document", capability: "cms.read" }, { path: "/rules", label: "قواعد المحتوى", icon: "shield", capability: "admin.rules" }, { path: "/superadmin/cms/articles", label: "المقالات والأرشيف", icon: "document", capability: "cms.read" }] },
  { id: "operations", label: "العمليات", items: [...pickRegistered("/jobs", "/market", "/salary", "/school-grants", "/ads"), { path: "/forms", label: "منشئ النماذج", icon: "document", capability: "admin.dashboard" }, { path: "/chat", label: "مراقبة المحادثة", icon: "chat", capability: "admin.dashboard" }, { path: "/network", label: "الشبكة", icon: "location", capability: "admin.dashboard" }] },
  { id: "users", label: "المستخدمون", items: [{ path: "/users", label: "إدارة المستخدمين", icon: "users", capability: "admin.users" }, { path: "/roles-permissions", label: "الأدوار والصلاحيات", icon: "shield", capability: "admin.users" }, { path: "/sessions", label: "الجلسات", icon: "shield", capability: "admin.users" }, { path: "/administrators", label: "المسؤولون", icon: "users", capability: "admin.users" }, { path: "/audit", label: "سجل التدقيق", icon: "audit", capability: "superadmin.audit.read" }] },
  { id: "crm", label: "CRM", items: [...pickRegistered("/crm")] },
  { id: "erm", label: "ERM", items: [...pickRegistered("/erm")] },
  { id: "system", label: "النظام", items: [...pickRegistered("/system/health", "/system/integrations", "/features", "/analytics", "/diagnostics"), { path: "/system/ticker", label: "إعدادات الشريط الإخباري", icon: "news", capability: "admin.dashboard" }, { path: "/approvals", label: "مركز الموافقات", icon: "audit", capability: "admin.users" }, { path: "/authority-audit", label: "تدقيق الصلاحيات", icon: "audit", capability: "admin.users" }] },
];

function navItemMatches(pathname: string, itemPath: string): boolean {
  if (itemPath === "/") return pathname === "/";
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function SidebarNavigation({ adminSession, onNavigate }: Readonly<{ adminSession: AdminSession | null; onNavigate: () => void }>) {
  const location = useLocation();
  const activeSectionId = NAV_SECTIONS.find((section) => section.items.some((item) => navItemMatches(location.pathname, item.path)))?.id ?? "overview";
  const [openSectionId, setOpenSectionId] = useState<string | null>(activeSectionId);
  useEffect(() => { setOpenSectionId(activeSectionId); }, [activeSectionId]);
  return <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
    {NAV_SECTIONS.map((section) => {
      const expanded = openSectionId === section.id;
      const visibleItems = section.items.filter((item) => Boolean(adminSession) && hasAdminCapability(adminSession, item.capability));
      return <div className="nav-section" key={section.id}>
        <button className="nav-section-title" aria-expanded={expanded} onClick={() => setOpenSectionId((current) => current === section.id ? null : section.id)}>
          <span>{section.label}</span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
        {expanded && visibleItems.map((item) => <NavLink key={item.path} to={item.path} end={item.path === "/"} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <span className="nav-icon"><AdminFluentIcon name={item.icon} /></span><span className="nav-label">{item.label}</span>
        </NavLink>)}
      </div>;
    })}
  </nav>;
}

function getUiCapabilitiesForRole(role: string): string[] {
  if (role !== "admin" && role !== "superadmin") return [];
  const capabilities = new Set<string>();
  NAV_SECTIONS.flatMap((section) => section.items).forEach((item) => {
    if (role === "superadmin" || !item.capability.startsWith("superadmin.")) capabilities.add(item.capability);
  });
  return [...capabilities];
}

const ROUTE_META: Record<string, { title: string; section: string }> = {
  "/": { title: "لوحة الإدارة", section: "الرئيسية" },
  "/admin": { title: "لوحة الإدارة", section: "الرئيسية" },
  "/admin/command-center": { title: "مركز القيادة", section: "نظرة عامة" },
  "/users": { title: "المستخدمون", section: "المستخدمون" },
  "/jobs/ainelhafeh": { title: "طلبات قطاف التفاح", section: "العمليات" },
  "/jobs/ain-mreisseh-building-assistant": { title: "طلبات عين المريسة", section: "العمليات" },
  "/jobs/middle-east-security": { title: "طلبات الأمن والحماية", section: "العمليات" },
  "/news": { title: "الأخبار", section: "المحتوى والمعرفة" },
  "/jobs": { title: "الوظائف والطلبات", section: "العمليات" },
  "/forms": { title: "منشئ النماذج", section: "العمليات" },
  "/market": { title: "السوق", section: "العمليات" },
  "/chat": { title: "مراقبة المحادثة", section: "العمليات" },
  "/kb": { title: "قاعدة المعرفة", section: "المحتوى والمعرفة" },
  "/rules": { title: "قواعد المحتوى", section: "المحتوى والمعرفة" },
  "/audit": { title: "سجل التدقيق", section: "النظام" },
  "/features": { title: "التحكم بالميزات", section: "النظام" },
  "/system/ticker": { title: "إعدادات الشريط الإخباري", section: "النظام" },
  "/network": { title: "الشبكة", section: "العمليات" },
  "/salary": { title: "الراتب", section: "العمليات" },
  "/school-grants": { title: "المنح المدرسية", section: "العمليات" },
  "/crm": { title: "إدارة العملاء", section: "العمليات" },
  "/erm": { title: "إدارة الموارد", section: "العمليات" },
  "/ads": { title: "إدارة الإعلانات", section: "العمليات" },
  "/analytics": { title: "التحليلات", section: "النظام" },
  "/diagnostics": { title: "التشخيص", section: "النظام" },
  "/admin/kb-studio": { title: "استوديو المعرفة", section: "المحتوى والمعرفة" },
  "/admin/documents": { title: "المستندات", section: "المحتوى والمعرفة" },
  "/admin/procedures": { title: "إدارة الإجراءات", section: "المحتوى والمعرفة" },
  "/content-studio": { title: "استوديو المحتوى", section: "المحتوى والمعرفة" },
  "/superadmin": { title: "Superadmin", section: "نظرة عامة" },
  "/superadmin/operations": { title: "نظرة العمليات", section: "العمليات" },
  "/superadmin/system": { title: "نظرة النظام", section: "النظام والحوكمة" },
  "/superadmin/features": { title: "ميزات الإدارة العليا", section: "النظام والحوكمة" },
  "/superadmin/system/features": { title: "ميزات النظام", section: "النظام والحوكمة" },
  "/superadmin/audit": { title: "تدقيق الإدارة العليا", section: "النظام والحوكمة" },
  "/superadmin/cms": { title: "مساحة CMS", section: "المحتوى والمعرفة" },
  "/superadmin/cms/community": { title: "المجتمع", section: "المحتوى والمعرفة" },
  "/superadmin/cms/ai-training": { title: "تدريب الذكاء الاصطناعي", section: "المحتوى والمعرفة" },
  "/superadmin/cms/abusive-events": { title: "الأحداث المسيئة", section: "المحتوى والمعرفة" },
  "/superadmin/cms/chat-inputs": { title: "مدخلات المحادثة", section: "المحتوى والمعرفة" },
  "/superadmin/cms/answer-overrides": { title: "بدائل الإجابات", section: "المحتوى والمعرفة" },
  "/superadmin/cms/chat-sessions": { title: "جلسات المحادثة", section: "المحتوى والمعرفة" },
  "/superadmin/cms/rules": { title: "قواعد التصفية", section: "المحتوى والمعرفة" },
  "/superadmin/cms/news": { title: "أخبار CMS", section: "المحتوى والمعرفة" },
  "/superadmin/cms/articles": { title: "المقالات والأرشيف", section: "المحتوى والمعرفة" },
  "/superadmin/cms/articles/archive": { title: "أرشيف المقالات", section: "المحتوى والمعرفة" },
  "/superadmin/system/official-services": { title: "الخدمات الرسمية", section: "المحتوى والمعرفة" },
  "/superadmin/system/ticker": { title: "عناصر الشريط الإخباري", section: "المحتوى والمعرفة" },
  "/superadmin/crm": { title: "نظرة CRM", section: "CRM" },
  "/superadmin/crm/contacts": { title: "جهات اتصال CRM", section: "CRM" },
  "/superadmin/erm": { title: "نظرة ERM", section: "ERM" },
  "/superadmin/erm/assets": { title: "أصول ERM", section: "ERM" },
  "/system/health": { title: "صحة النظام", section: "النظام" },
  "/system/integrations": { title: "التكاملات", section: "النظام" },
  "/administrators": { title: "المسؤولون", section: "النظام" },
  "/sessions": { title: "الجلسات", section: "النظام" },
  "/roles-permissions": { title: "الأدوار والصلاحيات", section: "النظام" },
  "/approvals": { title: "مركز الموافقات", section: "النظام" },
  "/authority-audit": { title: "تدقيق الصلاحيات", section: "النظام" },
  "/superadmin/administrators": { title: "المسؤولون", section: "النظام والحوكمة" },
  "/superadmin/sessions": { title: "الجلسات", section: "النظام والحوكمة" },
  "/superadmin/roles-permissions": { title: "الأدوار والصلاحيات", section: "النظام والحوكمة" },
  "/superadmin/approvals": { title: "مركز الموافقات", section: "النظام والحوكمة" },
  "/superadmin/system/health": { title: "صحة الوحدات", section: "النظام والحوكمة" },
  "/superadmin/system/integrations": { title: "التكاملات", section: "النظام والحوكمة" },
  "/superadmin/authority-audit": { title: "تدقيق الصلاحيات", section: "النظام والحوكمة" },
};

function Loading() {
  return <div className="page-loading">جارٍ التحميل...</div>;
}

const routerBasename =
  import.meta.env.BASE_URL === "/"
    ? "/"
    : import.meta.env.BASE_URL.replace(/\/+$/, "");

export default function App() {
  const dir = dirForLocale(defaultLocale);
  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);
  const [token, setToken] = useState(() => localStorage.getItem("admin_token"));
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("admin_sidebar_collapsed") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [gatewayHealthy, setGatewayHealthy] = useState<boolean | null>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);
  useEffect(() => {
    if (!token) {
      setAdminSession(null);
      return;
    }

    let active = true;
    void getAdminProfile()
      .then((profile) => {
        if (active) {
          setAdminSession({
            authenticated: true,
            actorId: profile.id,
            roles: [profile.role],
            capabilities: getUiCapabilitiesForRole(profile.role),
          });
        }
      })
      .catch(() => {
        if (active) setAdminSession(null);
      });

    return () => { active = false; };
  }, [token]);
  const isAuthenticated = Boolean(token);
  const { connected, messages } = useAdminWS(token);
  useEffect(() => {
    if (!token) return;
    let active = true;
    void adminFetch("/api/admin/overview").then((response) => response.json()).then((data: { gateway?: { status?: string } }) => {
      if (active) setGatewayHealthy(data.gateway?.status === "ok");
    }).catch(() => { if (active) setGatewayHealthy(false); });
    return () => { active = false; };
  }, [token]);

  const handleLogin = useCallback(() => {
    setToken(localStorage.getItem("admin_token"));
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutAdmin();
    setToken(null);
  }, []);

  const activeUrl = getApiUrl();
  const serverLabel = SERVERS.find(s => s.url === activeUrl)?.label === "Production (koudama.com)" ? "الإنتاج (koudama.com)" : "محلي";

  return (
    <ErrorBoundary>
      <BrowserRouter basename={routerBasename}>
        {isAuthenticated ? (
          <div className={`admin-app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} dir={dir}>
            {/* Sidebar */}
            {mobileOpen && <button aria-label="إغلاق التنقل" className="drawer-backdrop" onClick={() => setMobileOpen(false)} />}
            <aside className={`admin-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
              <div className="sidebar-brand">
                <div className="brand-icon">W</div>
                <div className="brand-text">
                  <div className="brand-title">موطني Ops</div>
                  <div className="brand-sub">غرفة الإدارة</div>
                </div>
              </div>

              <SidebarNavigation adminSession={adminSession} onNavigate={() => setMobileOpen(false)} />

              <div className="sidebar-footer">
                <div
                  title={activeUrl}
                  style={{ fontSize: 11, color: "#475569", marginBottom: 6, padding: "4px 8px",
                    background: "#0f172a", borderRadius: 6, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  🌐 {serverLabel}
                </div>
                <div className={`ws-status ${gatewayHealthy === true ? "connected" : gatewayHealthy === false ? "disconnected" : "pending"}`}>
                  <span className="ws-dot" />
                  {gatewayHealthy === true ? "البوابة سليمة" : gatewayHealthy === false ? "البوابة غير متاحة" : connected ? "جارٍ التحقق من البوابة" : "البوابة غير متاحة"}
                </div>
                {messages.length > 0 && (
                  <div className="ws-count">{messages.length} أحداث</div>
                )}
                <button type="button" className="ghost" onClick={handleLogout} style={{ marginTop: 8, fontSize: 12, width: "100%" }}>
                  تسجيل الخروج
                </button>
              </div>
            </aside>

            {/* Main content */}
            <main className="admin-main">
              <header className="admin-topbar">
                <button type="button" className="menu-toggle" aria-label="فتح التنقل" onClick={() => setMobileOpen(true)}>☰</button>
                <button type="button" className="collapse-toggle" aria-label={sidebarCollapsed ? "توسيع التنقل" : "طي التنقل"} onClick={() => { const next = !sidebarCollapsed; setSidebarCollapsed(next); localStorage.setItem("admin_sidebar_collapsed", String(next)); }}>‹</button>
                <RouteContext />
              </header>

              <section className="admin-content grid">
                <Suspense fallback={<Loading />}>
                  <Routes>
                    <Route path="/school-aids/*" element={<RedirectToWebUser />} />
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/admin" element={<DashboardPage />} />
                    <Route path="/admin/command-center" element={<AdminCommandCenterPage />} />
                    <Route path="/admin/kb-studio" element={<AdminKBStudioPage />} />
                    <Route path="/admin/documents" element={<AdminDocumentsPage />} />
                    <Route path="/admin/procedures" element={<CmsPage />} />
                    <Route path="/content-studio" element={<ContentStudioPage />} />
                    <Route path="/salary" element={<AdminSalaryPage />} />
                    <Route path="/school-grants" element={<AdminSchoolGrantsPage />} />
                    <Route path="/crm" element={<AdminCrmPage />} />
                    <Route path="/diagnostics" element={<AdminDiagnosticsPage />} />
                    <Route path="/analytics" element={<AdminAnalyticsPage />} />
                    <Route path="/erm" element={<AdminErmPage />} />
                    <Route path="/ads" element={<AdminAdsPage />} />
                    <Route path="/features" element={<AdminPluginsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/users/:id" element={<UserPage />} />
                    <Route path="/chat" element={<ChatMonitorPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="/kb" element={<KBEditorPage />} />
                    <Route path="/news" element={<NewsAdminPage />} />
                    <Route path="/network" element={<NetworkAdminPage />} />
                    <Route path="/jobs" element={<JobsAdminPage />} />
                    <Route path="/forms" element={<UniversalFormsAdminPage />} />
                    <Route path="/jobs/ainelhafeh" element={<SeasonalAppleApplicationsAdminPage />} />
                    <Route path="/jobs/ain-mreisseh-building-assistant" element={<AinMreissehApplicationsAdminPage />} />
                    <Route path="/jobs/middle-east-security" element={<MiddleEastSecurityApplicationsAdminPage />} />
                    <Route path="/veterans-2019-applications" element={<Veterans2019ApplicationsAdminPage />} />
                    <Route path="/market" element={<AdminMarketPage />} />
                    <Route path="/administrators" element={<SuperadminShellPage />} />
                    <Route path="/sessions" element={<SuperadminShellPage />} />
                    <Route path="/roles-permissions" element={<SuperadminShellPage />} />
                    <Route path="/approvals" element={<SuperadminShellPage />} />
                    <Route path="/system/ticker" element={<SuperadminShellPage />} />
                    <Route path="/system/health" element={<SuperadminShellPage />} />
                    <Route path="/system/integrations" element={<SuperadminShellPage />} />
                    <Route path="/authority-audit" element={<SuperadminShellPage />} />
                    <Route path="/superadmin/*" element={<SuperadminShellPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </section>
            </main>
          </div>
        ) : (
          <Routes>
            <Route path="/school-grants" element={<RedirectToWebUser />} />
            <Route path="/school-aids/*" element={<RedirectToWebUser />} />
            <Route path="/market" element={<AdminMarketPage />} />
            <Route path="*" element={<AdminLoginPage onLogin={handleLogin} />} />
          </Routes>
        )}
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function RouteContext() {
  const location = useLocation();
  const meta = location.pathname.startsWith("/users/")
    ? { title: "ملف المستخدم", section: "المستخدمون" }
    : ROUTE_META[location.pathname] ?? { title: "لوحة الإدارة", section: "النظام" };
  return <div className="page-context"><div className="breadcrumbs"><span>موطني Ops</span><span aria-hidden="true">/</span><span>{meta.section}</span><span aria-hidden="true">/</span><span aria-current="page">{meta.title}</span></div><h1>{meta.title}</h1></div>;
}
