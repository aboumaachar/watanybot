import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AdminFluentIcon } from "../components/AdminFluentIcon";
import { getAdminErrorMessage, getAdminAuthorityMe, type AdminAuthority } from "../lib/api";
import AuditPage from "./AuditPage";
import FeatureControlsPage from "./FeatureControlsPage";
import CmsPage from "./CmsPage";

const SHELL_ITEMS = [
  { path: "/superadmin", label: "الرئيسية", icon: "dashboard", end: true },
  { path: "/superadmin/cms", label: "CMS", icon: "documents", end: false },
  { path: "/superadmin/crm", label: "CRM", icon: "users", end: false },
  { path: "/superadmin/erm", label: "ERM", icon: "briefcase", end: false },
  { path: "/superadmin/system", label: "النظام", icon: "settings", end: false },
] as const;

function ChildSurface({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <section className="superadmin-surface card">
      <span className="eyebrow">Wave 1 boundary</span>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <span className="superadmin-status">Not implemented in this wave</span>
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
  if (path === "/superadmin/audit") content = <AuditPage />;
  else if (path === "/superadmin/features") content = <FeatureControlsPage />;
  else if (path === "/superadmin/cms" || path === "/superadmin/cms/procedures") content = <CmsPage />;
  else if (path === "/superadmin/crm") content = <ChildSurface title="CRM" description="مسار CRM محجوز ومحمى، ولم يتم ادعاء تنفيذ لوحة CRM في Wave 1." />;
  else if (path === "/superadmin/erm") content = <ChildSurface title="ERM" description="مسار ERM محجوز ومحمى، ولم يتم ادعاء تنفيذ لوحة ERM في Wave 1." />;
  else if (path === "/superadmin/system") content = <ChildSurface title="System" description="حالة النظام وصلاحياته ضمن حدود منصة Superadmin الحالية." />;

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
          <NavLink to="/superadmin/audit" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="audit" /><span>سجل التدقيق</span>
          </NavLink>
        </nav>
        <main className="superadmin-main">
          <div className="superadmin-breadcrumb">Superadmin / {path.split("/").filter(Boolean).slice(-1)[0] || "home"}</div>
          {content}
        </main>
      </div>
    </div>
  );
}
