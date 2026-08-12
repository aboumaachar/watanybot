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
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ChatMonitorPage = lazy(() => import("./pages/ChatMonitorPage"));
const RulesPage = lazy(() => import("./pages/RulesPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const KBEditorPage = lazy(() => import("./pages/KBEditorPage"));
const FeatureControlsPage = lazy(() => import("./pages/FeatureControlsPage"));
const NewsAdminPage = lazy(() => import("./pages/NewsAdminPage"));
const JobsAdminPage = lazy(() => import("./pages/JobsAdminPage"));

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

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "dashboard" },
  { path: "/features", label: "Feature Controls", icon: "settings" },
  { path: "/users", label: "Users", icon: "users" },
  { path: "/chat", label: "Chat Monitor", icon: "chat" },
  { path: "/rules", label: "Content Rules", icon: "shield" },
  { path: "/audit", label: "Audit Log", icon: "audit" },
  { path: "/kb", label: "KB Editor", icon: "knowledge" },
  { path: "/news", label: "News", icon: "news" },
  { path: "/jobs", label: "Jobs & Applications", icon: "briefcase" },
];

function Loading() {
  return <div className="page-loading">Loading...</div>;
}

export default function App() {
  const dir = dirForLocale(defaultLocale);
  const [token, setToken] = useState(() => localStorage.getItem("admin_token"));
  const isAuthenticated = Boolean(token);
  const { connected, messages } = useAdminWS(token);

  const handleLogin = useCallback(() => {
    setToken(localStorage.getItem("admin_token"));
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutAdmin();
    // Do NOT clear admin_api_url â€” keep server selection for next login
    setToken(null);
  }, []);

  const activeUrl = getApiUrl();
  const serverLabel = SERVERS.find(s => s.url === activeUrl)?.label ?? "Custom";

  return (
    <ErrorBoundary>
      <BrowserRouter>
        {isAuthenticated ? (
          <div className="admin-app" dir={dir}>
            {/* Sidebar */}
            <aside className="admin-sidebar">
              <div className="sidebar-brand">
                <div className="brand-icon">W</div>
                <div className="brand-text">
                  <div className="brand-title">Watany Ops</div>
                  <div className="brand-sub">Control Room</div>
                </div>
              </div>

              <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""}`
                    }
                  >
                    <span className="nav-icon"><AdminFluentIcon name={item.icon} /></span>
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                ))}
              </nav>

              <div className="sidebar-footer">
                <div
                  title={activeUrl}
                  style={{ fontSize: 11, color: "#475569", marginBottom: 6, padding: "4px 8px",
                    background: "#0f172a", borderRadius: 6, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  ðŸŒ {serverLabel}
                </div>
                <div className={`ws-status ${connected ? "connected" : "disconnected"}`}>
                  <span className="ws-dot" />
                  {connected ? "Live" : "Offline"}
                </div>
                {messages.length > 0 && (
                  <div className="ws-count">{messages.length} events</div>
                )}
                <button className="ghost" onClick={handleLogout} style={{ marginTop: 8, fontSize: 12, width: "100%" }}>
                  Sign Out
                </button>
              </div>
            </aside>

            {/* Main content */}
            <main className="admin-main">
              <header className="admin-topbar">
                <div>
                  <div className="eyebrow">Watany Ops</div>
                  <p className="subtle">Unified view of runtime health, queues, and knowledge.</p>
                </div>
                <div className="top-actions">
                  <button className="ghost">Create Incident</button>
                  <button className="ghost">Sync KB</button>
                  <button className="accent">Export Report</button>
                </div>
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
                    <Route path="/jobs" element={<JobsAdminPage />} />
                    <Route path="/market" element={<AdminMarketPage />} />
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

