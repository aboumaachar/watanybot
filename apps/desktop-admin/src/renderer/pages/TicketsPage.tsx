import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

const TYPE_LABELS: Record<string, string> = {
  dependents: "Dependents (إعالة)",
  death_inheritance: "Death/Inheritance (وفاة/إرث)",
  medical: "Medical (طبي)",
  schooling: "Schooling (تعليم)",
  pension_payment: "Pension (معاش)",
  other: "Other (أخرى)",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  in_progress: "#f59e0b",
  resolved: "#22c55e",
  closed: "#6b7280",
};

export default function TicketsPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  // New case form
  const [newType, setNewType] = useState("other");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await api.getCases();
      setCases(Array.isArray(r) ? r : r.cases || []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newSubject.trim()) return;
    try {
      await api.createCase({ type: newType, subject: newSubject, body: newBody });
      setShowCreate(false);
      setNewSubject("");
      setNewBody("");
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await api.updateCase(id, { status });
      load();
      if (selected?.id === id) setSelected({ ...selected, status });
    } catch (e: any) {
      setErr(e.message);
    }
  }

  const filtered = filter === "all" ? cases : cases.filter((c) => c.status === filter);
  const counts = {
    all: cases.length,
    open: cases.filter((c) => c.status === "open").length,
    in_progress: cases.filter((c) => c.status === "in_progress").length,
    resolved: cases.filter((c) => c.status === "resolved").length,
    closed: cases.filter((c) => c.status === "closed").length,
  };

  if (loading && cases.length === 0) return <div className="page-loading">Loading tickets…</div>;

  return (
    <div className="page tickets-page">
      <div className="page-header">
        <h1>Tickets & Cases</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Ticket</button>
      </div>

      {err && <div className="page-error">⚠ {err}</div>}

      {/* Filter tabs */}
      <div className="tab-bar">
        {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
          <button
            key={s}
            className={`tab ${filter === s ? "active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s.replace("_", " ")} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id}>
              <td className="mono">{c.id?.slice(0, 8)}</td>
              <td>{TYPE_LABELS[c.type] || c.type}</td>
              <td>{c.subject}</td>
              <td>
                <span className="status-dot" style={{ background: STATUS_COLORS[c.status] || "#aaa" }} />
                {c.status?.replace("_", " ")}
              </td>
              <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</td>
              <td>
                <button className="btn-sm" onClick={() => setSelected(c)}>View</button>
                {c.status === "open" && (
                  <button className="btn-sm" onClick={() => handleStatusChange(c.id, "in_progress")}>Start</button>
                )}
                {c.status === "in_progress" && (
                  <button className="btn-sm btn-success" onClick={() => handleStatusChange(c.id, "resolved")}>Resolve</button>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: "center", opacity: 0.5 }}>No tickets found</td></tr>
          )}
        </tbody>
      </table>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Ticket</h3>
              <button onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label>Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <label>Subject</label>
              <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Brief title…" />
              <label>Description</label>
              <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={4} placeholder="Details…" />
              <div className="modal-actions">
                <button className="btn-primary" onClick={handleCreate}>Create</button>
                <button onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selected.subject}</h3>
              <button onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p><strong>ID:</strong> {selected.id}</p>
              <p><strong>Type:</strong> {TYPE_LABELS[selected.type] || selected.type}</p>
              <p><strong>Status:</strong> {selected.status}</p>
              <p><strong>Created:</strong> {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"}</p>
              {selected.body && <p><strong>Body:</strong> {selected.body}</p>}
              <div className="modal-actions">
                <select
                  value={selected.status}
                  onChange={(e) => handleStatusChange(selected.id, e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
