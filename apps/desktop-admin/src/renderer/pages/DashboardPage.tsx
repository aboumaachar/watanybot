import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

interface Overview {
  status: string;
  timestamp: string;
  gateway: { status: string; uptime: number; port: number };
  legacy: { enabled: boolean; ok: boolean; error: string };
  ai: { enabled: boolean; aiFailures: { count: number; lastError: string | null } };
  voice: { sttConfigured: boolean; ttsConfigured: boolean; lastE2e: any; e2eHistoryCount: number };
  runtime: { nodeVersion: string; pid: number; memoryRss: number };
  kb: { tables: string[]; transactions: number; ragChunks: number; lawArticles: number; salaryRecords: number; knowledgeChunks: number; dbSizeKb: number };
}

export default function DashboardPage() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [plugins, setPlugins] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [o, p] = await Promise.all([api.getOverview(), api.getPluginStats()]);
      setOv(o);
      setPlugins(p);
    } catch (e: any) {
      setErr(e.message || "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (loading && !ov) return <div className="page-loading">Loading dashboard…</div>;
  if (err) return <div className="page-error">⚠ {err} <button onClick={load}>Retry</button></div>;
  if (!ov) return null;

  const memMB = ((ov.runtime?.memoryRss ?? 0) / 1048576).toFixed(1);
  const upMin = ((ov.gateway?.uptime ?? 0) / 60).toFixed(1);

  return (
    <div className="page dashboard-page">
      <h1>System Dashboard</h1>

      <div className="cards">
        <div className={`card status-card ${ov.gateway?.status === "ok" ? "ok" : "warn"}`}>
          <h3>Gateway</h3>
          <span className="badge">{(ov.gateway?.status ?? "unknown").toUpperCase()}</span>
          <p>Port {ov.gateway?.port ?? "?"} · Uptime {upMin} min</p>
        </div>

        <div className={`card status-card ${ov.legacy?.ok ? "ok" : "warn"}`}>
          <h3>Python Backend</h3>
          <span className="badge">{ov.legacy?.ok ? "OK" : "DOWN"}</span>
          {ov.legacy?.error && <p className="detail-error">{ov.legacy.error}</p>}
        </div>

        <div className={`card status-card ${ov.ai?.enabled ? "ok" : "off"}`}>
          <h3>AI Provider</h3>
          <span className="badge">{ov.ai?.enabled ? "ON" : "OFF"}</span>
          {ov.ai?.aiFailures?.count > 0 && <p>Failures: {ov.ai.aiFailures.count}</p>}
        </div>

        <div className={`card status-card ${ov.voice?.ttsConfigured ? "ok" : "off"}`}>
          <h3>Voice TTS</h3>
          <span className="badge">{ov.voice?.ttsConfigured ? "ON" : "OFF"}</span>
          <p>E2E checks: {ov.voice?.e2eHistoryCount ?? 0}</p>
        </div>
      </div>

      <div className="cards">
        <div className="card">
          <h3>Knowledge Base</h3>
          <table>
            <tbody>
              <tr><td>Transactions</td><td>{ov.kb?.transactions ?? 0}</td></tr>
              <tr><td>RAG Chunks</td><td>{ov.kb?.ragChunks ?? 0}</td></tr>
              <tr><td>Law Articles</td><td>{ov.kb?.lawArticles ?? 0}</td></tr>
              <tr><td>Salary Records</td><td>{ov.kb?.salaryRecords ?? 0}</td></tr>
              <tr><td>Knowledge Chunks</td><td>{ov.kb?.knowledgeChunks ?? 0}</td></tr>
              <tr><td>DB Size</td><td>{ov.kb?.dbSizeKb ?? 0} KB</td></tr>
              <tr><td>Tables</td><td>{ov.kb?.tables?.length > 0 ? ov.kb.tables.join(", ") : "—"}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Runtime</h3>
          <table>
            <tbody>
              <tr><td>Node</td><td>{ov.runtime?.nodeVersion ?? "?"}</td></tr>
              <tr><td>PID</td><td>{ov.runtime?.pid ?? "?"}</td></tr>
              <tr><td>Memory</td><td>{memMB} MB</td></tr>
              <tr><td>Timestamp</td><td>{ov.timestamp ? new Date(ov.timestamp).toLocaleString() : "—"}</td></tr>
            </tbody>
          </table>
        </div>

        {plugins && (
          <div className="card">
            <h3>Plugins</h3>
            <table>
              <tbody>
                <tr><td>Job Applications</td><td>{Array.isArray(plugins.jobApplications) ? plugins.jobApplications.length : (plugins.jobApplicationCount ?? 0)}</td></tr>
                <tr><td>Marketplace Listings</td><td>{Array.isArray(plugins.marketplaceListings) ? plugins.marketplaceListings.length : (plugins.marketplaceCount ?? plugins.marketplaceListings ?? 0)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
