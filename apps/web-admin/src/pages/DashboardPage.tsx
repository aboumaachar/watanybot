import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminActionCard, AdminErrorState, AdminPageSection, AdminStatCard, AdminStatusBadge } from "../components/admin/AdminPrimitives";

type Overview = { timestamp?: string; gateway?: { status?: string; uptime?: number }; runtime?: { nodeVersion?: string; memoryRss?: number }; kb?: { transactions?: number } | null };
type Plugins = { jobApplicationCount?: number; marketplaceCount?: number };
function shown(value: number | undefined): number | string { return typeof value === "number" ? value : "Unavailable"; }

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plugins, setPlugins] = useState<Plugins | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pluginError, setPluginError] = useState("");
  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/overview").then((response) => response.json()).then((data) => { if (active) setOverview(data); }).catch((reason) => { if (active) setError(getAdminErrorMessage(reason, "Unable to load the operational overview.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { adminFetch("/api/admin/plugins").then((response) => response.json()).then(setPlugins).catch((reason) => setPluginError(getAdminErrorMessage(reason, "Plugin data unavailable."))); }, []);
  const gatewayStatus = overview?.gateway?.status === "ok" ? "Healthy" : overview ? "Degraded" : "Unavailable";
  const pluginReady = Boolean(plugins) && !pluginError;
  return <div className="dashboard-home">
    <AdminPageSection title="Operational overview" description="Current platform state from live admin sources.">
      {error ? <AdminErrorState message={error} /> : <div className="admin-stat-grid">
        <AdminStatCard label="Gateway API" value={loading ? "Loading..." : gatewayStatus} detail={overview?.timestamp ? `Updated ${new Date(overview.timestamp).toLocaleTimeString()}` : "No live response"} state={loading ? "loading" : overview ? "ready" : "unavailable"} />
        <AdminStatCard label="Job applications" value={pluginError ? "Unavailable" : pluginReady ? shown(plugins?.jobApplicationCount) : "Loading..."} detail="Current applications" state={pluginError ? "error" : pluginReady ? "ready" : "loading"} to="/jobs" />
        <AdminStatCard label="Marketplace listings" value={pluginError ? "Unavailable" : pluginReady ? shown(plugins?.marketplaceCount) : "Loading..."} detail="Current listings" state={pluginError ? "error" : pluginReady ? "ready" : "loading"} to="/market" />
        <AdminStatCard label="KB transactions" value={loading ? "Loading..." : shown(overview?.kb?.transactions)} detail={overview?.kb ? "Live KB overview" : "No live value returned"} state={overview?.kb ? "ready" : loading ? "loading" : "unavailable"} to="/kb" />
      </div>}
    </AdminPageSection>
    <AdminPageSection title="Attention queues" description="Open the current operational work areas.">
      {pluginError ? <AdminErrorState message={pluginError} /> : <div className="admin-queue-grid"><NavLink className="admin-queue-item" to="/jobs"><strong>Job applications</strong><span>{pluginReady ? shown(plugins?.jobApplicationCount) : "Loading..."}</span></NavLink><NavLink className="admin-queue-item" to="/market"><strong>Marketplace listings</strong><span>{pluginReady ? shown(plugins?.marketplaceCount) : "Loading..."}</span></NavLink></div>}
    </AdminPageSection>
    <AdminPageSection title="Platform health" description="Runtime details available from the existing overview endpoint.">
      <div className="admin-health-list"><div className="admin-health-row"><div><strong>Gateway API</strong><span>{overview?.gateway?.uptime ? `Uptime ${Math.floor(overview.gateway.uptime)}s` : "Awaiting response"}</span></div><AdminStatusBadge status={gatewayStatus} /></div><div className="admin-health-row"><div><strong>Runtime</strong><span>{overview?.runtime?.nodeVersion ?? "Unavailable"}</span></div><AdminStatusBadge status={overview?.runtime ? "Available" : "Unavailable"} /></div></div>
    </AdminPageSection>
    <AdminPageSection title="Next destinations" description="Existing management surfaces only."><div className="admin-action-grid"><AdminActionCard title="Manage users" description="Roles and access status" to="/users" icon="Users" /><AdminActionCard title="Manage content" description="Canonical CMS workspace" to="/cms" icon="CMS" /><AdminActionCard title="Feature controls" description="Review enabled capabilities" to="/features" icon="Flags" /><AdminActionCard title="Audit activity" description="Review administrative events" to="/audit" icon="Log" /></div></AdminPageSection>
  </div>;
}
