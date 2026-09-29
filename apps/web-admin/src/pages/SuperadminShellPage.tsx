import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AdminFluentIcon } from "../components/AdminFluentIcon";
import { getAdminErrorMessage, getAdminAuthorityMe, openPayloadContentStudio, type AdminAuthority } from "../lib/api";
import AuditPage from "./AuditPage";
import FeatureControlsPage from "./FeatureControlsPage";
import CmsPage from "./CmsPage";
import CommunityPage from "./CommunityPage";
import UniversalCollectionPage from "./UniversalCollectionPage";
import PlatformAdminPage from "./PlatformAdminPage";
import UsersPage from "./UsersPage";
import SessionsPage from "./SessionsPage";
import ArticlePublishingAuthority9D72Page from "./ArticlePublishingAuthority9D72Page";
import { DASHBOARD_MODULES } from "../dashboardModuleRegistry";

const SHELL_ITEMS = [
  { path: "/", label: "الرئيسية", icon: "dashboard", end: true },
  { path: "/cms", label: "إدارة المحتوى", icon: "documents", end: false },
  { path: "/operations", label: "العمليات", icon: "briefcase", end: false },
  { path: "/system", label: "النظام", icon: "settings", end: false },
] as const;

const REGISTERED_SHELL_ITEMS = DASHBOARD_MODULES
  .filter((module) => module.status === "ACTIVE")
  .map((module) => ({ path: module.route, label: module.labelAr, icon: module.icon, end: false }));

function ChildSurface({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <section className="superadmin-surface card">
      <span className="eyebrow">فهرس وحدات الإدارة الموحدة</span>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <div className="superadmin-kpis">
        <div className="superadmin-kpi card"><span className="eyebrow">التنقل</span><strong>جاهز</strong><span>مسار القشرة المعتمد</span></div>
        <div className="superadmin-kpi card"><span className="eyebrow">الملكية</span><strong>محفوظة</strong><span>سلاسل الملكية الحالية ما زالت معتمدة</span></div>
        <div className="superadmin-kpi card"><span className="eyebrow">الصلاحيات</span><strong>مقيّدة</strong><span>تتطلب الإجراءات دليلاً ثابتاً للصلاحيات</span></div>
      </div>
      <div className="superadmin-module-index" aria-label={`${title} management index`}>
        <span className="eyebrow">مساحات الإدارة</span>
        <p className="muted">اختر ميزة مسجلة من تنقل الوحدات عندما تتوفر مساحة إدارتها المعتمدة.</p>
      </div>
    </section>
  );
}

function ShellHome({ authority }: Readonly<{ authority: AdminAuthority }>) {
  return (
    <div className="superadmin-home">
      <div className="page-header">
        <span className="eyebrow">منصة الإدارة العليا</span>
        <h2>لوحة التحكم المركزية</h2>
        <p className="muted">مساحة موحدة للحوكمة والتدقيق والتحكم في الميزات.</p>
      </div>
      <div className="superadmin-kpis">
        <div className="superadmin-kpi card"><span className="eyebrow">المشغّل</span><strong>{authority.email}</strong><span>{authority.roles.join(", ")}</span></div>
        <div className="superadmin-kpi card"><span className="eyebrow">التفويض</span><strong>SUPERADMIN</strong><span>تم تأكيد الصلاحية من الخادم</span></div>
        <div className="superadmin-kpi card"><span className="eyebrow">البيئة</span><strong>بوابة Gateway المحلية</strong><span>حدود صلاحية المنفذ 4000</span></div>
      </div>
      <div className="superadmin-shortcuts">
        <NavLink className="accent" to="/audit">فتح سجل التدقيق</NavLink>
        <NavLink className="ghost" to="/system">حالة النظام</NavLink>
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
  else if (path === "/cms/articles" || path === "/superadmin/cms/articles" || path === "/superadmin/cms/articles/archive") content = <ArticlePublishingAuthority9D72Page initialArchive={path.endsWith("/archive")} />;
  else if (path === "/system/official-services" || path === "/superadmin/system/official-services") content = <UniversalCollectionPage kind="official-services" />;
  else if (path === "/system/ticker") content = <UniversalCollectionPage kind="ticker" />;
  else if (path === "/system/features") content = <FeatureControlsPage />;
  else if (path === "/cms/ai-training") content = <UniversalCollectionPage kind="ai-training" />;
  else if (path === "/cms/abusive-events") content = <UniversalCollectionPage kind="abusive-events" />;
  else if (path === "/cms/chat-inputs") content = <UniversalCollectionPage kind="chat-inputs" />;
  else if (path === "/cms/answer-overrides") content = <UniversalCollectionPage kind="answer-overrides" />;
  else if (path === "/cms/chat-sessions") content = <UniversalCollectionPage kind="chat-sessions" />;
  else if (path === "/crm/contacts" || path === "/superadmin/crm/contacts") content = <UniversalCollectionPage kind="crm-contacts" />;
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
          <span className="eyebrow">عمليات موطني / الإدارة العليا</span>
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
          <span className="superadmin-nav-label">الوحدات المسجلة</span>
          {REGISTERED_SHELL_ITEMS.map((item) => (
            <NavLink key={`registered-${item.path}`} to={item.path} end={item.end} className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
              <AdminFluentIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button type="button" className="superadmin-nav-item" onClick={() => void openPayloadContentStudio()}>
            <AdminFluentIcon name="documents" />
            <span>استوديو المحتوى</span>
          </button>
          <NavLink to="/features" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="settings" /><span>التحكم في الميزات</span>
          </NavLink>
          <NavLink to="/system/official-services" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="documents" /><span>الخدمات الرسمية</span>
          </NavLink>
          <NavLink to="/system/ticker" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="news" /><span>عناصر الشريط الإخباري</span>
          </NavLink>
          <NavLink to="/system/features" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="settings" /><span>التحكم بالميزات</span>
          </NavLink>
          <NavLink to="/cms/ai-training" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="knowledge" /><span>تدريب الذكاء الاصطناعي</span></NavLink>
          <NavLink to="/cms/abusive-events" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="shield" /><span>الأحداث المسيئة</span></NavLink>
          <NavLink to="/cms/chat-inputs" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="chat" /><span>مدخلات المحادثة</span></NavLink>
          <NavLink to="/cms/answer-overrides" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="chat" /><span>بدائل الإجابات</span></NavLink>
          <NavLink to="/cms/chat-sessions" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="chat" /><span>جلسات المحادثة</span></NavLink>
          <NavLink to="/crm/contacts" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="users" /><span>جهات اتصال CRM</span></NavLink>
          <NavLink to="/erm/assets" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="documents" /><span>أصول ERM</span></NavLink>
          <NavLink to="/cms/rules" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="shield" /><span>قواعد التصفية</span></NavLink>
          <NavLink to="/cms/news" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="news" /><span>الأخبار</span></NavLink>
          <NavLink to="/superadmin/cms/articles" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="document" /><span>المقالات والأرشيف</span></NavLink>
          <NavLink to="/audit" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}>
            <AdminFluentIcon name="audit" /><span>سجل التدقيق</span>
          </NavLink>
          <NavLink to="/administrators" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="users" /><span>المشرفون</span></NavLink>
          <NavLink to="/sessions" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="shield" /><span>الجلسات</span></NavLink>
          <NavLink to="/roles-permissions" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="shield" /><span>الأدوار والصلاحيات</span></NavLink>
          <NavLink to="/approvals" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="audit" /><span>مركز الموافقات</span></NavLink>
          <NavLink to="/system/health" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="settings" /><span>صحة الوحدات</span></NavLink>
          <NavLink to="/system/integrations" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="network" /><span>التكاملات</span></NavLink>
          <NavLink to="/authority-audit" className={({ isActive }) => `superadmin-nav-item${isActive ? " active" : ""}`}><AdminFluentIcon name="audit" /><span>تدقيق الصلاحيات</span></NavLink>
        </nav>
        <main className="superadmin-main">
          <div className="superadmin-breadcrumb">Superadmin / {path.split("/").filter(Boolean).slice(-1)[0] || "home"}</div>
          {content}
        </main>
      </div>
    </div>
  );
}
