import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

const DEFAULT_PYTHON_API_URL = "http://localhost:8012";

export default function AppManagementPage() {
  const [overview, setOverview] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [savedChats, setSavedChats] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "documents" | "notifications" | "saved">("overview");

  useEffect(() => {
    (async () => {
      try {
        const [ov, n, d, s] = await Promise.all([
          api.getOverview(),
          api.getNotifications().catch(() => []),
          api.getDocuments().catch(() => []),
          api.getSavedChats().catch(() => []),
        ]);
        setOverview(ov);
        setNotifications(Array.isArray(n) ? n : n?.notifications || []);
        setDocuments(Array.isArray(d) ? d : d?.documents || []);
        setSavedChats(Array.isArray(s) ? s : s?.saved || []);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function clearAll() {
    try {
      await api.clearNotifications();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function removeSaved(id: string) {
    try {
      await api.removeSavedChat(id);
      setSavedChats((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div className="page mgmt-page">
      <h1>App Management</h1>
      {err && <div className="page-error">⚠ {err}</div>}

      <div className="tab-bar">
        {(["overview", "documents", "notifications", "saved"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "overview" && "Service Health"}
            {t === "documents" && `Documents (${documents.length})`}
            {t === "notifications" && `Notifications (${notifications.filter((n) => !n.read).length})`}
            {t === "saved" && `Saved Chats (${savedChats.length})`}
          </button>
        ))}
      </div>

      {tab === "overview" && overview && (
        <div className="cards">
          <div className="card">
            <h3>Gateway</h3>
            <table>
              <tbody>
                <tr><td>Status</td><td>{overview.gateway?.status}</td></tr>
                <tr><td>Port</td><td>{overview.gateway?.port}</td></tr>
                <tr><td>Uptime</td><td>{(overview.gateway?.uptime / 60).toFixed(1)} min</td></tr>
                <tr><td>Node</td><td>{overview.runtime?.nodeVersion}</td></tr>
                <tr><td>PID</td><td>{overview.runtime?.pid}</td></tr>
                <tr><td>Memory</td><td>{(overview.runtime?.memoryRss / 1048576).toFixed(1)} MB</td></tr>
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Backend Services</h3>
            <table>
              <tbody>
                <tr><td>Python API</td><td>{overview.legacy?.ok ? "✓ Online" : "✕ Down"}</td></tr>
                <tr><td>AI Provider</td><td>{overview.ai?.enabled ? "✓ Enabled" : "✕ Disabled"}</td></tr>
                <tr><td>Voice TTS</td><td>{overview.voice?.ttsConfigured ? "✓" : "✕"}</td></tr>
                <tr><td>Voice STT</td><td>{overview.voice?.sttConfigured ? "✓" : "✕"}</td></tr>
              </tbody>
            </table>

            <div style={{ marginTop: 12 }}>
              <label>Python API URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" defaultValue={overview.legacy?.enabled ? '' : ''} placeholder={DEFAULT_PYTHON_API_URL} id="pythonBaseInput" />
                <button onClick={async () => {
                  const el = document.getElementById('pythonBaseInput') as HTMLInputElement | null;
                  const base = (el?.value || '').trim() || DEFAULT_PYTHON_API_URL;
                  try {
                    const res = await api.probePython(base);
                    if (res.ok) {
                      alert(`Python probe OK — status=${res.statusCode} latency=${res.latencyMs}ms`);
                    } else {
                      alert(`Python probe failed: ${res.error || 'no response'}`);
                    }
                  } catch (err: any) {
                    alert(String(err.message || err));
                  }
                }}>Probe</button>
              </div>

              <hr style={{ margin: '12px 0' }} />

              <label>AI Provider (runtime)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select id="aiProviderSelect" defaultValue={overview.ai?.provider || 'openai'} style={{ minWidth: 160 }}>
                  <option value="openai">OpenAI-compatible</option>
                  <option value="ollama">Ollama</option>
                </select>
                <input id="aiModelInput" defaultValue={overview.ai?.model || ''} placeholder="model" style={{ width: 160 }} />
                <input id="aiKeyInput" placeholder="API key" style={{ width: 260 }} />
                <button onClick={async () => {
                  const provider = (document.getElementById('aiProviderSelect') as HTMLSelectElement).value;
                  const model = (document.getElementById('aiModelInput') as HTMLInputElement).value;
                  const key = (document.getElementById('aiKeyInput') as HTMLInputElement).value;
                  try {
                    const res = await api.setAiConfig({ enabled: true, provider, model, apiKey: key });
                    if (res.ok) alert('AI enabled (runtime)'); else alert('Failed to enable AI: ' + (res.error || 'unknown'));
                  } catch (err: any) { alert(String(err.message || err)); }
                }}>Enable AI</button>
                <button onClick={async () => { try { const r = await api.setAiConfig({ enabled: false }); if (r.ok) alert('AI disabled'); } catch (err: any) { alert(String(err.message || err)); } }}>Disable AI</button>
              </div>
            </div>
          </div>
          <div className="card">
            <h3>Endpoints</h3>
            <p className="note">Gateway: http://localhost:{overview.gateway?.port}</p>
            <p className="note">Python API: {overview.legacy?.enabled ? "enabled" : "disabled"}</p>
            <p className="note">Timestamp: {new Date(overview.timestamp).toLocaleString()}</p>
          </div>
        </div>
      )}

      {tab === "documents" && (
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Kind</th><th>Title</th><th>Status</th><th>Tags</th></tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.id?.slice(0, 8)}</td>
                <td>{d.kind}</td>
                <td>{d.title || d.filename || "—"}</td>
                <td><span className={`badge ${d.status}`}>{d.status}</span></td>
                <td>{d.tags?.join(", ") || "—"}</td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.5 }}>No documents</td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "notifications" && (
        <>
          <div className="page-header" style={{ marginBottom: 12 }}>
            <span>{notifications.filter((n) => !n.read).length} unread</span>
            <button className="btn-sm" onClick={clearAll}>Mark All Read</button>
          </div>
          <div className="notif-list">
            {notifications.map((n) => (
              <div key={n.id} className={`notif-item ${n.read ? "read" : "unread"}`}>
                <span className="notif-kind">{n.kind}</span>
                <span>{n.title || n.message}</span>
                <span className="history-time">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</span>
              </div>
            ))}
            {notifications.length === 0 && <p className="empty">No notifications.</p>}
          </div>
        </>
      )}

      {tab === "saved" && (
        <div className="saved-list">
          {savedChats.map((s) => (
            <div key={s.id} className="saved-item card">
              <p>{s.text}</p>
              <div className="saved-actions">
                <span className="history-time">{s.savedAt ? new Date(s.savedAt).toLocaleString() : ""}</span>
                <button className="btn-sm btn-danger" onClick={() => removeSaved(s.id)}>Remove</button>
              </div>
            </div>
          ))}
          {savedChats.length === 0 && <p className="empty">No saved chats.</p>}
        </div>
      )}
    </div>
  );
}
