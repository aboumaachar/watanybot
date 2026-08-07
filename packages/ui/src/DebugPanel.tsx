/**
 * Debug Panel Component
 * Visual debug console for React apps
 */

import { useState, useEffect } from "react";
import { debugClient } from "@watany/shared/debug-client";

interface DebugPanelProps {
  position?: "bottom" | "right";
  defaultOpen?: boolean;
}

export function DebugPanel({
  position = "bottom",
  defaultOpen = false,
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<
    "logs" | "performance" | "stats" | "query"
  >("logs");
  const [logs, setLogs] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryType, setQueryType] = useState("kb-check");
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (autoRefresh) {
      debugClient.startAutoRefresh((data) => {
        setLogs(data.logs.logs || []);
        setStats(data.stats.stats || null);
      }, 2000);
    } else {
      debugClient.stopAutoRefresh();
    }

    return () => debugClient.stopAutoRefresh();
  }, [autoRefresh]);

  const fetchLogs = async () => {
    const result = await debugClient.getLogs({ limit: 50 });
    setLogs(result.logs);
  };

  const fetchPerformance = async () => {
    const result = await debugClient.getPerformance({ limit: 50 });
    setPerformance(result.performance);
  };

  const fetchStats = async () => {
    const result = await debugClient.getStats();
    setStats(result.stats);
  };

  const executeQuery = async () => {
    const result = await debugClient.query(queryType);
    setQueryResult(result);
  };

  const clearLogs = async () => {
    await debugClient.clearLogs();
    await fetchLogs();
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === "logs") fetchLogs();
      if (activeTab === "performance") fetchPerformance();
      if (activeTab === "stats") fetchStats();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: "10px",
          right: "10px",
          padding: "8px 16px",
          background: "#1a1a1a",
          color: "#00ff00",
          border: "1px solid #00ff00",
          borderRadius: "4px",
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: "12px",
          zIndex: 10000,
        }}
      >
        🔍 Debug Console
      </button>
    );
  }

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    [position === "bottom" ? "bottom" : "right"]: 0,
    [position === "bottom" ? "left" : "top"]: 0,
    [position === "bottom" ? "width" : "height"]: "100%",
    [position === "bottom" ? "height" : "width"]: "400px",
    background: "#1a1a1a",
    color: "#ffffff",
    borderTop: position === "bottom" ? "2px solid #00ff00" : "none",
    borderLeft: position === "right" ? "2px solid #00ff00" : "none",
    display: "flex",
    flexDirection: "column",
    zIndex: 10000,
    fontFamily: "monospace",
    fontSize: "11px",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px",
    background: "#000",
    borderBottom: "1px solid #333",
  };

  const tabStyle: React.CSSProperties = {
    display: "flex",
    gap: "5px",
    padding: "5px 10px",
    background: "#000",
    borderBottom: "1px solid #333",
  };

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 10px",
    background: active ? "#00ff00" : "#333",
    color: active ? "#000" : "#fff",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
    fontSize: "11px",
  });

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: "auto",
    padding: "10px",
  };

  const logLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "#ff0000";
      case "warn":
        return "#ffaa00";
      case "info":
        return "#00aaff";
      case "debug":
        return "#ff00ff";
      default:
        return "#ffffff";
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: "#00ff00", fontWeight: "bold" }}>
            🔍 Watany Debug Console
          </span>
          <label style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "5px" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: "transparent",
            color: "#fff",
            border: "1px solid #666",
            borderRadius: "3px",
            cursor: "pointer",
            padding: "3px 8px",
          }}
        >
          ✕
        </button>
      </div>

      <div style={tabStyle}>
        <button
          onClick={() => setActiveTab("logs")}
          style={tabButtonStyle(activeTab === "logs")}
        >
          Logs
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          style={tabButtonStyle(activeTab === "performance")}
        >
          Performance
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          style={tabButtonStyle(activeTab === "stats")}
        >
          Stats
        </button>
        <button
          onClick={() => setActiveTab("query")}
          style={tabButtonStyle(activeTab === "query")}
        >
          Query
        </button>
      </div>

      <div style={contentStyle}>
        {activeTab === "logs" && (
          <div>
            <div style={{ marginBottom: "10px" }}>
              <button
                onClick={clearLogs}
                style={{
                  padding: "5px 10px",
                  background: "#ff0000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                  marginRight: "5px",
                }}
              >
                Clear Logs
              </button>
              <button
                onClick={fetchLogs}
                style={{
                  padding: "5px 10px",
                  background: "#00aaff",
                  color: "#fff",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>
            {logs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: "8px",
                  padding: "5px",
                  background: "#222",
                  borderLeft: `3px solid ${logLevelColor(log.level)}`,
                }}
              >
                <div style={{ color: logLevelColor(log.level) }}>
                  [{log.level.toUpperCase()}] {log.timestamp}
                </div>
                <div style={{ marginTop: "3px" }}>{log.message}</div>
                {log.data && (
                  <pre
                    style={{
                      marginTop: "5px",
                      fontSize: "10px",
                      color: "#aaa",
                    }}
                  >
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "performance" && (
          <div>
            <button
              onClick={fetchPerformance}
              style={{
                padding: "5px 10px",
                background: "#00aaff",
                color: "#fff",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                marginBottom: "10px",
              }}
            >
              Refresh
            </button>
            {performance.map((metric, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: "8px",
                  padding: "5px",
                  background: "#222",
                  borderLeft: `3px solid ${
                    metric.duration > 1000 ? "#ff0000" : "#00ff00"
                  }`,
                }}
              >
                <div>
                  {metric.method} {metric.route}
                </div>
                <div style={{ color: "#aaa", fontSize: "10px" }}>
                  {metric.duration}ms | Status: {metric.statusCode} |{" "}
                  {metric.timestamp}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "stats" && (
          <div>
            <button
              onClick={fetchStats}
              style={{
                padding: "5px 10px",
                background: "#00aaff",
                color: "#fff",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                marginBottom: "10px",
              }}
            >
              Refresh
            </button>
            {stats && (
              <pre style={{ color: "#00ff00" }}>
                {JSON.stringify(stats, null, 2)}
              </pre>
            )}
          </div>
        )}

        {activeTab === "query" && (
          <div>
            <div style={{ marginBottom: "10px" }}>
              <select
                value={queryType}
                onChange={(e) => setQueryType(e.target.value)}
                style={{
                  padding: "5px",
                  background: "#333",
                  color: "#fff",
                  border: "1px solid #666",
                  borderRadius: "3px",
                  marginRight: "5px",
                }}
              >
                <option value="kb-check">KB Check</option>
                <option value="salary-check">Salary Check</option>
                <option value="env-check">Environment Check</option>
                <option value="memory-check">Memory Check</option>
                <option value="routes-check">Routes Check</option>
                <option value="discrepancy-check">Discrepancy Check</option>
              </select>
              <button
                onClick={executeQuery}
                style={{
                  padding: "5px 10px",
                  background: "#00ff00",
                  color: "#000",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                Execute
              </button>
            </div>
            {queryResult && (
              <pre style={{ color: "#00ff00", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(queryResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
