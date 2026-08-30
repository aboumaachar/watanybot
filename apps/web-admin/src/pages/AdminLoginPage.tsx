import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SERVERS } from "../lib/api";

const LOCAL_URL = SERVERS[0].url;
const PROD_URL = SERVERS[1].url;

function getInitialServer(): string {
  const storedUrl = localStorage.getItem("admin_api_url");
  if (storedUrl === "http://localhost:8010") {
    localStorage.setItem("admin_api_url", LOCAL_URL);
    return LOCAL_URL;
  }
  return storedUrl || LOCAL_URL;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid #334155", background: "#0f172a",
  color: "#f1f5f9", fontSize: 14, outline: "none",
  boxSizing: "border-box",
};

export default function AdminLoginPage({ onLogin }: Readonly<{ onLogin: () => void }>) {
  const navigate = useNavigate();
  const [server, setServer] = useState<string>(getInitialServer);
  const [customUrl, setCustomUrl] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeUrl = useCustom ? customUrl.trim() : server;
  const allowDevAdminFallback = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_ADMIN_FALLBACK === "true";
  const emailPlaceholder = activeUrl === PROD_URL ? "koudama@koudama.com" : "admin@example.com";

  const handleServerChange = (url: string) => {
    setServer(url);
    setUseCustom(false);
    setError("");
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!activeUrl) { setError("Server URL is required"); return; }
    setError("");
    setLoading(true);

    // Persist chosen server URL so all subsequent adminFetch calls use it
    localStorage.setItem("admin_api_url", activeUrl);

    try {
      const res = await fetch(`${activeUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      localStorage.setItem("admin_token", data.accessToken);
      onLogin();
      navigate("/", { replace: true });
    } catch {
      setError("Cannot reach server — check URL and network");
    } finally {
      setLoading(false);
    }
  };

  const dotColor = activeUrl === LOCAL_URL ? "#34d399" : "#f59e0b";

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0f172a", fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "#1e293b", borderRadius: 16, padding: 40,
        width: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🛡️</div>
          <h1 style={{ color: "#f1f5f9", fontSize: 22, margin: 0 }}>Watany Ops</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "4px 0 0" }}>Admin Control Room</p>
        </div>

        {/* Server selector */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="server-url" style={{ display: "block", color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>Server</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {SERVERS.map(s => (
              <button
                key={s.url}
                type="button"
                onClick={() => handleServerChange(s.url)}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s",
                  background: !useCustom && server === s.url ? "#6366f1" : "#0f172a",
                  color: !useCustom && server === s.url ? "#fff" : "#94a3b8",
                  border: `1px solid ${!useCustom && server === s.url ? "#6366f1" : "#334155"}`,
                }}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setUseCustom(true); setError(""); }}
              style={{
                flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
                background: useCustom ? "#6366f1" : "#0f172a",
                color: useCustom ? "#fff" : "#94a3b8",
                border: `1px solid ${useCustom ? "#6366f1" : "#334155"}`,
              }}
            >
              Custom
            </button>
          </div>

          {useCustom ? (
            <input              id="server-url"              type="url"
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              placeholder="https://example.com/api"
              style={inputStyle}
            />
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderRadius: 8, background: "#0f172a",
              border: "1px solid #334155",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
              <span style={{ color: "#64748b", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeUrl}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="login-email" style={{ display: "block", color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder={emailPlaceholder}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="login-password" style={{ display: "block", color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              color: "#f87171", background: "rgba(239,68,68,0.1)",
              padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 8,
              background: loading ? "#475569" : "#6366f1", color: "#fff",
              border: "none", fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          {activeUrl === LOCAL_URL && allowDevAdminFallback && (
            <p style={{ textAlign: "center", color: "#475569", fontSize: 11, marginTop: 12, marginBottom: 0 }}>
              Local dev fallback is enabled only for this machine in development mode.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
