import React, { useEffect, useState, useCallback } from "react";
import * as api from "../lib/api";

const EDITABLE_FIELDS = [
  { key: "basicSalary", label: "Basic Salary", group: "core" },
  { key: "degreeValue", label: "Degree Step", group: "core" },
  { key: "vetSalary", label: "Vet Salary", group: "core" },
  { key: "equipment", label: "Equipment", group: "core" },
  { key: "driver", label: "Driver", group: "core" },
  { key: "position", label: "Position", group: "core" },
  { key: "grant2025", label: "Grant 2025", group: "aids" },
  { key: "d13020", label: "Dec. 13020", group: "aids" },
  { key: "d11227_2", label: "Dec. 11227/2", group: "aids" },
  { key: "d11227_1", label: "Dec. 11227/1", group: "aids" },
  { key: "budget2022", label: "Budget 2022", group: "aids" },
  { key: "val2019", label: "Val 2019", group: "ref" },
  { key: "pension2026", label: "Pension 2026", group: "computed" },
  { key: "pension2026usd", label: "Pension USD", group: "computed" },
  { key: "val2019usd", label: "Val 2019 USD", group: "computed" },
  { key: "pct2019", label: "% of 2019", group: "computed" },
  { key: "sixSalary", label: "6× Additional Grant", group: "computed" },
  { key: "totalSalary2026usd", label: "Total 2026 USD", group: "computed" },
  { key: "sixPct", label: "6× % of 2019", group: "computed" },
  { key: "fiftyPct", label: "50% Additional Target", group: "computed" },
];

const CORE_FIELDS = EDITABLE_FIELDS.filter((f) => f.group === "core" || f.group === "aids");
const ALL_FIELDS = EDITABLE_FIELDS;

function formatEntryValue(entry: Record<string, unknown>, field: { key: string; group: string }) {
  const value = entry[field.key];
  if (value == null) {
    return "—";
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value !== "number") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  const isPctField = field.group === "computed" && (field.key.includes("Pct") || field.key.includes("pct"));
  if (isPctField) {
    return `${(value * 100).toFixed(1)}%`;
  }

  return value.toLocaleString();
}

export default function SalaryEditorPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterRank, setFilterRank] = useState("");
  const [ranks, setRanks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(new Set<string>());
  const [showComputed, setShowComputed] = useState(false);

  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [r, meta] = await Promise.all([
        api.getSalaryEntries(filterRank, page, pageSize),
        api.getKBRules(),
      ]);
      setEntries(r.entries || []);
      setTotal(r.total || 0);
      setRanks((meta.rules?.ranks || []).map((r: any) => r.rank));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterRank, page]);

  useEffect(() => { load(); }, [load]);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 3000); }

  function startEdit(entry: any) {
    setEditingKey(entry.key);
    setEditData({ ...entry });
  }

  function updateField(field: string, value: string) {
    setEditData((prev: any) => ({ ...prev, [field]: Number(value) }));
  }

  async function saveEntry() {
    if (!editingKey || !editData) return;
    setSaving(true);
    try {
      const entryKey = editingKey;
      const patch: any = {};
      for (const f of ALL_FIELDS) {
        if (editData[f.key] != null) patch[f.key] = editData[f.key];
      }
      await api.updateSalaryEntry(entryKey, patch);
      setDirty((prev) => new Set([...prev, entryKey]));
      flash(`Updated ${entryKey} (in memory) ✓`);
      setEditingKey(null);
      setEditData(null);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function persistAll() {
    try {
      await api.saveKB();
      setDirty(new Set());
      flash("All changes persisted to disk ✓");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function recalcAll() {
    try {
      const r = await api.recalculateKB();
      flash(r.message + " ✓");
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="page salary-editor-page">
      <div className="page-header">
        <h1>Salary Data Editor</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {dirty.size > 0 && (
            <span className="tag dirty-tag">{dirty.size} unsaved changes</span>
          )}
          <button className="btn-sm" onClick={recalcAll} title="Recalculate derived columns">🔢 Recalculate</button>
          <button className="btn-primary" onClick={persistAll} disabled={dirty.size === 0}>💾 Save All to Disk</button>
        </div>
      </div>

      {err && <div className="page-error">⚠ {err}</div>}
      {msg && <div className="flash-msg">{msg}</div>}

      {/* Filters */}
      <div className="editor-toolbar">
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={filterRank} onChange={(e) => { setFilterRank(e.target.value); setPage(1); }}>
            <option value="">All Ranks</option>
            {ranks.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="note" style={{ alignSelf: "center" }}>
            Showing {entries.length} of {total} · Page {page}/{totalPages || 1}
          </span>
          <label className="checkbox-label" style={{ marginLeft: "auto", margin: 0 }}>
            <input type="checkbox" checked={showComputed} onChange={(e) => setShowComputed(e.target.checked)} />
            <span>Show computed columns</span>
          </label>
        </div>
      </div>

      {/* Data table */}
      <div className="table-scroll">
        <table className="data-table salary-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Rank</th>
              <th>Deg</th>
              <th>Category</th>
              {(showComputed ? ALL_FIELDS : CORE_FIELDS).map((f) => (
                <th key={f.key} title={f.key}>{f.label}</th>
              ))}
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.key} className={dirty.has(e.key) ? "row-dirty" : ""}>
                <td className="mono" style={{ fontSize: 11 }}>{e.key}</td>
                <td>{e.rank}</td>
                <td>{e.degree}</td>
                <td style={{ fontSize: 11 }}>{e.category}</td>
                {(showComputed ? ALL_FIELDS : CORE_FIELDS).map((f) => (
                  <td key={f.key} className="num-cell">
                    {formatEntryValue(e as Record<string, unknown>, f)}
                  </td>
                ))}
                <td>
                  <button className="btn-sm" onClick={() => startEdit(e)}>✏️</button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr><td colSpan={99} style={{ textAlign: "center", opacity: 0.5 }}>No entries found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
        <span>Page {page} of {totalPages || 1}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
      </div>

      {/* Edit modal */}
      {editingKey && editData && (
        <div className="modal-overlay">
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Close salary editor"
            onClick={() => { setEditingKey(null); setEditData(null); }}
          />
          <div className="modal modal-wide">
            <div className="modal-header">
              <h3>Edit: {editingKey}</h3>
              <button onClick={() => { setEditingKey(null); setEditData(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="edit-grid">
                <div className="edit-section">
                  <h4>Core Values</h4>
                  {CORE_FIELDS.map((f) => (
                    <div key={f.key} className="edit-field">
                      <label>{f.label}</label>
                      <input
                        type="number"
                        value={editData[f.key] ?? 0}
                        onChange={(e) => updateField(f.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="edit-section">
                  <h4>Computed (auto-updated on recalculate)</h4>
                  {EDITABLE_FIELDS.filter((f) => f.group === "computed" || f.group === "ref").map((f) => (
                    <div key={f.key} className="edit-field">
                      <label>{f.label}</label>
                      <input
                        type="number"
                        value={editData[f.key] ?? 0}
                        onChange={(e) => updateField(f.key, e.target.value)}
                        className="computed-input"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn-sm" onClick={async () => {
                  // Add current edited salary entry as a training example
                  if (!editingKey || !editData) return;
                  try {
                    const calc = await api.salaryCalc({ rank: editData.rank, degree: editData.degree });
                    const userPrompt = `ما هو معاش رتبة ${editData.rank} درجة ${editData.degree}؟`;
                    const assistant = `Basic: ${calc.breakdown?.basicSalary?.toLocaleString() || '—'} LBP · Pension 2026: ${calc.breakdown?.pension2026?.toLocaleString() || '—'} LBP · Deduction 1.5%: ${calc.breakdown?.deduction15Pct?.toLocaleString() || '—'} LBP (≈ $${calc.totalPensionUsd?.toFixed(2) || '—'})`;
                    await api.addAiTraining({ input: userPrompt, output: assistant, source: 'salary-row' });
                    flash('Added training example from this salary row');
                  } catch (err: any) { setErr(String(err.message || err)); }
                }}>➕ Add to training set</button>
                <button className="btn-primary" onClick={saveEntry} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => { setEditingKey(null); setEditData(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
