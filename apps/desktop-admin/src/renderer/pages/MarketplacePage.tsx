import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export default function MarketplacePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [jobQuery, setJobQuery] = useState("");
  const [alertQuery, setAlertQuery] = useState("");
  const [tab, setTab] = useState<"jobs" | "marketplace" | "alerts">("jobs");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [m, a] = await Promise.all([
          api.listMarketplace().catch(() => []),
          api.getEmergencyAlerts().catch(() => []),
        ]);
        setListings(Array.isArray(m) ? m : m?.listings || []);
        setAlerts(Array.isArray(a) ? a : a?.alerts || []);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function doSearchJobs() {
    try {
      const r = await api.searchJobs(jobQuery);
      setJobs(Array.isArray(r) ? r : r?.jobs || []);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function doSearchAlerts() {
    try {
      const r = await api.getEmergencyAlerts(alertQuery);
      setAlerts(Array.isArray(r) ? r : r?.alerts || []);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  if (loading) return <div className="page-loading">Loading plugins…</div>;

  return (
    <div className="page plugins-page">
      <h1>Plugins & Marketplace</h1>
      {err && <div className="page-error">⚠ {err}</div>}

      <div className="tab-bar">
        <button className={`tab ${tab === "jobs" ? "active" : ""}`} onClick={() => setTab("jobs")}>
          Jobs
        </button>
        <button className={`tab ${tab === "marketplace" ? "active" : ""}`} onClick={() => setTab("marketplace")}>
          Marketplace ({listings.length})
        </button>
        <button className={`tab ${tab === "alerts" ? "active" : ""}`} onClick={() => setTab("alerts")}>
          Emergency Alerts ({alerts.length})
        </button>
      </div>

      {tab === "jobs" && (
        <section>
          <div className="search-bar">
            <input placeholder="Search jobs…" value={jobQuery} onChange={(e) => setJobQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearchJobs()} />
            <button onClick={doSearchJobs}>Search</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Title</th><th>Company</th><th>Location</th><th>Mode</th><th>Tags</th></tr></thead>
            <tbody>
              {jobs.map((j, i) => (
                <tr key={i}>
                  <td>{j.title}</td><td>{j.company}</td><td>{j.location}</td><td>{j.mode}</td><td>{j.tags?.join(", ")}</td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.5 }}>Search for jobs above</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {tab === "marketplace" && (
        <section>
          <table className="data-table">
            <thead><tr><th>Title</th><th>Price</th><th>Category</th><th>Status</th><th>Seller</th></tr></thead>
            <tbody>
              {listings.map((l, i) => (
                <tr key={i}>
                  <td>{l.title}</td><td>{l.price?.toLocaleString()} {l.currency}</td><td>{l.category}</td><td>{l.status}</td><td>{l.sellerName || "—"}</td>
                </tr>
              ))}
              {listings.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.5 }}>No listings</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {tab === "alerts" && (
        <section>
          <div className="search-bar">
            <input placeholder="Filter alerts…" value={alertQuery} onChange={(e) => setAlertQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearchAlerts()} />
            <button onClick={doSearchAlerts}>Filter</button>
          </div>
          <div className="alert-list">
            {alerts.map((a, i) => (
              <div key={i} className="card alert-card">
                <h4>{a.title}</h4>
                <p>{a.body || a.message}</p>
                <span className="note">{a.source} · {a.country} · {a.date ? new Date(a.date).toLocaleDateString() : ""}</span>
              </div>
            ))}
            {alerts.length === 0 && <p className="empty">No emergency alerts.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
