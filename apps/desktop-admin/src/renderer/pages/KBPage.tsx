import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export default function KBPage() {
  const [meta, setMeta] = useState<any>(null);
  const [txQuery, setTxQuery] = useState("");
  const [txResults, setTxResults] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);

  // Runtime KB versions / RAG chunk editor state
  const [runtimeVersions, setRuntimeVersions] = useState<any[]>([]);
  const [chunkQuery, setChunkQuery] = useState("");
  const [chunkResults, setChunkResults] = useState<any[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<any | null>(null);
  const [chunkEditText, setChunkEditText] = useState<string>("");
  const [chunkLoading, setChunkLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, ov] = await Promise.all([api.getSalaryMeta(), api.getOverview()]);
        setMeta(m);
        setOverview(ov);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function searchTx() {
    if (!txQuery.trim()) return;
    setErr("");
    try {
      const r = await api.searchTx(txQuery);
      setTxResults(r.results || r || []);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function viewTx(id: string) {
    try {
      const d = await api.getTx(id);
      setSelectedTx(d);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  const [runtimeText, setRuntimeText] = React.useState<string | null>(null);
  const [runtimeMsg, setRuntimeMsg] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [chunkMsg, setChunkMsg] = React.useState<string | null>(null);

  async function loadRuntime() {
    setRuntimeMsg(null);
    try {
      const res = await api.getRuntimeKB();
      if (!res.ok) return setRuntimeMsg(`Error: ${res.error || 'not found'}`);
      setRuntimeText(JSON.stringify(res.kb, null, 2));
      setRuntimeMsg(`Loaded from ${res.path}`);
    } catch (e: any) {
      setRuntimeMsg(String(e.message || e));
    }
  }

  function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setRuntimeText(String(r.result || ''));
    r.readAsText(f, 'utf8');
  }

  function validateRuntime() {
    setRuntimeMsg(null);
    if (!runtimeText) return setRuntimeMsg('No content to validate');
    try {
      const parsed = JSON.parse(runtimeText);
      if (!parsed || typeof parsed !== 'object' || !('kb' in parsed)) {
        return setRuntimeMsg('Invalid runtime KB: top-level "kb" key not found');
      }
      setRuntimeMsg('JSON is valid');
      return true;
    } catch (err: any) {
      setRuntimeMsg(`Invalid JSON: ${err.message}`);
      return false;
    }
  }

  async function saveRuntime() {
    setRuntimeMsg(null);
    if (!runtimeText) return setRuntimeMsg('Nothing to save');
    try {
      const parsed = JSON.parse(runtimeText);
      await api.saveRuntimeKB(parsed);
      setRuntimeMsg('Saved runtime_kb.json to disk');
    } catch (err: any) {
      setRuntimeMsg(`Save failed: ${err.message || String(err)}`);
    }
  }

  async function reloadRuntimePreview() {
    setRuntimeMsg(null);
    try {
      const r = await api.reloadRuntimeKBPreview();
      if (r && r.ok) setRuntimeMsg('Runtime KB loaded into memory (preview)');
      else setRuntimeMsg(`Reload failed: ${r?.error || 'unknown'}`);
    } catch (err: any) {
      setRuntimeMsg(String(err.message || err));
    }
  }

  if (loading) return <div className="page-loading">Loading KB data…</div>;

  return (
    <div className="page kb-page">
      <h1>Knowledge Base Management</h1>

      {err && <div className="page-error">⚠ {err}</div>}

      {/* KB Overview Stats */}
      {overview?.kb && (
        <div className="cards">
          <div className="card stat-card">
            <h4>Transactions</h4>
            <span className="stat-number">{overview.kb.transactions}</span>
          </div>
          <div className="card stat-card">
            <h4>RAG Chunks</h4>
            <span className="stat-number">{overview.kb.ragChunks}</span>
          </div>
          <div className="card stat-card">
            <h4>Law Articles</h4>
            <span className="stat-number">{overview.kb.lawArticles}</span>
          </div>
          <div className="card stat-card">
            <h4>Salary Records</h4>
            <span className="stat-number">{overview.kb.salaryRecords}</span>
          </div>
          <div className="card stat-card">
            <h4>DB Size</h4>
            <span className="stat-number">{overview.kb.dbSizeKb} KB</span>
          </div>
          <div className="card stat-card">
            <h4>Tables</h4>
            <span className="stat-number">{overview.kb.tables.length}</span>
          </div>
        </div>
      )}
      {/* Salary Meta */}
      {meta && (
        <section className="section">
          <h2>Salary Configuration</h2>
          <div className="cards">
            <div className="card">
              <h4>Ranks ({meta.ranks?.length})</h4>
              <div className="tag-list">
                {meta.ranks?.map((r: any) => (
                  <span key={r.rank} className="tag">{r.rank} ({r.category}, max {r.maxDegree}°)</span>
                ))}
              </div>
            </div>
            <div className="card">
              <h4>Family Allowance</h4>
              <p>Wife: {meta.familyAllowance?.wife?.toLocaleString()} LBP</p>
              <p>Per child: {meta.familyAllowance?.perChild?.toLocaleString()} LBP</p>
              <p className="note">Post-raise: Wife {meta.familyAllowanceAfterRaise?.wife?.toLocaleString()} / Child {meta.familyAllowanceAfterRaise?.perChild?.toLocaleString()}</p>
            </div>
            <div className="card">
              <h4>USD Rate</h4>
              <p className="stat-number">{meta.usdRate?.toLocaleString()} LBP</p>
            </div>
            <div className="card">
              <h4>Medals & Decorations ({meta.ornamentChoices?.length})</h4>
              <table>
                <thead><tr><th>Medal</th><th>Monthly</th><th>Annual</th></tr></thead>
                <tbody>
                  {meta.ornamentChoices?.map((o: any) => (
                    <tr key={o.id}>
                      <td>{o.name_ar}</td>
                      <td>{o.monthlyValue?.toLocaleString()}</td>
                      <td>{o.annualValue?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Transaction Search */}
      <section className="section">
        <h2>Transaction Search</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search transactions (e.g. إجازة، ترقية)…"
            value={txQuery}
            onChange={(e) => setTxQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchTx()}
          />
          <button onClick={searchTx}>Search</button>
        </div>
        {txResults.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Title</th><th>Section</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {txResults.map((tx: any, i: number) => (
                <tr key={tx.tx_no || i}>
                  <td>{tx.tx_no}</td>
                  <td>{tx.title}</td>
                  <td>{tx.section}</td>
                  <td><button className="btn-sm" onClick={() => viewTx(tx.tx_no)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Runtime KB editor */}
      <section className="section">
        <h2>Runtime KB (runtime_kb.json)</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={loadRuntime}>Load from disk</button>
          <button onClick={() => fileInputRef.current?.click()}>Upload JSON file</button>
          <button onClick={validateRuntime} disabled={!runtimeText}>Validate</button>
          <button onClick={saveRuntime} disabled={!runtimeText}>Save to disk</button>
          <button onClick={reloadRuntimePreview} disabled={!runtimeText}>Load into memory (preview)</button>
        </div>
        {runtimeMsg && <div className="note">{runtimeMsg}</div>}
        <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onUploadFile} />
        <textarea className="code" value={runtimeText ?? ''} onChange={(e) => setRuntimeText(e.target.value)} rows={18} />

        {/* Versions */}
        <div style={{ marginTop: 12 }}>
          <h3>Versions & Audit</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={async () => {
              try {
                const r = await api.listKBVersions('runtime_kb.json');
                setRuntimeMsg(`Found ${r.versions?.length || 0} version(s)`);
                setRuntimeVersions(r.versions || []);
              } catch (err: any) { setRuntimeMsg(String(err.message || err)); }
            }}>Refresh versions</button>
            <button onClick={async () => { const r = await api.listKBVersions(); setRuntimeVersions(r.versions || []); setRuntimeMsg('Versions refreshed'); }}>All versions</button>
          </div>
          {runtimeVersions.length > 0 && (
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead><tr><th>ID</th><th>File</th><th>Time</th><th>Note</th><th>Actions</th></tr></thead>
              <tbody>
                {runtimeVersions.map((v: any) => (
                  <tr key={v.id}>
                    <td className="mono">{v.id}</td>
                    <td>{v.file}</td>
                    <td>{new Date(v.ts).toLocaleString()}</td>
                    <td>{v.note}</td>
                    <td>
                      <button className="btn-sm" onClick={async () => {
                        try {
                          await api.rollbackKBVersion(v.id);
                          setRuntimeMsg('Rolled back — reloading runtime preview');
                          await loadRuntime();
                        } catch (err: any) { setRuntimeMsg(String(err.message || err)); }
                      }}>Rollback</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* RAG chunk editor */}
        <section style={{ marginTop: 18 }} className="section">
          <h3>RAG Chunks (procedures)</h3>
          <div className="search-bar">
            <input placeholder="Search RAG chunks…" value={chunkQuery} onChange={(e) => setChunkQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (async () => { setChunkLoading(true); try { const r = await api.listRagChunks(chunkQuery, 1, 50); setChunkResults(r.chunks || []); } catch (err: any) { setErr(err.message); } finally { setChunkLoading(false); } })()} />
            <button onClick={async () => { setChunkLoading(true); try { const r = await api.listRagChunks(chunkQuery, 1, 50); setChunkResults(r.chunks || []); } catch (err: any) { setErr(err.message); } finally { setChunkLoading(false); } }}>Search</button>
            <button onClick={async () => { setChunkLoading(true); try { await api.reloadRagChunks(); setChunkMsg('RAG chunks reloaded'); } catch (err: any) { setChunkMsg(String(err.message || err)); } finally { setChunkLoading(false); } }}>Reload chunks</button>
            <button onClick={async () => { setChunkLoading(true); try { await api.saveRagChunks(); setChunkMsg('Chunks saved to disk'); } catch (err: any) { setChunkMsg(String(err.message || err)); } finally { setChunkLoading(false); } }}>Save chunks</button>
          </div>

          {chunkMsg && <div className="note">{chunkMsg}</div>}

          {chunkResults.length > 0 && (
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead><tr><th>ID</th><th>Type</th><th>Title</th><th>Preview</th><th>Actions</th></tr></thead>
              <tbody>
                {chunkResults.map((c: any) => (
                  <tr key={c.id}>
                    <td className="mono">{c.id}</td>
                    <td>{c.chunk_type}</td>
                    <td>{(c.metadata || {}).title_ar || c.title || '—'}</td>
                    <td style={{ maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.text?.slice(0, 160)}</td>
                    <td>
                      <button className="btn-sm" onClick={async () => {
                        try {
                          const r = await api.getRagChunk(c.id);
                          setSelectedChunk(r.chunk);
                          setChunkEditText(r.chunk.text || '');
                        } catch (err: any) { setErr(err.message); }
                      }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Chunk edit modal */}
          {selectedChunk && (
            <div className="modal-overlay" onClick={() => { setSelectedChunk(null); setChunkEditText(''); }}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header"><h3>Edit chunk: {selectedChunk.id}</h3><button onClick={() => { setSelectedChunk(null); setChunkEditText(''); }}>✕</button></div>
                <div className="modal-body">
                  <label>Text</label>
                  <textarea rows={10} value={chunkEditText} onChange={(e) => setChunkEditText(e.target.value)} />
                  <div className="modal-actions">
                    <button className="btn-primary" onClick={async () => {
                      try {
                        const updated = await api.updateRagChunk(selectedChunk.id, { text: chunkEditText });
                        setSelectedChunk(updated.chunk);
                        setChunkMsg('Chunk updated and persisted');
                        setChunkResults((prev) => prev.map((x) => (x.id === updated.chunk.id ? updated.chunk : x)));
                      } catch (err: any) { setChunkMsg(String(err.message || err)); }
                    }}>Save</button>
                    <button onClick={() => { setSelectedChunk(null); setChunkEditText(''); }}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </section>

      {/* Tx Detail Modal */}
      {selectedTx && (
        <div className="modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedTx.title}</h3>
              <button onClick={() => setSelectedTx(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p><strong>TX #:</strong> {selectedTx.tx_no}</p>
              <p><strong>Section:</strong> {selectedTx.section}</p>
              {selectedTx.legal_basis && <p><strong>Legal Basis:</strong> {selectedTx.legal_basis}</p>}
              {selectedTx.required_docs?.length > 0 && (
                <div><strong>Required Docs:</strong>
                  <ul>{selectedTx.required_docs.map((d: any, i: number) => <li key={i}>{typeof d === "string" ? d : d.name}</li>)}</ul>
                </div>
              )}
              {selectedTx.steps?.length > 0 && (
                <div><strong>Steps:</strong>
                  <ol>{selectedTx.steps.map((s: any, i: number) => <li key={i}>{typeof s === "string" ? s : s.description}</li>)}</ol>
                </div>
              )}
              {selectedTx.fees && <p><strong>Fees:</strong> {selectedTx.fees}</p>}
              {selectedTx.phones?.length > 0 && <p><strong>Phones:</strong> {selectedTx.phones.join(", ")}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
