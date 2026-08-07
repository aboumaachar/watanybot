import { useState, useEffect, useCallback } from "react";
import type { FilterRule } from "@watany/types";
import { adminFetch } from "../lib/api";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const ACTIONS = ["warn", "redact", "block"] as const;

const emptyRule: Omit<FilterRule, "id"> = {
  name: "",
  description: "",
  pattern: "",
  severity: "medium",
  action: "warn",
  enabled: true,
};

export default function RulesPage() {
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<FilterRule, "id">>(emptyRule);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/rules");
      const body = await res.json();
      setRules(body.rules ?? []);
    } catch (err) {
      console.error("Failed to load rules", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(rule: FilterRule) {
    setEditingId(rule.id);
    setDraft({ name: rule.name, description: rule.description, pattern: rule.pattern, severity: rule.severity, action: rule.action, enabled: rule.enabled });
    setCreating(false);
  }

  function startCreate() {
    setEditingId(null);
    setDraft({ ...emptyRule });
    setCreating(true);
  }

  function cancel() {
    setEditingId(null);
    setCreating(false);
  }

  async function save() {
    try {
      if (creating) {
        await adminFetch("/api/admin/rules", {
          method: "POST",
          body: JSON.stringify(draft),
        });
      } else if (editingId) {
        await adminFetch(`/api/admin/rules/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(draft),
        });
      }
      cancel();
      load();
    } catch (err) {
      console.error("Save failed", err);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this rule?")) return;
    try {
      await adminFetch(`/api/admin/rules/${id}`, {
        method: "DELETE",
      });
      load();
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  async function toggleEnabled(rule: FilterRule) {
    try {
      await adminFetch(`/api/admin/rules/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
      });
      load();
    } catch (err) {
      console.error("Toggle failed", err);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Content Filter Rules</h2>
        <p className="muted">Manage regex-based content filtering and moderation rules.</p>
      </div>

      <div className="toolbar">
        <button className="accent" onClick={startCreate}>
          + Add Rule
        </button>
        <button className="ghost" onClick={load}>
          Refresh
        </button>
      </div>

      {/* Create/Edit form */}
      {(creating || editingId) && (
        <div className="card rule-form">
          <h3>{creating ? "New Rule" : "Edit Rule"}</h3>
          <div className="form-grid">
            <div>
              <label>Name</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label>Description</label>
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="span-full">
              <label>Regex Pattern</label>
              <input value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} className="mono" />
            </div>
            <div>
              <label>Severity</label>
              <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as FilterRule["severity"] })}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Action</label>
              <select value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value as FilterRule["action"] })}>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label>
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                {" "}Enabled
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button className="accent" onClick={save}>Save</button>
            <button className="ghost" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* Rules table */}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pattern</th>
              <th>Severity</th>
              <th>Action</th>
              <th>Enabled</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="muted center">Loading…</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={6} className="muted center">No rules configured.</td></tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id} className={r.enabled ? "" : "disabled-row"}>
                  <td className="strong">{r.name}</td>
                  <td className="mono truncate">{r.pattern}</td>
                  <td><span className={`severity-badge ${r.severity}`}>{r.severity}</span></td>
                  <td><span className={`action-badge ${r.action}`}>{r.action}</span></td>
                  <td>
                    <button className="ghost sm" onClick={() => toggleEnabled(r)}>
                      {r.enabled ? "On" : "Off"}
                    </button>
                  </td>
                  <td>
                    <button className="ghost sm" onClick={() => startEdit(r)}>Edit</button>
                    <button className="ghost sm danger" onClick={() => remove(r.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
