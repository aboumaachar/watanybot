import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

/**
 * KB Studio — Comprehensive KB management integrating .kb_studio features
 * - Manage external sources (folders + URLs)
 * - Trigger KB builds/rebuilds from local and online sources
 * - View build reports and export status
 * - Monitor staging files
 */

interface ExternalSources {
  folders: string[];
  urls: (string | { url: string; [key: string]: any })[];
}

interface BuildReport {
  type: string;
  timestamp: string;
  status: string;
  details: any;
}

export default function KBStudioPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  
  // External sources
  const [sources, setSources] = useState<ExternalSources>({ folders: [], urls: [] });
  const [newFolder, setNewFolder] = useState("");
  const [newUrl, setNewUrl] = useState("");
  
  // Reports
  const [reports, setReports] = useState<BuildReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<BuildReport | null>(null);
  
  // Build status
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState("");
  
  // Manifest/config
  const [manifest, setManifest] = useState<any>(null);

  useEffect(() => {
    loadKBStudioData();
  }, []);

  async function loadKBStudioData() {
    setLoading(true);
    setError("");
    try {
      const [sourcesData, manifestData, reportsData] = await Promise.all([
        api.getKBStudioSources(),
        api.getKBStudioManifest(),
        api.getKBStudioReports()
      ]);
      
      setSources(sourcesData.sources || { folders: [], urls: [] });
      setManifest(manifestData.manifest || {});
      setReports(reportsData.reports || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addFolder() {
    if (!newFolder.trim()) return;
    try {
      const result = await api.addKBStudioFolder(newFolder);
      setSources(result.sources || { folders: [], urls: [] });
      setNewFolder("");
      setMessage("✓ Folder added");
      setTimeout(() => setMessage(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function removeFolder(folder: string) {
    try {
      const result = await api.removeKBStudioFolder(folder);
      setSources(result.sources || { folders: [], urls: [] });
      setMessage("✓ Folder removed");
      setTimeout(() => setMessage(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function addUrl() {
    if (!newUrl.trim()) return;
    try {
      const result = await api.addKBStudioUrl(newUrl);
      setSources(result.sources || { folders: [], urls: [] });
      setNewUrl("");
      setMessage("✓ URL added");
      setTimeout(() => setMessage(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function removeUrl(urlStr: string) {
    try {
      const result = await api.removeKBStudioUrl(urlStr);
      setSources(result.sources || { folders: [], urls: [] });
      setMessage("✓ URL removed");
      setTimeout(() => setMessage(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function triggerScan() {
    setBuilding(true);
    setBuildProgress("Scanning sources...");
    setError("");
    try {
      const result = await api.triggerKBScan();
      setBuildProgress(result.message || "Scan complete");
      await loadKBStudioData(); // Refresh reports
      setMessage("✓ Scan completed successfully");
      setTimeout(() => setMessage(""), 5000);
    } catch (e: any) {
      setError(`Scan failed: ${e.message}`);
    } finally {
      setBuilding(false);
      setBuildProgress("");
    }
  }

  async function triggerIngest() {
    setBuilding(true);
    setBuildProgress("Ingesting files...");
    setError("");
    try {
      const result = await api.triggerKBIngest();
      setBuildProgress(result.message || "Ingest complete");
      await loadKBStudioData();
      setMessage("✓ Ingest completed successfully");
      setTimeout(() => setMessage(""), 5000);
    } catch (e: any) {
      setError(`Ingest failed: ${e.message}`);
    } finally {
      setBuilding(false);
      setBuildProgress("");
    }
  }

  async function triggerExport() {
    setBuilding(true);
    setBuildProgress("Exporting KB...");
    setError("");
    try {
      const result = await api.triggerKBExport();
      setBuildProgress(result.message || "Export complete");
      await loadKBStudioData();
      setMessage("✓ Export completed successfully");
      setTimeout(() => setMessage(""), 5000);
    } catch (e: any) {
      setError(`Export failed: ${e.message}`);
    } finally {
      setBuilding(false);
      setBuildProgress("");
    }
  }

  async function triggerFullRebuild() {
    if (!confirm("This will rebuild the entire KB from scratch. Continue?")) return;
    
    setBuilding(true);
    setBuildProgress("Starting full rebuild...");
    setError("");
    try {
      const result = await api.triggerKBFullRebuild();
      setBuildProgress(result.message || "Rebuild complete");
      await loadKBStudioData();
      setMessage("✓ Full rebuild completed successfully");
      setTimeout(() => setMessage(""), 5000);
    } catch (e: any) {
      setError(`Rebuild failed: ${e.message}`);
    } finally {
      setBuilding(false);
      setBuildProgress("");
    }
  }

  async function selectFolderDialog() {
    if (window.electronAPI?.selectFolder) {
      const result = await window.electronAPI.selectFolder();
      if (result) {
        setNewFolder(result);
      }
    } else {
      alert("Folder selection requires Electron desktop app");
    }
  }

  if (loading) {
    return <div className="page-loading">Loading KB Studio...</div>;
  }

  return (
    <div className="page kb-studio-page">
      <div className="page-header">
        <h1>🏗️ KB Studio</h1>
        <p className="subtitle">Build and rebuild knowledge base from local and online sources</p>
      </div>

      {error && <div className="page-error">⚠ {error}</div>}
      {message && <div className="page-success">{message}</div>}
      {buildProgress && <div className="build-progress">🔄 {buildProgress}</div>}

      {/* Build Actions */}
      <section className="section">
        <h2>⚡ Build Actions</h2>
        <div className="build-actions-grid">
          <div className="action-card">
            <h3>1️⃣ Scan Sources</h3>
            <p>Scan all configured folders and URLs for changes</p>
            <button 
              className="btn-primary"
              onClick={triggerScan}
              disabled={building}
            >
              {building ? "⏳ Building..." : "🔍 Scan Now"}
            </button>
          </div>

          <div className="action-card">
            <h3>2️⃣ Ingest Files</h3>
            <p>Process scanned files (OCR, transcribe, extract)</p>
            <button 
              className="btn-primary"
              onClick={triggerIngest}
              disabled={building}
            >
              {building ? "⏳ Building..." : "📥 Ingest Now"}
            </button>
          </div>

          <div className="action-card">
            <h3>3️⃣ Export KB</h3>
            <p>Generate chunks and runtime KB JSON</p>
            <button 
              className="btn-primary"
              onClick={triggerExport}
              disabled={building}
            >
              {building ? "⏳ Building..." : "📤 Export Now"}
            </button>
          </div>

          <div className="action-card highlight-card">
            <h3>🔄 Full Rebuild</h3>
            <p>Scan + Ingest + Export (complete pipeline)</p>
            <button 
              className="btn-danger"
              onClick={triggerFullRebuild}
              disabled={building}
            >
              {building ? "⏳ Building..." : "🚀 Full Rebuild"}
            </button>
          </div>
        </div>
      </section>

      {/* External Sources */}
      <section className="section">
        <h2>📁 External Sources</h2>
        
        {/* Folders */}
        <div className="sources-section">
          <h3>Local Folders</h3>
          <div className="source-input-group">
            <input
              type="text"
              placeholder="C:\path\to\folder"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFolder()}
            />
            <button onClick={selectFolderDialog}>📂 Browse...</button>
            <button onClick={addFolder} className="btn-success">+ Add Folder</button>
          </div>
          
          <div className="sources-list">
            {sources.folders.length === 0 ? (
              <div className="empty-state">No folders configured</div>
            ) : (
              sources.folders.map((folder, i) => (
                <div key={i} className="source-item">
                  <span className="source-path">📁 {folder}</span>
                  <button 
                    className="btn-remove"
                    onClick={() => removeFolder(folder)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* URLs */}
        <div className="sources-section">
          <h3>Online URLs</h3>
          <div className="source-input-group">
            <input
              type="text"
              placeholder="https://example.com/page"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
            />
            <button onClick={addUrl} className="btn-success">+ Add URL</button>
          </div>
          
          <div className="sources-list">
            {sources.urls.length === 0 ? (
              <div className="empty-state">No URLs configured</div>
            ) : (
              sources.urls.map((urlItem, i) => {
                const urlStr = typeof urlItem === 'string' ? urlItem : urlItem.url;
                return (
                  <div key={i} className="source-item">
                    <span className="source-path">🌐 {urlStr}</span>
                    <button 
                      className="btn-remove"
                      onClick={() => removeUrl(urlStr)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Build Reports */}
      <section className="section">
        <h2>📊 Build Reports</h2>
        <div className="reports-grid">
          {reports.length === 0 ? (
            <div className="empty-state">No build reports available</div>
          ) : (
            reports.map((report, i) => (
              <div key={i} className="report-card" onClick={() => setSelectedReport(report)}>
                <div className="report-header">
                  <span className="report-type">{report.type}</span>
                  <span className={`report-status status-${report.status}`}>
                    {report.status}
                  </span>
                </div>
                <div className="report-timestamp">
                  {new Date(report.timestamp).toLocaleString()}
                </div>
                <div className="report-summary">
                  {report.details?.files_scanned && `📄 ${report.details.files_scanned} files`}
                  {report.details?.chunks_created && ` • 📦 ${report.details.chunks_created} chunks`}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Manifest Settings */}
      {manifest && (
        <section className="section">
          <h2>⚙️ Configuration</h2>
          <div className="config-grid">
            <div className="config-item">
              <label>Active Profile:</label>
              <span>{manifest.active_profile}</span>
            </div>
            <div className="config-item">
              <label>Chunk Size:</label>
              <span>{manifest.profiles?.default?.export?.chunk_chars} chars</span>
            </div>
            <div className="config-item">
              <label>OCR Enabled:</label>
              <span>{manifest.profiles?.default?.ocr?.enabled ? "✓ Yes" : "✗ No"}</span>
            </div>
            <div className="config-item">
              <label>Transcribe Model:</label>
              <span>{manifest.profiles?.default?.transcribe?.model}</span>
            </div>
          </div>
        </section>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Report: {selectedReport.type}</h3>
              <button onClick={() => setSelectedReport(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="report-detail">
                <p><strong>Status:</strong> {selectedReport.status}</p>
                <p><strong>Timestamp:</strong> {new Date(selectedReport.timestamp).toLocaleString()}</p>
                <pre className="report-json">
                  {JSON.stringify(selectedReport.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
