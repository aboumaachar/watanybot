import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AdminFluentIcon } from "../components/AdminFluentIcon";
import { getAdminErrorMessage, getAdminAuthorityMe, type AdminAuthority } from "../lib/api";
import AuditPage from "./AuditPage";
import FeatureControlsPage from "./FeatureControlsPage";
import CmsPage from "./CmsPage";
import CommunityPage from "./CommunityPage";
import UniversalCollectionPage from "./UniversalCollectionPage";
import PlatformAdminPage from "./PlatformAdminPage";
import UsersPage from "./UsersPage";
import SessionsPage from "./SessionsPage";

const SHELL_ITEMS = [
  { path: "/superadmin", label: "الرئيسية", icon: "dashboard", end: true },
  { path: "/superadmin/cms", label: "CMS", icon: "documents", end: false },
  { path: "/superadmin/crm", label: "CRM", icon: "users", end: false },
  { path: "/superadmin/erm", label: "ERM", icon: "briefcase", end: false },
  { path: "/superadmin/operations", label: "Operations", icon: "briefcase", end: false },
  { path: "/superadmin/system", label: "النظام", icon: "settings", end: false },
] as const;

function ChildSurface({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <section className="superadmin-surface card">
      <span className="eyebrow">Universal Admin module index</span>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <div className="superadmin-kpis">
        <div className="superadmin-kpi card"><span className="eyebrow">Navigation</span><strong>Ready</strong><span>Canonical shell route</span></div>
        <div className="superadmin-kpi card"><span className="eyebrow">Ownership</span><strong>Preserved</strong><span>Existing owner chains remain authoritative</span></div>
        <div className="superadmin-kpi card"><span className="eyebrow">Capabilities</span><strong>Gated</strong><span>Actions require frozen capability evidence</span></div>
      </div>
      <div className="superadmin-module-index" aria-label={`${title} management index`}>
        <span className="eyebrow">Management surfaces</span>
        <p className="muted">Select a registered feature from the module navigation when its canonical admin surface is available.</p>
      </div>
    </section>
  );
}

function ShellHome({ authority }: Readonly<{ authority: AdminAuthority }>) {
  return (
    <div className="superadmin-home">
      <div className="page-header">
        <span className="eyebrow">Superadmin Platform</span>
        <h2>لوحة التحكم المركزية</h2>
        <p className="muted">مساحة موحدة للحوكمة والتدقيق والتحكم في الميزات.</p>
      </div>
      <div className="superadmin-kpis">
        <div className="superadmin-kpi card"><span className="eyebrow">Actor</span><strong>{authority.email}</strong><span>{authority.roles.join(", ")}</span></div>
        <div className="superadmin-kpi card"><span className="eyebrow">Authorization</span><strong>SUPERADMIN</strong><span>Server-side authority confirmed</span></div>
        <div className="superadmin-kpi card"><span className="eyebrow">Environment</span><strong>Local Gateway</strong><span>Port 4000 authority boundary</span></div>
      </div>
      <div className="superadmin-shortcuts">
        <NavLink className="accent" to="/superadmin/audit">فتح سجل التدقيق</NavLink>
        <NavLink className="ghost" to="/superadmin/system">حالة النظام</NavLink>
      </div>
    </div>
  );
}

export default function SuperadminShellPage() {
  const location = useLocation();
  const [authority, setAuthority] = useState<AdminAuthority | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getAdminAuthorityMe()
      .then((next) => {
        if (active) setAuthority(next);
      })
      .catch((reason: unknown) => {
        if (active) setError(getAdminErrorMessage(reason, "تعذر التحقق من صلاحية Superadmin."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="page-loading">جار التحقق من الصلاحيات...</div>;
  if (error || !authority) {
    return (
      <section className="superadmin-denied card" role="alert">
        <AdminFluentIcon name="shield" />
        <h2>الوصول غير مصرح</h2>
        <p>{error || "يتطلب هذا المسار دور superadmin."}</p>
      </section>
    );
  }

  const path = location.pathname;
  let content = <ShellHome authority={authority} />;
  if (path === "/audit") content = <AuditPage />;
  else if (path === "/features") content = <FeatureControlsPage />;
  else if (path === "/cms/community") content = <CommunityPage />;
  else if (path === "/cms" || path === "/cms/procedures") content = <CmsPage />;
  else if (path === "/system/official-services") content = <UniversalCollectionPage kind="official-services" />;
  else if (path === "/system/ticker") content = <UniversalCollectionPage kind="ticker" />;
  else if (path === "/system/features") content = <FeatureControlsPage />;
  else if (path === "/cms/ai-training") content = <UniversalCollectionPage kind="ai-training" />;
  else if (path === "/cms/abusive-events") content = <UniversalCollectionPage kind="abusive-events" />;
  else if (path === "/cms/chat-inputs") content = <UniversalCollectionPage kind="chat-inputs" />;
  else if (path === "/cms/answer-overrides") content = <UniversalCollectionPage kind="answer-overrides" />;
  else if (path === "/cms/chat-sessions") content = <UniversalCollectionPage kind="chat-sessions" />;
  else if (path === "/crm/contacts") content = <UniversalCollectionPage kind="crm-contacts" />;
  else if (path === "/erm/assets") content = <UniversalCollectionPage kind="erm-assets" />;
  else if (path === "/cms/rules") content = <UniversalCollectionPage kind="rules" />;
  else if (path === "/cms/news") content = <UniversalCollectionPage kind="news" />;
  else if (path === "/crm") content = <ChildSurface title="CRM" description="مسار CRM محجوز ومحمى، ولم يتم ادعاء تنفيذ لوحة CRM في Wave 1." />;
  else if (path === "/erm") content = <ChildSurface title="ERM" description="مسار ERM محجوز ومحمى، ولم يتم ادعاء تنفيذ لوحة ERM في Wave 1." />;
  else if (path === "/operations") content = <ChildSurface title="Operations" description="مسار Operations الموحد لإدارة التشغيل والعمليات." />;
  else if (path === "/system") content = <ChildSurface title="System" description="حالة النظام وصلاحياته ضمن حدود منصة Superadmin الحالية." />;
  else if (path === "/administrators") content = <UsersPage />;
  else if (path === "/sessions") content = <SessionsPage />;
  else if (path === "/roles-permissions") content = <PlatformAdminPage kind="permissions" />;
  else if (path === "/approvals") content = <PlatformAdminPage kind="approvals" />;
  else if (path === "/system/health") content = <PlatformAdminPage kind="health" />;
  else if (path === "/system/integrations") content = <PlatformAdminPage kind="integrations" />;
  else if (path === "/authority-audit") content = <PlatformAdminPage kind="authorityAudit" />;

  return (
    <div className="superadmin-shell" dir="rtl">
      <header className="superadmin-header">
        <div>
          <span className="eyebrow">Watany Ops / Superadmin</span>
          <h1>مركز الإدارة</h1>
        </div>
        <div className="superadmin-actor" aria-label="Current actor">
          <strong>{authority.email}</strong>
          <span>{authority.roles.join(", ")}</span>
        </div>
      </header>
      <div className="superadmin-layout">
        <nav className="superadmin-nav" aria-label="Superadmin navigation">
          {SHELL_ITEMS.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end ?? false} className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
              <AdminFluentIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <NavLink to="/superadmin/features" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="settings" /><span>التحكم في الميزات</span>
          </NavLink>
          <NavLink to="/superadmin/system/official-services" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="documents" /><span>Official Services</span>
          </NavLink>
          <NavLink to="/superadmin/system/ticker" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="news" /><span>Ticker Items</span>
          </NavLink>
          <NavLink to="/superadmin/system/features" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="settings" /><span>Feature Controls</span>
          </NavLink>
          <NavLink to="/superadmin/cms/ai-training" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="knowledge" /><span>AI Training</span></NavLink>
          <NavLink to="/superadmin/cms/abusive-events" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="shield" /><span>Abusive Events</span></NavLink>
          <NavLink to="/superadmin/cms/chat-inputs" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="chat" /><span>Chat Inputs</span></NavLink>
          <NavLink to="/superadmin/cms/answer-overrides" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="chat" /><span>Answer Overrides</span></NavLink>
          <NavLink to="/superadmin/cms/chat-sessions" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="chat" /><span>Chat Sessions</span></NavLink>
          <NavLink to="/superadmin/crm/contacts" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="users" /><span>CRM Contacts</span></NavLink>
          <NavLink to="/superadmin/erm/assets" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="documents" /><span>ERM Assets</span></NavLink>
          <NavLink to="/superadmin/cms/rules" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="shield" /><span>Filter Rules</span></NavLink>
          <NavLink to="/superadmin/cms/news" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="news" /><span>News</span></NavLink>
          <NavLink to="/superadmin/audit" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="audit" /><span>سجل التدقيق</span>
          </NavLink>
          <NavLink to="/superadmin/administrators" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="users" /><span>Administrators</span></NavLink>
          <NavLink to="/superadmin/sessions" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="shield" /><span>Sessions</span></NavLink>
          <NavLink to="/superadmin/roles-permissions" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="shield" /><span>Roles & Permissions</span></NavLink>
          <NavLink to="/superadmin/approvals" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="audit" /><span>Approval Center</span></NavLink>
          <NavLink to="/superadmin/system/health" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="settings" /><span>Module Health</span></NavLink>
          <NavLink to="/superadmin/system/integrations" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="network" /><span>Integrations</span></NavLink>
          <NavLink to="/superadmin/authority-audit" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="audit" /><span>Authority Audit</span></NavLink>
        </nav>
        <main className="superadmin-main">
          <div className="superadmin-breadcrumb">Superadmin / {path.split("/").filter(Boolean).slice(-1)[0] || "home"}</div>
          {content}
        </main>
      </div>
    </div>
  );
}
