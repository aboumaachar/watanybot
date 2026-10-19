import { useState, useEffect, useCallback } from "react";
import type { FilterRule } from "@watany/types";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminErrorState, AdminPageSection, AdminNotice } from "../components/admin/AdminPrimitives";

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch("/api/admin/rules");
      const body = await res.json();
      setRules(body.rules ?? []);
    } catch (err) {
      setError(getAdminErrorMessage(err, "Unable to load content rules."));
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
    setError("");
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
      setMessage(creating ? "Rule created." : "Rule updated.");
      await load();
    } catch (err) {
      setError(getAdminErrorMessage(err, "Unable to save this rule."));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this rule?")) return;
    try {
      await adminFetch(`/api/admin/rules/${id}`, {
        method: "DELETE",
      });
      setMessage("تم حذف القاعدة.");
      await load();
    } catch (err) {
      setError(getAdminErrorMessage(err, "تعذر حذف هذه القاعدة."));
    }
  }

  async function toggleEnabled(rule: FilterRule) {
    try {
      await adminFetch(`/api/admin/rules/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
      });
      setMessage(rule.enabled ? "تم تعطيل القاعدة." : "تم تفعيل القاعدة.");
      await load();
    } catch (err) {
      setError(getAdminErrorMessage(err, "تعذر تغيير حالة القاعدة."));
    }
  }

  return (
    <AdminPageSection title="قواعد تصفية المحتوى" description="قواعد إشراف مملوكة لـ Gateway بدرجة خطورة وإجراء وحالة تفعيل واضحة." action={<button className="accent" type="button" onClick={startCreate}>إضافة قاعدة</button>}>
      {error && <AdminErrorState message={error} />}
      {message && <AdminNotice tone="success">{message}</AdminNotice>}
    <div>
      <div className="toolbar">
        <button className="ghost" onClick={load}>
          تحديث
        </button>
      </div>

      {/* Create/Edit form */}
      {(creating || editingId) && (
        <div className="card rule-form">
          <h3>{creating ? "قاعدة جديدة" : "تعديل القاعدة"}</h3>
          <div className="form-grid">
            <div>
              <label>الاسم</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label>الوصف</label>
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="span-full">
              <label>نمط Regex</label>
              <input value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} className="mono" />
            </div>
            <div>
              <label>درجة الخطورة</label>
              <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as FilterRule["severity"] })}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label>الإجراء</label>
              <select value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value as FilterRule["action"] })}>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label>
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                {" "}مفعّل
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button className="accent" onClick={save}>حفظ</button>
            <button className="ghost" onClick={cancel}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Rules table */}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>النمط</th>
              <th>درجة الخطورة</th>
              <th>الإجراء</th>
              <th>مفعّل</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="muted center">جارٍ التحميل...</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={6} className="muted center">لا توجد قواعد مهيأة.</td></tr>
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
                    <button className="ghost sm" onClick={() => startEdit(r)}>تعديل</button>
                    <button className="ghost sm danger" onClick={() => remove(r.id)}>حذف</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </AdminPageSection>
  );
}
