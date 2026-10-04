import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { defaultLocale, dirForLocale } from "@watany/i18n";
import { ErrorBoundary } from "./ErrorBoundary";
import { useAdminWS } from "./hooks/useAdminWS";
import AdminLoginPage from "./pages/AdminLoginPage";
import { getApiUrl, SERVERS, logoutAdmin } from "./lib/api";
import { AdminFluentIcon } from "./components/AdminFluentIcon";


import AdminMarketPage from "./pages/AdminMarketPage";
import AdminKBStudioPage from "./pages/AdminKBStudioPage";
import AdminDocumentsPage from "./pages/AdminDocumentsPage";
import AdminProceduresPage from "./pages/AdminProceduresPage";
import AdminCommandCenterPage from "./pages/AdminCommandCenterPage";
import SuperadminShellPage from "./pages/SuperadminShellPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import UserPage from "./pages/UserPage";
const ChatMonitorPage = lazy(() => import("./pages/ChatMonitorPage"));
const RulesPage = lazy(() => import("./pages/RulesPage"));
import AuditPage from "./pages/AuditPage";
const KBEditorPage = lazy(() => import("./pages/KBEditorPage"));
import FeatureControlsPage from "./pages/FeatureControlsPage";
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

const NAV_SECTIONS = [
  { id: "overview", label: "الرئيسية", items: [
    { path: "/", label: "لوحة الإدارة", icon: "dashboard" },
    { path: "/admin/command-center", label: "مركز العمليات", icon: "briefcase" },
  ] },
  { id: "cms", label: "المحتوى", items: [
    { path: "/admin/procedures", label: "إدارة المحتوى", icon: "folder" },
    { path: "/admin/documents", label: "المستندات", icon: "document" },
    { path: "/kb", label: "قاعدة المعرفة", icon: "knowledge" },
    { path: "/news", label: "الأخبار", icon: "news" },
    { path: "/superadmin/cms/articles", label: "المقالات", icon: "news" },
  ] },
  { id: "operations", label: "العمليات", items: [
    { path: "/jobs", label: "الوظائف والطلبات", icon: "briefcase" },
    { path: "/forms", label: "منشئ النماذج", icon: "document" },
    { path: "/market", label: "السوق", icon: "apps" },
    { path: "/network", label: "الشبكة", icon: "location" },
    { path: "/chat", label: "مراقبة المحادثة", icon: "chat" },
  ] },
  { id: "users", label: "المستخدمون", items: [
    { path: "/users", label: "إدارة المستخدمين", icon: "users" },
    { path: "/superadmin/roles-permissions", label: "الأدوار والصلاحيات", icon: "shield" },
    { path: "/superadmin/sessions", label: "الجلسات", icon: "shield" },
    { path: "/superadmin/administrators", label: "المسؤولون", icon: "users" },
    { path: "/audit", label: "سجل التدقيق", icon: "audit" },
  ] },
  { id: "crm", label: "CRM", items: [
    { path: "/superadmin/crm", label: "نظرة CRM", icon: "users" },
    { path: "/superadmin/crm/contacts", label: "جهات الاتصال", icon: "users" },
  ] },
  { id: "erm", label: "ERM", items: [
    { path: "/superadmin/erm", label: "نظرة ERM", icon: "briefcase" },
    { path: "/superadmin/erm/assets", label: "الأصول", icon: "documents" },
  ] },
  { id: "system", label: "النظام", items: [
    { path: "/features", label: "التحكم بالميزات", icon: "settings" },
    { path: "/system/ticker", label: "إعدادات الشريط الإخباري", icon: "news" },
    { path: "/superadmin/system/integrations", label: "التكاملات", icon: "network" },
    { path: "/superadmin/system/health", label: "صحة النظام", icon: "settings" },
    { path: "/superadmin/approvals", label: "مركز الموافقات", icon: "audit" },
    { path: "/superadmin/authority-audit", label: "تدقيق الصلاحيات", icon: "audit" },
  ] },
];

function navItemMatches(pathname: string, itemPath: string): boolean {
  if (itemPath === "/") return pathname === "/";
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function SidebarNavigation({ onNavigate }: Readonly<{ onNavigate: () => void }>) {
  const location = useLocation();
  const activeSectionId = NAV_SECTIONS.find((section) => section.items.some((item) => navItemMatches(location.pathname, item.path)))?.id ?? "overview";
  const [openSectionId, setOpenSectionId] = useState<string | null>(activeSectionId);
  useEffect(() => { setOpenSectionId(activeSectionId); }, [activeSectionId]);
  return <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
    {NAV_SECTIONS.map((section) => {
      const expanded = openSectionId === section.id;
      return <div className="nav-section" key={section.id}>
        <button className="nav-section-title" aria-expanded={expanded} onClick={() => setOpenSectionId((current) => current === section.id ? null : section.id)}>
          <span>{section.label}</span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
        {expanded && section.items.map((item) => <NavLink key={item.path} to={item.path} end={item.path === "/"} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <span className="nav-icon"><AdminFluentIcon name={item.icon} /></span><span className="nav-label">{item.label}</span>
        </NavLink>)}
      </div>;
    })}
  </nav>;
}

const ROUTE_META: Record<string, { title: string; section: string }> = {
  "/": { title: "لوحة الإدارة", section: "الرئيسية" }, "/users": { title: "المستخدمون", section: "النظام" },
  "/jobs/ainelhafeh": { title: "طلبات قطاف التفاح", section: "العمليات" },
  "/jobs/ain-mreisseh-building-assistant": { title: "طلبات عين المريسة", section: "العمليات" },
  "/jobs/middle-east-security": { title: "طلبات الأمن والحماية", section: "العمليات" },
  "/news": { title: "الأخبار", section: "المحتوى والمعرفة" }, "/jobs": { title: "الوظائف والطلبات", section: "العمليات" },
  "/forms": { title: "منشئ النماذج", section: "العمليات" },
  "/market": { title: "السوق", section: "العمليات" }, "/chat": { title: "مراقبة المحادثة", section: "العمليات" },
  "/kb": { title: "قاعدة المعرفة", section: "المحتوى والمعرفة" }, "/rules": { title: "قواعد المحتوى", section: "المحتوى والمعرفة" },
  "/audit": { title: "سجل التدقيق", section: "النظام" }, "/features": { title: "التحكم بالميزات", section: "النظام" },
  "/system/ticker": { title: "إعدادات الشريط الإخباري", section: "النظام" },
  "/network": { title: "الشبكة", section: "العمليات" },
  "/admin/command-center": { title: "مركز العمليات", section: "نظرة عامة" },
  "/admin/procedures": { title: "إدارة الإجراءات", section: "المحتوى" },
  "/admin/documents": { title: "المستندات", section: "المحتوى" },
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
  "/superadmin/cms/articles": { title: "المقالات", section: "المحتوى والمعرفة" },
  "/superadmin/cms/articles/archive": { title: "أرشيف المقالات", section: "المحتوى والمعرفة" },
  "/superadmin/system/official-services": { title: "الخدمات الرسمية", section: "المحتوى والمعرفة" },
  "/superadmin/system/ticker": { title: "عناصر الشريط الإخباري", section: "المحتوى والمعرفة" },
  "/superadmin/crm": { title: "نظرة CRM", section: "CRM" },
  "/superadmin/crm/contacts": { title: "جهات اتصال CRM", section: "CRM" },
  "/superadmin/erm": { title: "نظرة ERM", section: "ERM" },
  "/superadmin/erm/assets": { title: "أصول ERM", section: "ERM" },
  "/superadmin/administrators": { title: "المسؤولون", section: "النظام والحوكمة" },
  "/superadmin/sessions": { title: "الجلسات", section: "النظام والحوكمة" },
  "/superadmin/roles-permissions": { title: "الأدوار والصلاحيات", section: "النظام والحوكمة" },
  "/superadmin/approvals": { title: "مركز الموافقات", section: "النظام والحوكمة" },
  "/superadmin/system/health": { title: "صحة الوحدات", section: "النظام والحوكمة" },
  "/superadmin/system/integrations": { title: "التكاملات", section: "النظام والحوكمة" },
  "/superadmin/authority-audit": { title: "تدقيق الصلاحيات", section: "النظام والحوكمة" },
};

function Loading() {
  return <div className="page-loading">Loading...</div>;
}

const routerBasename =
  import.meta.env.BASE_URL === "/"
    ? "/"
    : import.meta.env.BASE_URL.replace(/\/+$/, "");
export default function App() {
  const dir = dirForLocale(defaultLocale);
  const [token, setToken] = useState(() => localStorage.getItem("admin_token"));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("admin_sidebar_collapsed") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);
  const isAuthenticated = Boolean(token);
  const { connected, messages } = useAdminWS(token);

  const handleLogin = useCallback(() => {
    setToken(localStorage.getItem("admin_token"));
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutAdmin();
    // Do NOT clear admin_api_url — keep server selection for next login
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

              <SidebarNavigation onNavigate={() => setMobileOpen(false)} />

              <div className="sidebar-footer">
                <div
                  title={activeUrl}
                  style={{ fontSize: 11, color: "#475569", marginBottom: 6, padding: "4px 8px",
                    background: "#0f172a", borderRadius: 6, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  🌐 {serverLabel}
                </div>
                <div className={`ws-status ${connected ? "connected" : "disconnected"}`}>
                  <span className="ws-dot" />
                  {connected ? "متصل" : "غير متصل"}
                </div>
                {messages.length > 0 && (
                  <div className="ws-count">{messages.length} events</div>
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
                    <Route path="/school-grants" element={<RedirectToWebUser />} />
                    <Route path="/school-aids/*" element={<RedirectToWebUser />} />
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/admin" element={<DashboardPage />} />
                    <Route path="/admin/command-center" element={<AdminCommandCenterPage />} />
                    <Route path="/admin/kb-studio" element={<AdminKBStudioPage />} />
                    <Route path="/admin/documents" element={<AdminDocumentsPage />} />
                    <Route path="/admin/procedures" element={<AdminProceduresPage />} />
                    <Route path="/features" element={<FeatureControlsPage />} />
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
    : ROUTE_META[location.pathname] ?? { title: "Superadmin", section: "Superadmin" };
  return <div className="page-context"><div className="breadcrumbs"><span>موطني Ops</span><span aria-hidden="true">/</span><span>{meta.section}</span><span aria-hidden="true">/</span><span aria-current="page">{meta.title}</span></div><h1>{meta.title}</h1></div>;
}

