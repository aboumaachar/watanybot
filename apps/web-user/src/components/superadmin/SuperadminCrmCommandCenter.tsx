import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../../styles/watany-superadmin-crm-command-center.css";
import ProceduresAdminDashboard from "../ProceduresAdminDashboard";

const SuperadminUsersPage = lazy(() => import("../../features/superadmin-users/SuperadminUsersPage"));

type EvidenceStatus = "proven" | "candidate" | "missing" | "blocked";
type WidgetStatus = "ready" | "warning" | "blocked" | "pending" | "unknown";

type ModuleInfo = {
  id: string;
  title: string;
  status: WidgetStatus;
  evidenceStatus: EvidenceStatus;
  note?: string;
};

type DashboardSummary = {
  authority: { authenticated: boolean; actorId?: string; roles: string[]; permissions: string[] };
  modules: ModuleInfo[];
  audit: { recentCount: number; pendingApprovalCount: number; failedActionCount: number };
  generatedAt: string;
};

type GateRow = { label: string; status: string; value: string; detail: string };

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8010";

function getToken(): string | null {
  try {
    return localStorage.getItem("watany_token") ?? sessionStorage.getItem("watany_token");
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string): Promise<{ ok: boolean; data?: T; error?: string }> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  else headers["x-watany-role"] = "superadmin";

  try {
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function statusClass(ev: string): string {
  const map: Record<string, string> = {
    ready: "pass",
    proven: "pass",
    pending: "review",
    candidate: "review",
    warning: "review",
    blocked: "blocked",
    missing: "blocked",
    unknown: "disabled",
  };
  return `wsa-status wsa-status-${map[ev] ?? "disabled"}`;
}

function buildGates(loading: boolean, summary: DashboardSummary | null, fetchError: string | null): GateRow[] {
  if (loading) {
    return [
      { label: "Authority", status: "unknown", value: "Loading…", detail: "" },
      { label: "Modules proven", status: "unknown", value: "Loading…", detail: "" },
      { label: "Audit store", status: "unknown", value: "Loading…", detail: "" },
      { label: "Approval store", status: "unknown", value: "Loading…", detail: "" },
    ];
  }

  if (!summary) {
    const detail = fetchError ?? "No token or gateway unreachable.";
    return [
      { label: "Authority", status: "blocked", value: "Blocked", detail },
      { label: "Modules proven", status: "blocked", value: "N/A", detail: "Module proof requires DB backing." },
      { label: "Audit store", status: "blocked", value: "N/A", detail: "In-memory; DB migration required." },
      { label: "Approval store", status: "blocked", value: "N/A", detail: "In-memory; DB migration required." },
    ];
  }

  const authOk = summary.authority.authenticated;
  const provenCount = summary.modules.filter((m) => m.evidenceStatus === "proven").length;
  return [
    { label: "Authority", status: authOk ? "ready" : "blocked", value: authOk ? "Authenticated" : "Blocked", detail: `roles: ${summary.authority.roles.join(", ")}` },
    { label: "Modules proven", status: "pending", value: `${provenCount} / ${summary.modules.length}`, detail: "Module proof requires DB backing." },
    { label: "Audit store", status: "pending", value: `${summary.audit.recentCount} events`, detail: "In-memory; DB migration required." },
    { label: "Approval store", status: "pending", value: `${summary.audit.pendingApprovalCount} pending`, detail: "In-memory; DB migration required." },
  ];
}

const STATIC_MODULES: ModuleInfo[] = [
  { id: "users", title: "Users, roles, sessions", status: "pending", evidenceStatus: "candidate" },
  { id: "kb_studio", title: "KB Studio governance", status: "blocked", evidenceStatus: "missing" },
  { id: "documents", title: "Documents and procedures", status: "blocked", evidenceStatus: "missing" },
  { id: "payments", title: "Payment Intelligence", status: "pending", evidenceStatus: "candidate" },
  { id: "salary", title: "Salary and pension governance", status: "pending", evidenceStatus: "candidate" },
  { id: "chatbot", title: "Chatbot answer review", status: "blocked", evidenceStatus: "missing" },
  { id: "integrations", title: "SMS, OTP, WhatsApp, voice", status: "blocked", evidenceStatus: "missing" },
  { id: "deployment", title: "Deployment health", status: "pending", evidenceStatus: "candidate" },
  { id: "audit", title: "Audit, approvals, rollback", status: "pending", evidenceStatus: "candidate" },
];

function HeaderStatusPill({ loading, fetchError }: { readonly loading: boolean; readonly fetchError: string | null }) {
  if (loading) return <span className="wsa-pill wsa-pill-review">Loading…</span>;
  if (fetchError) return <span className="wsa-pill wsa-pill-blocked">Blocked</span>;
  return <span className="wsa-pill wsa-pill-pass">Authority live</span>;
}

export function SuperadminCrmCommandCenter() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ ok: boolean; summary: DashboardSummary }>("/api/admin-authority/dashboard/summary").then(({ ok, data, error }) => {
      if (cancelled) return;
      if (ok && data?.ok) {
        setSummary(data.summary);
        setFetchError(null);
      } else {
        setFetchError(error ?? "Unknown");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const modules = summary?.modules ?? STATIC_MODULES;
  const gates = buildGates(loading, summary, fetchError);
  const authOk = summary?.authority.authenticated ?? false;
  const managementReady = authOk || !fetchError;

  const quickActions = [
    { label: "Manage users", href: "/superadmin/users" },
    { label: "Open procedures", href: "/superadmin#procedures" },
    { label: "Review forms", href: "/superadmin#forms" },
    { label: "Inspect documents", href: "/superadmin#documents" },
    { label: "Feature flags", href: "/superadmin#features" },
    { label: "Question intelligence", href: "/superadmin#intelligence" },
  ];

  const moduleTargets: Record<string, string> = {
    users: "/superadmin/users",
    kb_studio: "/superadmin#features",
    documents: "/documents",
    payments: "/superadmin#overview",
    salary: "/superadmin#features",
    chatbot: "/superadmin#intelligence",
    integrations: "/superadmin#features",
    deployment: "/superadmin#roadmap",
    audit: "/superadmin#evidence",
  };

  return (
    <main className="wsa-shell wsa-desktop-default" data-wsa-default-view="desktop" dir="ltr">
      <aside className="wsa-sidebar" aria-label="Superadmin sections">
        <div className="wsa-brand-mark">W</div>
        <div>
          <p className="wsa-eyebrow">Watany internal</p>
          <h1>Superadmin CRM</h1>
          <p className="wsa-muted">Operations Command Center</p>
        </div>
        <nav className="wsa-nav">
          <a href="#overview">Overview</a>
          <a href="#gates">Authority gates</a>
          <a href="#modules">Modules</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#evidence">Evidence</a>
        </nav>
        <div className="wsa-lock-box">
          <strong>{managementReady ? "Live control mode" : "Control surface pending"}</strong>
          <span>{managementReady ? "Use the action rail and module cards below to manage live admin surfaces." : "Authority data is still loading or the gateway is unreachable."}</span>
        </div>
        {summary && (
          <p className="wsa-muted" style={{ fontSize: "0.7rem", marginTop: "1rem" }}>
            Data as of {new Date(summary.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </aside>

      <section className="wsa-content">
        <header className="wsa-topbar" id="overview">
          <div>
            <p className="wsa-eyebrow">Path A hardening</p>
            <h2>Superadmin CRM Command Center</h2>
            <p className="wsa-muted">{loading ? "Loading authority data…" : fetchError ? `Gateway unreachable — ${fetchError}` : "Live authority data bound from gateway."}</p>
          </div>
          <div className="wsa-top-actions">
            <HeaderStatusPill loading={loading} fetchError={fetchError} />
            <span className="wsa-pill wsa-pill-pass">Management enabled</span>
          </div>
        </header>

        <section className="wsa-action-rail" aria-label="Quick management actions">
          {quickActions.map((action) => (
            <button key={action.label} type="button" className="wsa-action-rail__btn" onClick={() => navigate(action.href)}>
              {action.label}
            </button>
          ))}
        </section>

        <section className="wsa-hero-grid">
          <article className="wsa-hero-card">
            <p className="wsa-eyebrow">Current implementation gate</p>
            <h3>Active dashboard with live API binding</h3>
            <p>
              Authority data is loaded from <code>/api/admin-authority/dashboard/summary</code>. Use the action rail to jump into the live admin surfaces and manage the app.
            </p>
          </article>
          <article className="wsa-hero-card wsa-accent-card">
            <p className="wsa-eyebrow">Next engineering gate</p>
            <h3>Module workflows are now reachable</h3>
            <p>Each module card now serves as a launch point into the corresponding management surface instead of a dead-end viewer tile.</p>
          </article>
        </section>

        <section className="wsa-section" id="procedures">
          <div className="wsa-section-head">
            <p className="wsa-eyebrow">Active module</p>
            <h2>Procedures management</h2>
          </div>
          <div className="wsa-inline-panel">
            <ProceduresAdminDashboard />
          </div>
        </section>

        <section className="wsa-section" id="forms">
          <div className="wsa-section-head">
            <p className="wsa-eyebrow">Active module</p>
            <h2>User management</h2>
          </div>
          <div className="wsa-inline-panel">
            <Suspense fallback={<div className="wsa-card">Loading user management…</div>}>
              <SuperadminUsersPage />
            </Suspense>
          </div>
        </section>

        <section className="wsa-card-grid" id="gates">
          {gates.map((gate) => (
            <article className="wsa-card" key={gate.label}>
              <div className="wsa-card-head">
                <span className={`wsa-status wsa-status-${gate.status}`}>{gate.status}</span>
                <span className="wsa-muted">{gate.label}</span>
              </div>
              <h3>{gate.value}</h3>
              <p>{gate.detail}</p>
            </article>
          ))}
        </section>

        <section className="wsa-section" id="modules">
          <div className="wsa-section-head">
            <p className="wsa-eyebrow">WatanyBot full control map</p>
            <h2>CRM modules</h2>
          </div>
          <div className="wsa-module-grid">
            {modules.map((mod) => (
              <article className="wsa-module-card" key={mod.id}>
                <div className="wsa-module-icon" aria-hidden="true">*</div>
                <div>
                  <div className="wsa-module-title-row">
                    <h3>{mod.title}</h3>
                    <span className={statusClass(mod.evidenceStatus)}>{mod.evidenceStatus}</span>
                  </div>
                  {mod.note ? <p className="wsa-muted" style={{ fontSize: "0.75rem" }}>{mod.note}</p> : null}
                  <div className="wsa-module-actions">
                    <button type="button" className="wsa-module-action" onClick={() => navigate(moduleTargets[mod.id] ?? "/superadmin")}>
                      Open workspace
                    </button>
                    <button type="button" className="wsa-module-action wsa-module-action--ghost" onClick={() => navigate("/superadmin/users")}>
                      Manage users
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="wsa-section wsa-roadmap" id="roadmap">
          <div className="wsa-section-head">
            <p className="wsa-eyebrow">Implementation sequence</p>
            <h2>Authority first, UI second</h2>
          </div>
          <ol>
            <li>Gateway proof route mount - DONE</li>
            <li>No-auth and non-superadmin negative tests - DONE</li>
            <li>DB-backed audit, approval, and versioning services - PENDING</li>
            <li>Read-only CRM data binding - DONE</li>
            <li>Module-by-module CRUD with approval gates - PENDING</li>
            <li>Browser proof - PENDING</li>
          </ol>
        </section>

        <section className="wsa-section" id="documents">
          <div className="wsa-section-head">
            <p className="wsa-eyebrow">Direct access</p>
            <h2>Documents and forms</h2>
          </div>
          <div className="wsa-card-grid">
            <article className="wsa-card">
              <h3>Documents</h3>
              <p>Open the document library for policies, references, and PDF-backed official items.</p>
              <div className="wsa-module-actions">
                <button type="button" className="wsa-module-action" onClick={() => navigate("/documents")}>Open documents</button>
              </div>
            </article>
            <article className="wsa-card">
              <h3>Forms</h3>
              <p>Jump into the forms browser to review published forms and their metadata.</p>
              <div className="wsa-module-actions">
                <button type="button" className="wsa-module-action" onClick={() => navigate("/forms")}>Open forms</button>
              </div>
            </article>
            <article className="wsa-card">
              <h3>Taxi</h3>
              <p>Switch into the trusted mobility admin and driver workflow when needed.</p>
              <div className="wsa-module-actions">
                <button type="button" className="wsa-module-action" onClick={() => navigate("/taxi/driver")}>Open taxi</button>
              </div>
            </article>
            <article className="wsa-card">
              <h3>Opportunities</h3>
              <p>Review import, audit, and moderation surfaces for opportunities and marketplace content.</p>
              <div className="wsa-module-actions">
                <button type="button" className="wsa-module-action" onClick={() => navigate("/admin/opportunities")}>Open opportunities</button>
              </div>
            </article>
          </div>
        </section>

        <section className="wsa-evidence" id="evidence">
          <div>
            <p className="wsa-eyebrow">PMA evidence</p>
            <h2>Current operating status</h2>
          </div>
          <div className="wsa-evidence-grid">
            <span className={authOk ? "wsa-status wsa-status-pass" : "wsa-status wsa-status-blocked"}>{authOk ? "âœ“" : "âœ—"} Superadmin auth</span>
            <span className={summary ? "wsa-status wsa-status-pass" : "wsa-status wsa-status-blocked"}>{summary ? "âœ“" : "âœ—"} Dashboard API bound</span>
            <span className="wsa-status wsa-status-pass">âœ“ Navigation actions active</span>
            <span className="wsa-status wsa-status-review">Audit + approval workflow pending</span>
            <span className="wsa-status wsa-status-review">DB-backed mutations pending</span>
            <span className="wsa-status wsa-status-review">Browser proof pending</span>
          </div>
        </section>
      </section>
    </main>
  );
}

export default SuperadminCrmCommandCenter;
