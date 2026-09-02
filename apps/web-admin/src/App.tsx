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
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ChatMonitorPage = lazy(() => import("./pages/ChatMonitorPage"));
const RulesPage = lazy(() => import("./pages/RulesPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const KBEditorPage = lazy(() => import("./pages/KBEditorPage"));
const FeatureControlsPage = lazy(() => import("./pages/FeatureControlsPage"));
const NewsAdminPage = lazy(() => import("./pages/NewsAdminPage"));
const NetworkAdminPage = lazy(() => import("./pages/NetworkAdminPage"));
const JobsAdminPage = lazy(() => import("./pages/JobsAdminPage"));
const AinMreissehApplicationsAdminPage = lazy(() => import("./pages/AinMreissehApplicationsAdminPage"));

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
  { id: "overview", label: "Overview", items: [{ path: "/", label: "Dashboard", icon: "dashboard" }] },
  { id: "cms", label: "CMS & Knowledge", items: [
    { path: "/kb", label: "Knowledge Base", icon: "knowledge" },
    { path: "/news", label: "News", icon: "news" },
    { path: "/rules", label: "Content Rules", icon: "shield" },
    { path: "/admin/documents", label: "Documents", icon: "document" },
    { path: "/admin/procedures", label: "Procedures", icon: "folder" },
  ] },
  { id: "operations", label: "Operations", items: [
    { path: "/chat", label: "Chat Monitor", icon: "chat" },
    { path: "/jobs", label: "Jobs & Applications", icon: "briefcase" },
    { path: "/jobs/ain-mreisseh-building-assistant", label: "Ain Mreisseh Applications", icon: "users" },
    { path: "/market", label: "Marketplace", icon: "apps" },
    { path: "/network", label: "Network", icon: "location" },
  ] },
  { id: "system", label: "System", items: [
    { path: "/users", label: "Users", icon: "users" },
    { path: "/features", label: "Feature Controls", icon: "settings" },
    { path: "/audit", label: "Audit Log", icon: "audit" },
  ] },
];

const ROUTE_META: Record<string, { title: string; section: string }> = {
  "/": { title: "Dashboard", section: "Overview" }, "/users": { title: "Users", section: "System" },
  "/jobs/ain-mreisseh-building-assistant": { title: "Ain Mreisseh Applications", section: "Operations" },
  "/news": { title: "News", section: "CMS & Knowledge" }, "/jobs": { title: "Jobs & Applications", section: "Operations" },
  "/market": { title: "Marketplace", section: "Operations" }, "/chat": { title: "Chat Monitor", section: "Operations" },
  "/kb": { title: "Knowledge Base", section: "CMS & Knowledge" }, "/rules": { title: "Content Rules", section: "CMS & Knowledge" },
  "/audit": { title: "Audit Log", section: "System" }, "/features": { title: "Feature Controls", section: "System" },
  "/network": { title: "Network", section: "Operations" },
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ cms: true, operations: true, system: true });
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
  const serverLabel = SERVERS.find(s => s.url === activeUrl)?.label ?? "Custom";

  return (
    <ErrorBoundary>
      <BrowserRouter basename={routerBasename}>
        {isAuthenticated ? (
          <div className={`admin-app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} dir={dir}>
            {/* Sidebar */}
            {mobileOpen && <button aria-label="Close navigation" className="drawer-backdrop" onClick={() => setMobileOpen(false)} />}
            <aside className={`admin-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
              <div className="sidebar-brand">
                <div className="brand-icon">W</div>
                <div className="brand-text">
                  <div className="brand-title">Watany Ops</div>
                  <div className="brand-sub">Control Room</div>
                </div>
              </div>

              <nav className="sidebar-nav" aria-label="Primary navigation">
                {NAV_SECTIONS.map((section) => <div className="nav-section" key={section.id}>
                  <button className="nav-section-title" aria-expanded={openSections[section.id] !== false} onClick={() => setOpenSections((current) => ({ ...current, [section.id]: current[section.id] === false }))}>
                    <span>{section.label}</span><span aria-hidden="true">{openSections[section.id] === false ? "+" : "−"}</span>
                  </button>
                  {openSections[section.id] !== false && section.items.map((item) => <NavLink key={item.path} to={item.path} end={item.path === "/"} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                    <span className="nav-icon"><AdminFluentIcon name={item.icon} /></span><span className="nav-label">{item.label}</span>
                  </NavLink>)}
                </div>)}
              </nav>

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
                  {connected ? "Live" : "Offline"}
                </div>
                {messages.length > 0 && (
                  <div className="ws-count">{messages.length} events</div>
                )}
                <button type="button" className="ghost" onClick={handleLogout} style={{ marginTop: 8, fontSize: 12, width: "100%" }}>
                  Sign Out
                </button>
              </div>
            </aside>

            {/* Main content */}
            <main className="admin-main">
              <header className="admin-topbar">
                <button type="button" className="menu-toggle" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>☰</button>
                <button type="button" className="collapse-toggle" aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => { const next = !sidebarCollapsed; setSidebarCollapsed(next); localStorage.setItem("admin_sidebar_collapsed", String(next)); }}>‹</button>
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
                    <Route path="/chat" element={<ChatMonitorPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="/kb" element={<KBEditorPage />} />
                    <Route path="/news" element={<NewsAdminPage />} />
                    <Route path="/network" element={<NetworkAdminPage />} />
                    <Route path="/jobs" element={<JobsAdminPage />} />
                    <Route path="/jobs/ain-mreisseh-building-assistant" element={<AinMreissehApplicationsAdminPage />} />
                    <Route path="/market" element={<AdminMarketPage />} />
                    <Route path="/administrators" element={<SuperadminShellPage />} />
                    <Route path="/sessions" element={<SuperadminShellPage />} />
                    <Route path="/roles-permissions" element={<SuperadminShellPage />} />
                    <Route path="/approvals" element={<SuperadminShellPage />} />
                    <Route path="/system/health" element={<SuperadminShellPage />} />
                    <Route path="/system/integrations" element={<SuperadminShellPage />} />
                    <Route path="/authority-audit" element={<SuperadminShellPage />} />
                    <Route path="/*" element={<SuperadminShellPage />} />
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
  const meta = ROUTE_META[location.pathname] ?? { title: "Superadmin", section: "Superadmin" };
  return <div className="page-context"><div className="breadcrumbs"><span>Watany Ops</span><span aria-hidden="true">/</span><span>{meta.section}</span><span aria-hidden="true">/</span><span aria-current="page">{meta.title}</span></div><h1>{meta.title}</h1></div>;
}

