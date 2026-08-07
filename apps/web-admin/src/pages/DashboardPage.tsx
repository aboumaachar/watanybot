import { useEffect, useMemo, useState } from "react";
import DashboardFeatureSettingsCard from "./DashboardFeatureSettingsCard";
import DashboardWebUserSettingsCard from "./DashboardWebUserSettingsCard";
import { adminFetch, getAdminErrorMessage } from "../lib/api";

type KbStats = {
  transactions: number;
  lawArticles: number;
  note?: string;
};

type AdminOverview = {
  status: string;
  timestamp: string;
  gateway: { status: string; uptime: number; host: string; port: number };
  legacy?: { enabled: boolean; ok: boolean; statusCode?: number; latencyMs?: number; error?: string };
  voice?: {
    sttConfigured: boolean;
    ttsConfigured: boolean;
    alertsConfigured?: boolean;
    lastE2e?: { ts: string; ok: boolean; transcript?: string; confidence?: number; error?: string } | null;
    e2eHistoryCount?: number;
    alertHistoryCount?: number;
    lastAlert?: { ts: string; level?: string; message?: string } | null;
  };
  runtime?: { nodeVersion: string; pid: number; memoryRss: number };
  kb?: KbStats | null;
};

type TtsProvider = 'openai' | 'azure' | 'voicerss' | 'google';

type VoiceSMTP = { host?: string; port?: number; user?: string; pass?: string; from?: string; to?: string };
type VoiceTtsProviderConfig = { apiKey?: string };
type VoiceTtsOpenAiConfig = VoiceTtsProviderConfig & {
  defaultVoice?: string;
  arabicVoice?: string;
  model?: string;
  arabicModel?: string;
  instructions?: string;
  arabicInstructions?: string;
};
type VoiceTtsAzureConfig = VoiceTtsProviderConfig & {
  region?: string;
  endpoint?: string;
  defaultVoice?: string;
  arabicVoice?: string;
  outputFormat?: string;
};
type VoiceTtsConfig = {
  provider?: TtsProvider;
  strictProvider?: boolean;
  openai?: VoiceTtsOpenAiConfig;
  azure?: VoiceTtsAzureConfig;
  voicerss?: VoiceTtsProviderConfig;
};
type VoiceConfig = { slackWebhook?: string; alertWebhook?: string; smtp?: VoiceSMTP; tts?: VoiceTtsConfig };

type AdminPlugins = {
  jobApplicationCount: number;
  marketplaceCount: number;
  jobApplications: Array<{ id: string; jobId: string; name: string; phone: string; createdAt: number }>;
  marketplaceListings: Array<{ id: string; title: string; location: string; price: number; currency: string }>;
};

const kpis = [
  { label: "Daily Conversations", value: "4,382", delta: "+12%" },
  { label: "Avg Response", value: "2.6s", delta: "-8%" },
  { label: "Human Escalations", value: "3.1%", delta: "-0.4%" },
  { label: "CSAT", value: "4.7/5", delta: "+0.2" },
];

const baseServices = [
  { name: "Gateway API", status: "Unknown", note: "live status" },
  { name: "Legacy Core", status: "Degraded", note: "timeout spike" },
  { name: "KB v3", status: "Synced", note: "last sync 12m" },
  { name: "Worker", status: "Healthy", note: "queue 9" },
];

const queues = [
  { name: "Escalations", count: 23, sla: "< 10m", trend: "stable" },
  { name: "Audit Flags", count: 7, sla: "< 1h", trend: "down" },
  { name: "Policy Requests", count: 14, sla: "< 30m", trend: "up" },
];

const kbFallback = [
  { label: "Coverage", value: "91%", width: "91%" },
  { label: "Freshness", value: "84%", width: "84%" },
  { label: "Consistency", value: "96%", width: "96%" },
];

const channels = [
  { name: "WhatsApp", volume: "1,842", success: "98.4%", alert: "2 delays" },
  { name: "Web User", volume: "1,124", success: "99.1%", alert: "No alerts" },
  { name: "Public Web", volume: "622", success: "97.8%", alert: "1 retry" },
];

const feedback = [
  { topic: "Public salaries", intent: "policy", note: "Needs citation in answer", time: "7m ago" },
  { topic: "Benefits portal", intent: "support", note: "Broken link reported", time: "18m ago" },
  { topic: "Residency guide", intent: "how-to", note: "Add PDF handout", time: "42m ago" },
];

const playbook = ["Sync KB delta", "Review escalations", "Run behavior audit", "Export daily report"];

function formatTime(value?: string): string {
  if (!value) return "--";
  try { return new Date(value).toLocaleTimeString(); } catch { return value; }
}

function updateVoiceTtsConfig(config: VoiceConfig, tts: Partial<VoiceTtsConfig>): VoiceConfig {
  const currentTts = config.tts ?? {};
  const currentOpenAi = currentTts.openai ?? {};
  const currentAzure = currentTts.azure ?? {};
  const currentVoicerss = currentTts.voicerss ?? {};

  return {
    ...config,
    tts: {
      ...currentTts,
      ...tts,
      openai: tts.openai ? { ...currentOpenAi, ...tts.openai } : currentTts.openai,
      azure: tts.azure ? { ...currentAzure, ...tts.azure } : currentTts.azure,
      voicerss: tts.voicerss ? { ...currentVoicerss, ...tts.voicerss } : currentTts.voicerss,
    },
  };
}

function ErrorMapPanel() {
  const [errors, setErrors] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const debugErrorsEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_ERRORS === "true";

  useEffect(() => {
    if (!debugErrorsEnabled) {
      // debug-errors-disabled-in-runtime
      setErrors([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await adminFetch("/api/debug/errors?limitPerGroup=5");
        const body = await res.json();
        if (mounted && body.ok) setErrors(body.errors || []);
      } catch { /* ignore */ }
      finally { if (mounted) setLoading(false); }
    }
    load();
    const timer = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, [debugErrorsEnabled]);

  return (
    <div className="error-map">
      {loading && <div className="muted">Loading...</div>}
      {!loading && errors.length === 0 && <div className="muted">No recent errors.</div>}
      <div className="error-list">
        {errors.map((e) => (
          <button key={e.key} className="error-row" onClick={() => setSelected(selected === e.key ? null : e.key)}>
            <div className="error-meta">
              <div className="error-title">{e.message || e.key}</div>
              <div className="error-sub">{e.routes.join(", ")} • {e.count} occurrences • last: {new Date(e.lastSeen).toLocaleTimeString()}</div>
            </div>
            {selected === e.key && (
              <div className="error-samples">
                {e.samples.map((s: any) => (
                  <pre key={`${s.timestamp}-${String(s.message).slice(0,40)}`} className="sample">{s.timestamp} — {s.message}</pre>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [plugins, setPlugins] = useState<AdminPlugins | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pluginError, setPluginError] = useState("");
  const [voiceTestStatus, setVoiceTestStatus] = useState<'idle' | 'running' | 'ok' | 'fail'>('idle');
  const [voiceTestTranscript, setVoiceTestTranscript] = useState('');
  const [voiceTestError, setVoiceTestError] = useState('');
  const [voiceHistory, setVoiceHistory] = useState<any[]>([]);
  const [voiceHistoryLoading, setVoiceHistoryLoading] = useState(false);
  const [alertHistory, setAlertHistory] = useState<any[]>([]);
  const [alertHistoryLoading, setAlertHistoryLoading] = useState(false);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig | null>(null);
  const [alertTestStatus, setAlertTestStatus] = useState<'idle' | 'running' | 'ok' | 'fail'>('idle');
  const [showVoiceHistory, setShowVoiceHistory] = useState(false);
  const [showAlertHistory, setShowAlertHistory] = useState(false);

  useEffect(() => {
    void loadVoiceConfig();
  }, []);

  async function loadVoiceHistory() {
    setVoiceHistoryLoading(true);
    try {
      const res = await adminFetch("/api/admin/voice-checks");
      const body = await res.json();
      setVoiceHistory(body.history || []);
    } catch { /* ignore */ }
    finally { setVoiceHistoryLoading(false); }
  }

  async function loadAlertHistory() {
    setAlertHistoryLoading(true);
    try {
      const res = await adminFetch("/api/admin/voice-alerts");
      const body = await res.json();
      setAlertHistory(body.alerts || []);
    } catch { /* ignore */ }
    finally { setAlertHistoryLoading(false); }
  }

  async function sendTestAlert() {
    setAlertTestStatus('running');
    try {
      const res = await adminFetch("/api/admin/voice-checks/alert-test", { method: 'POST', body: JSON.stringify({}) });
      const body = await res.json();
      setAlertTestStatus(body?.ok ? 'ok' : 'fail');
    } catch (err: any) {
      setAlertTestStatus('fail');
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await adminFetch("/api/admin/overview");
        const data = (await res.json()) as AdminOverview;
        if (active) setOverview(data);
      } catch (err) {
        if (active) setError(getAdminErrorMessage(err, "Failed to load live overview."));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPlugins() {
      setPluginError("");
      try {
        const res = await adminFetch("/api/admin/plugins");
        const data = (await res.json()) as AdminPlugins;
        if (active) setPlugins(data);
      } catch (err) {
        if (active) setPluginError(getAdminErrorMessage(err, "Failed to load plugin metrics."));
      }
    }
    loadPlugins();
    const timer = setInterval(loadPlugins, 20000);
    return () => { active = false; clearInterval(timer); };
  }, []);


  async function loadVoiceConfig() {
    try {
      const res = await adminFetch("/api/admin/voice-config");
      const body = await res.json();
      setVoiceConfig(body.config || {});
    } catch { /* ignore */ }
  }

  async function saveVoiceConfig() {
    try {
      const res = await adminFetch("/api/admin/voice-config", { method: 'POST', body: JSON.stringify(voiceConfig) });
      const body = await res.json();
      setVoiceConfig(body.config || voiceConfig);
      const ov = await (await adminFetch("/api/admin/overview")).json();
      setOverview(ov);
    } catch { /* ignore */ }
  }


  async function runVoiceE2E() {
    setVoiceTestStatus('running');
    setVoiceTestTranscript('');
    setVoiceTestError('');
    try {
      const res = await adminFetch("/api/admin/voice-checks/run", { method: 'POST' });
      const body = await res.json();
      const r = body?.result;
      if (!r) throw new Error('No result returned');
      setVoiceTestTranscript(r.transcript || r.error || '—');
      setVoiceTestStatus(r.ok ? 'ok' : 'fail');
      if (!r.ok) setVoiceTestError(r.error || 'failed');
    } catch (err: any) {
      setVoiceTestStatus('fail');
      setVoiceTestError(getAdminErrorMessage(err, 'Voice E2E failed.'));
    }
  }

  const gatewayStatus = overview?.gateway?.status === "ok" ? "Healthy" : "Unknown";
  let legacyStatus = "Disabled";
  if (overview?.legacy?.enabled) {
    legacyStatus = overview.legacy.ok ? "Healthy" : "Degraded";
  }
  const services = useMemo(
    () =>
      baseServices.map((service) =>
        service.name === "Gateway API"
          ? { ...service, status: gatewayStatus, note: overview ? `uptime ${Math.floor(overview.gateway.uptime)}s` : service.note }
          : service.name === "Legacy Core"
            ? { ...service, status: legacyStatus, note: overview?.legacy?.enabled ? (overview.legacy.ok ? `health ${overview.legacy.statusCode ?? "--"} in ${overview.legacy.latencyMs ?? "--"}ms` : overview.legacy.error || "health check failed") : "disabled" }
            : service
      ),
    [gatewayStatus, legacyStatus, overview]
  );

  const kbStats = overview?.kb ?? null;
  const kbCounts = kbStats
    ? [
        { label: "Transactions", value: String(kbStats.transactions) },
        { label: "Law articles", value: String(kbStats.lawArticles) },
      ]
    : [];

  return (
    <>
      <div className="card hero span-7">
        <div className="hero-head">
          <div>
            <h2>Live Pulse</h2>
            <p className="muted">{loading ? "Refreshing live overview..." : "All channels performing within SLA."}</p>
          </div>
          <div className="badge">Stable</div>
        </div>
        <div className="kpi-grid">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="kpi">
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-delta">{kpi.delta}</div>
            </div>
          ))}
        </div>
        <div className="signal-row">
          <div>
            <div className="signal-title">Top Intent</div>
            <div className="signal-value">Employment policy clarification</div>
          </div>
          <div>
            <div className="signal-title">Peak Hour</div>
            <div className="signal-value">13:00 - 15:00</div>
          </div>
          <div>
            <div className="signal-title">Runtime</div>
            <div className="signal-value">
              {overview?.runtime?.nodeVersion ? `${overview.runtime.nodeVersion} | PID ${overview.runtime.pid}` : "Node runtime"}
            </div>
          </div>
        </div>
      </div>

      <div className="card span-5">
        <h3>Service Health</h3>
        <p className="muted">Last update: {formatTime(overview?.timestamp)}</p>
        {error && <p className="muted">{error}</p>}
        <div className="service-list">
          {services.map((service) => (
            <div key={service.name} className="service-row">
              <div>
                <div className="service-name">{service.name}</div>
                <div className="service-note">{service.note}</div>
              </div>
              <span className={`status ${service.status.toLowerCase()}`}>{service.status}</span>
            </div>
          ))}
        </div>

        {overview?.voice && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--muted)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Voice services</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 10, height: 10, borderRadius: 10, background: overview.voice.sttConfigured ? 'var(--success)' : 'var(--warning)' }} />
                <span style={{ fontSize: 13 }}>STT: <strong>{overview.voice.sttConfigured ? 'On' : 'Off'}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 10, height: 10, borderRadius: 10, background: overview.voice.ttsConfigured ? 'var(--success)' : 'var(--warning)' }} />
                <span style={{ fontSize: 13 }}>TTS: <strong>{overview.voice.ttsConfigured ? 'On' : 'Off'}</strong></span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="ghost sm" disabled={voiceTestStatus === 'running'} onClick={runVoiceE2E}>
                {voiceTestStatus === 'running' ? 'Running…' : 'Voice E2E'}
              </button>
              <button className="ghost sm" disabled={!overview.voice.alertsConfigured || alertTestStatus === 'running'} onClick={sendTestAlert}>
                {alertTestStatus === 'running' ? 'Sending…' : 'Test Alert'}
              </button>
              <button className="ghost sm" onClick={async () => { setShowVoiceHistory(s => !s); if (!showVoiceHistory) await loadVoiceHistory(); }}>
                {showVoiceHistory ? 'Hide History' : 'History'}
              </button>
              <button className="ghost sm" onClick={async () => { setShowAlertHistory(s => !s); if (!showAlertHistory) await loadAlertHistory(); }}>
                {showAlertHistory ? 'Hide Alerts' : 'Alerts'}
              </button>
              <button className="ghost sm" onClick={loadVoiceConfig}>Config</button>
            </div>
            {voiceTestStatus !== 'idle' && (
              <div style={{ fontSize: 12, marginTop: 6, color: voiceTestStatus === 'ok' ? 'var(--accent)' : voiceTestStatus === 'fail' ? 'red' : 'var(--muted)' }}>
                {voiceTestStatus === 'running' && 'TTS → STT roundtrip…'}
                {voiceTestStatus === 'ok' && `OK: ${voiceTestTranscript}`}
                {voiceTestStatus === 'fail' && `Fail: ${voiceTestError}`}
              </div>
            )}
            {showVoiceHistory && (
              <div style={{ marginTop: 8, maxHeight: 180, overflow: 'auto' }}>
                {voiceHistoryLoading ? <div className="muted">Loading…</div> : voiceHistory.length === 0 ? <div className="muted">No history.</div> : voiceHistory.slice(0, 10).map((h, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed var(--stroke)', fontSize: 12 }}>
                    <strong>{h.ok ? 'OK' : 'FAIL'}</strong> — {new Date(h.ts).toLocaleString()} — {h.transcript || h.error || '—'}
                  </div>
                ))}
              </div>
            )}
            {showAlertHistory && (
              <div style={{ marginTop: 8, maxHeight: 180, overflow: 'auto' }}>
                {alertHistoryLoading ? <div className="muted">Loading…</div> : alertHistory.length === 0 ? <div className="muted">No alerts.</div> : alertHistory.slice(0, 10).map((a, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed var(--stroke)', fontSize: 12 }}>
                    <strong>{(a.level || 'info').toUpperCase()}</strong> — {new Date(a.ts).toLocaleString()} — {a.message}
                  </div>
                ))}
              </div>
            )}
            {voiceConfig && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                <label className="muted">Slack<input value={voiceConfig.slackWebhook || ''} onChange={(e) => setVoiceConfig({ ...voiceConfig, slackWebhook: e.target.value })} placeholder="https://hooks.slack.com/..." /></label>
                <label className="muted">Webhook<input value={voiceConfig.alertWebhook || ''} onChange={(e) => setVoiceConfig({ ...voiceConfig, alertWebhook: e.target.value })} placeholder="https://..." /></label>
                <label className="muted">SMTP host<input value={voiceConfig.smtp?.host || ''} onChange={(e) => setVoiceConfig({ ...voiceConfig, smtp: { ...(voiceConfig.smtp||{}), host: e.target.value } })} /></label>
                <label className="muted">SMTP port<input value={voiceConfig.smtp?.port || ''} onChange={(e) => setVoiceConfig({ ...voiceConfig, smtp: { ...(voiceConfig.smtp||{}), port: Number(e.target.value) } })} /></label>
                <label className="muted">TTS provider<select value={voiceConfig.tts?.provider || 'openai'} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { provider: e.target.value as TtsProvider }))}><option value="openai">OpenAI</option><option value="azure">Azure</option><option value="voicerss">VoiceRSS</option><option value="google">Google</option></select></label>
                <label className="muted">Provider mode<select value={voiceConfig.tts?.strictProvider ? 'strict' : 'fallback'} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { strictProvider: e.target.value === 'strict' }))}><option value="fallback">Allow fallback</option><option value="strict">Strict selected provider</option></select></label>
                <label className="muted">OpenAI voice<input value={voiceConfig.tts?.openai?.defaultVoice || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { openai: { defaultVoice: e.target.value } }))} placeholder="alloy" /></label>
                <label className="muted">OpenAI Arabic voice<input value={voiceConfig.tts?.openai?.arabicVoice || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { openai: { arabicVoice: e.target.value } }))} placeholder="alloy" /></label>
                <label className="muted">OpenAI model<input value={voiceConfig.tts?.openai?.model || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { openai: { model: e.target.value } }))} placeholder="tts-1-hd" /></label>
                <label className="muted">OpenAI Arabic model<input value={voiceConfig.tts?.openai?.arabicModel || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { openai: { arabicModel: e.target.value } }))} placeholder="gpt-4o-mini-tts" /></label>
                <label className="muted">Azure region<input value={voiceConfig.tts?.azure?.region || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { azure: { region: e.target.value } }))} placeholder="eastus" /></label>
                <label className="muted">Azure endpoint<input value={voiceConfig.tts?.azure?.endpoint || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { azure: { endpoint: e.target.value } }))} placeholder="https://eastus.tts.speech.microsoft.com/cognitiveservices/v1" /></label>
                <label className="muted">Azure voice<input value={voiceConfig.tts?.azure?.defaultVoice || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { azure: { defaultVoice: e.target.value } }))} placeholder="en-US-AvaMultilingualNeural" /></label>
                <label className="muted">Azure Arabic voice<input value={voiceConfig.tts?.azure?.arabicVoice || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { azure: { arabicVoice: e.target.value } }))} placeholder="ar-EG-SalmaNeural" /></label>
                <label className="muted">Azure key<input value={voiceConfig.tts?.azure?.apiKey || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { azure: { apiKey: e.target.value } }))} placeholder="*****" /></label>
                <label className="muted">VoiceRSS key<input value={voiceConfig.tts?.voicerss?.apiKey || ''} onChange={(e) => setVoiceConfig(updateVoiceTtsConfig(voiceConfig, { voicerss: { apiKey: e.target.value } }))} placeholder="*****" /></label>
                <button className="ghost sm" onClick={saveVoiceConfig} style={{ gridColumn: 'span 2' }}>Save Config</button>
              </div>
            )}
          </div>
        )}
      </div>

      <DashboardFeatureSettingsCard />

      <DashboardWebUserSettingsCard />

      <div className="card span-4">
        <h3>Queue Overview</h3>
        <div className="queue-list">
          {queues.map((queue) => (
            <div key={queue.name} className="queue-row">
              <div>
                <div className="queue-name">{queue.name}</div>
                <div className="queue-meta">SLA {queue.sla}</div>
              </div>
              <div className="queue-count">{queue.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card span-12">
        <div className="section-head">
          <div>
            <h3>Plugin Operations</h3>
            <p className="muted">Job applications, marketplace activity, and engagement.</p>
          </div>
          <div className="pill">Live</div>
        </div>
        {pluginError ? <div className="alert">{pluginError}</div> : null}
        <div className="metric-row">
          <div className="metric"><div className="metric-label">Job applications</div><div className="metric-value">{plugins?.jobApplicationCount ?? "--"}</div></div>
          <div className="metric"><div className="metric-label">Marketplace listings</div><div className="metric-value">{plugins?.marketplaceCount ?? "--"}</div></div>
        </div>
        <div className="plugin-grid">
          <div className="plugin-panel">
            <div className="panel-title">Latest Applications</div>
            <div className="panel-list">
              {plugins?.jobApplications?.length ? plugins.jobApplications.map((item) => (
                <div key={item.id} className="panel-row">
                  <div><div className="panel-strong">{item.name}</div><div className="panel-meta">{item.phone} • {item.jobId}</div></div>
                  <div className="panel-time">{new Date(item.createdAt).toLocaleTimeString()}</div>
                </div>
              )) : <div className="muted">No applications yet.</div>}
            </div>
          </div>
          <div className="plugin-panel">
            <div className="panel-title">Marketplace Updates</div>
            <div className="panel-list">
              {plugins?.marketplaceListings?.length ? plugins.marketplaceListings.map((item) => (
                <div key={item.id} className="panel-row">
                  <div><div className="panel-strong">{item.title}</div><div className="panel-meta">{item.location} • {item.price} {item.currency}</div></div>
                </div>
              )) : <div className="muted">No listings yet.</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="card span-4">
        <h3>KB Quality</h3>
        {kbStats ? (
          <div className="kb-stats">
            {kbCounts.map((item) => (
              <div key={item.label} className="kb-count"><span>{item.label}</span><strong>{item.value}</strong></div>
            ))}
            <p className="muted">{kbStats.note || "Live KB stats"}</p>
          </div>
        ) : (
          <div className="kb-list">
            {kbFallback.map((metric) => (
              <div key={metric.label} className="kb-row">
                <div className="kb-meta"><span>{metric.label}</span><span>{metric.value}</span></div>
                <div className="progress"><span style={{ width: metric.width }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card span-8">
        <h3>Error Map</h3>
        <p className="muted">Top error clusters from runtime logs.</p>
        <ErrorMapPanel />
      </div>

      <div className="card span-4">
        <h3>Operator Playbook</h3>
        <ul className="playbook">{playbook.map((item) => <li key={item}>{item}</li>)}</ul>
        <button className="accent block">Launch Audit</button>
      </div>

      <div className="card span-7">
        <div className="card-header"><h3>Channel Monitor</h3><span className="tag">Last 15 min</span></div>
        <div className="channel-grid">
          {channels.map((ch) => (
            <div key={ch.name} className="channel">
              <div className="channel-name">{ch.name}</div>
              <div className="channel-stat">{ch.volume} chats</div>
              <div className="channel-stat">{ch.success} success</div>
              <div className="channel-alert">{ch.alert}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card span-5">
        <div className="card-header"><h3>Feedback Radar</h3><span className="tag">Action needed</span></div>
        <div className="feedback-list">
          {feedback.map((item) => (
            <div key={item.topic} className="feedback-row">
              <div><div className="feedback-topic">{item.topic}</div><div className="feedback-note">{item.note}</div></div>
              <div className="feedback-meta"><span>{item.intent}</span><span>{item.time}</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card span-12 actions">
        <div><h3>Next Actions</h3><p className="muted">Schedule or run operational routines.</p></div>
        <div className="action-grid">
          <button className="ghost">Run SLA report</button>
          <button className="ghost">Notify stakeholders</button>
          <button className="ghost">Triage audit flags</button>
          <button className="accent">Start system snapshot</button>
        </div>
      </div>
    </>
  );
}
