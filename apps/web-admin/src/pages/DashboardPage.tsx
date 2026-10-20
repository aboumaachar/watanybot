import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminNotice, AdminStatCard, AdminStatusBadge } from "../components/admin/AdminPrimitives";

type Overview = {
  timestamp?: string;
  gateway?: { status?: string; uptime?: number };
  runtime?: { nodeVersion?: string; memoryRss?: number };
  kb?: { transactions?: number } | null;
};
type Plugins = { jobApplicationCount?: number; marketplaceCount?: number };
type UserSummary = { total?: number; active?: number; suspended?: number; banned?: number };
type AuthoritySummary = { audit?: { recentCount?: number; pendingApprovalCount?: number; failedActionCount?: number } };
type AuditEvent = { id: string; eventType: string; actorId: string; entityType: string; entityId?: string; createdAt: string };

function shown(value: number | undefined): number | string {
  return typeof value === "number" ? value : "—";
}

async function optionalJson<T>(path: string): Promise<T | null> {
  const response = await adminFetch(path);
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}
function DashboardModule({ to, icon, title, description }: Readonly<{ to: string; icon: string; title: string; description: string }>) {
  return <NavLink className="cms-dashboard-module" to={to}><span className="cms-dashboard-module-icon" aria-hidden="true">{icon}</span><span><strong>{title}</strong><small>{description}</small></span><b aria-hidden="true">←</b></NavLink>;
}

function auditLabel(eventType: string): string {
  const value = eventType.toLowerCase();
  if (value.includes("delete")) return "حذف";
  if (value.includes("publish")) return "نشر";
  if (value.includes("update")) return "تعديل";
  if (value.includes("create")) return "إنشاء";
  if (value.includes("approval")) return "موافقة";
  if (value.includes("login")) return "دخول";
  if (value.includes("logout")) return "خروج";
  if (value.includes("relationship")) return "تحديث العلاقات";
  if (value.includes("replace")) return "استبدال";
  if (value.includes("role")) return "تعديل الصلاحيات";
  if (value.includes("feature")) return "تعديل الميزات";
  if (value.includes("bulk")) return "عملية جماعية";
  return eventType;
}

function formatTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("ar-LB", { dateStyle: "short", timeStyle: "short" });
}

function entityLabel(value: string): string {
  const key=value.toLowerCase();
  if(key.includes('article')) return 'مقال';
  if(key.includes('session')) return 'جلسة';
  if(key.includes('user')) return 'مستخدم';
  if(key.includes('job')) return 'وظيفة';
  if(key.includes('market')) return 'السوق';
  if(key.includes('document')) return 'مستند';
  if(key.includes('procedure')) return 'إجراء';
  return value;
}
function compactId(value?: string): string {
  if(!value) return '';
  return value.length>18 ? `${value.slice(0,8)}…${value.slice(-6)}` : value;
}
function formatUptime(seconds?: number): string {
  if(typeof seconds!=='number') return 'بانتظار البيانات';
  const days=Math.floor(seconds/86400); const hours=Math.floor((seconds%86400)/3600);
  const minutes=Math.floor((seconds%3600)/60);
  return days>0 ? `${days}ي ${hours}س` : hours>0 ? `${hours}س ${minutes}د` : `${minutes}د`;
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plugins, setPlugins] = useState<Plugins | null>(null);
  const [users, setUsers] = useState<UserSummary>({});
  const [authority, setAuthority] = useState<AuthoritySummary | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      optionalJson<Overview>("/api/admin/overview"),
      optionalJson<Plugins>("/api/admin/plugins"),
      optionalJson<{ summary?: UserSummary }>("/api/admin/users/summary"),
      optionalJson<{ summary?: AuthoritySummary }>("/api/admin-authority/dashboard/summary"),
      optionalJson<{ events?: AuditEvent[] }>("/api/admin-authority/audit-events?limit=6"),
    ]).then((results) => {
      if (!active) return;
      const value = <T,>(index: number): T | null => results[index]?.status === "fulfilled" ? (results[index] as PromiseFulfilledResult<T | null>).value : null;
      setOverview(value<Overview>(0));
      setPlugins(value<Plugins>(1));
      setUsers(value<{ summary?: UserSummary }>(2)?.summary ?? {});
      setAuthority(value<{ summary?: AuthoritySummary }>(3)?.summary ?? null);
      setAuditEvents(value<{ events?: AuditEvent[] }>(4)?.events ?? []);
      if (results.slice(0, 3).some((result) => result.status === "rejected")) setError("تعذر تحميل بعض المؤشرات الحية. بقيت مساحات الإدارة متاحة.");
      setLoading(false);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(getAdminErrorMessage(reason, "تعذر تحميل لوحة الإدارة."));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const gatewayHealthy = overview?.gateway?.status === "ok";
  const gatewayStatus = gatewayHealthy ? "healthy" : overview ? "degraded" : "unavailable";
  const updatedAt = overview?.timestamp ? new Date(overview.timestamp).toLocaleTimeString("ar-LB") : "—";
  const pendingApprovals = authority?.audit?.pendingApprovalCount;
  const failedActions = authority?.audit?.failedActionCount;

  return <div className="dashboard-home cms-control-dashboard cms-control-dashboard-v4 cms-control-dashboard-v5" dir="rtl">
    <div className="cms-dashboard-commandbar">
      <div><strong>مركز التحكم</strong><span>الوصول السريع إلى أهم مساحات الإدارة والمتابعة اليومية.</span></div>
      <div className="cms-dashboard-command-actions">
        <NavLink className="ghost" to="/users">المستخدمون</NavLink>
        <NavLink className="ghost" to="/admin/procedures">المحتوى</NavLink>
        <NavLink className="ghost" to="/approvals">الموافقات</NavLink>
        <NavLink className="accent" to="/audit">سجل التدقيق</NavLink>
      </div>
    </div>

    {error ? <AdminNotice tone="warning">{error}</AdminNotice> : null}

    <div className="cms-dashboard-kpis">
      <AdminStatCard label="حالة البوابة" value={loading ? "…" : gatewayHealthy ? "سليمة" : "تحتاج متابعة"} detail={`آخر تحديث ${updatedAt}`} state={loading ? "loading" : gatewayHealthy ? "ready" : "unavailable"} />
      <AdminStatCard label="المستخدمون" value={loading ? "…" : shown(users.total)} detail={`${shown(users.active)} نشط`} to="/users" />
      <AdminStatCard label="طلبات الوظائف" value={loading ? "…" : shown(plugins?.jobApplicationCount)} detail="الطلبات الحالية" to="/jobs" />
      <AdminStatCard label="إعلانات السوق" value={loading ? "…" : shown(plugins?.marketplaceCount)} detail="العروض الحالية" to="/market" />
    </div>

    <div className="cms-dashboard-main-grid">
      <section className="admin-section cms-dashboard-modules-panel">
        <div className="admin-section-header"><div><h2>مساحات الإدارة</h2><p className="muted">ابدأ مباشرة من المهمة المطلوبة.</p></div></div>
        <div className="cms-dashboard-module-grid">
          <DashboardModule to="/admin/procedures" icon="✦" title="المحتوى" description="الإجراءات والنماذج والتعاميم" />
          <DashboardModule to="/users" icon="👥" title="المستخدمون" description="الحسابات والصلاحيات والجلسات" />
          <DashboardModule to="/jobs" icon="▣" title="الوظائف" description="الفرص وطلبات التوظيف" />
          <DashboardModule to="/market" icon="◇" title="السوق" description="الإعلانات والعروض المنشورة" />
          <DashboardModule to="/audit" icon="✓" title="التدقيق" description="النشاط الإداري والتغييرات" />
          <DashboardModule to="/system/integrations" icon="⚙" title="الإعدادات" description="التكاملات وصحة النظام" />
        </div>
      </section>

      <section className="admin-section cms-dashboard-health-panel">
        <div className="admin-section-header"><div><h2>حالة النظام</h2><p className="muted">ملخص تشغيلي حي.</p></div></div>
        <div className="cms-dashboard-health-row"><span><strong>Gateway API</strong><small>{`زمن التشغيل ${formatUptime(overview?.gateway?.uptime)}`}</small></span><AdminStatusBadge status={gatewayStatus} /></div>
        <div className="cms-dashboard-health-row"><span><strong>Runtime</strong><small>{overview?.runtime?.nodeVersion ?? "غير متاح"}</small></span><AdminStatusBadge status={overview?.runtime ? "available" : "unavailable"} /></div>
        <div className="cms-dashboard-health-row"><span><strong>قاعدة المعرفة</strong><small>المعاملات المسجلة</small></span><strong>{shown(overview?.kb?.transactions)}</strong></div>
        <div className="cms-dashboard-health-row"><span><strong>إجراءات فاشلة</strong><small>سجل السلطة الإدارية</small></span><strong>{shown(failedActions)}</strong></div>
        <NavLink className="ghost cms-dashboard-health-link" to="/system/health">عرض صحة النظام</NavLink>
      </section>
    </div>

    <div className="cms-dashboard-lower-grid">
      <section className="admin-section cms-dashboard-work-panel">
        <div className="admin-section-header"><div><h2>المتابعة اليومية</h2><p className="muted">أهم العناصر التي تحتاج انتباه الإدارة.</p></div></div>
        <div className="cms-dashboard-work-grid">
          <NavLink to="/jobs"><strong>{shown(plugins?.jobApplicationCount)}</strong><span>طلبات الوظائف</span><small>فتح الطلبات ←</small></NavLink>
          <NavLink to="/market"><strong>{shown(plugins?.marketplaceCount)}</strong><span>عروض السوق</span><small>فتح السوق ←</small></NavLink>
          <NavLink to="/users"><strong>{shown(users.suspended)}</strong><span>حسابات موقوفة</span><small>مراجعة المستخدمين ←</small></NavLink>
          <NavLink to="/approvals"><strong>{shown(pendingApprovals)}</strong><span>موافقات معلقة</span><small>فتح مركز الموافقات ←</small></NavLink>
        </div>
      </section>

      <section className="admin-section cms-dashboard-activity-panel">
        <div className="admin-section-header"><div><h2>آخر النشاطات</h2><p className="muted">أحدث أحداث الإدارة المسجلة.</p></div><NavLink className="ghost sm" to="/audit">عرض الكل</NavLink></div>
        <div className="cms-dashboard-activity-list">
          {auditEvents.length === 0 ? <div className="cms-dashboard-empty">لا توجد بيانات تدقيق متاحة لهذا الحساب.</div> : auditEvents.slice(0, 6).map((event) => (
            <div className="cms-dashboard-activity-row" key={event.id}>
              <span><strong>{auditLabel(event.eventType)}</strong><small>{entityLabel(event.entityType)}{event.entityId ? ` · ${compactId(event.entityId)}` : ""}</small></span>
              <span><small title={event.actorId}>بواسطة {compactId(event.actorId)}</small><time>{formatTime(event.createdAt)}</time></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>;
}
