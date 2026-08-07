import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

interface Medal {
  id: string;
  name_ar: string;
  monthlyValue: number;
  annualValue: number;
}

interface RankDef {
  rank: string;
  category: string;
  maxDegree: number;
}

export default function RulesEnginePage() {
  const [rules, setRules] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"general" | "ranks" | "medals" | "actions">("general");

  // Editable fields
  const [usdRate, setUsdRate] = useState(89500);
  const [faWife, setFaWife] = useState(60000);
  const [faChild, setFaChild] = useState(33000);
  const [faWifeRaise, setFaWifeRaise] = useState(2100000);
  const [faChildRaise, setFaChildRaise] = useState(1160000);
  const [noteAr, setNoteAr] = useState("");
  const [description, setDescription] = useState("");
  const [ranks, setRanks] = useState<RankDef[]>([]);
  const [medals, setMedals] = useState<Medal[]>([]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await api.getKBRules();
      setRules(r.rules);
      setStats(r.stats);
      setUsdRate(r.rules.usdRate);
      setFaWife(r.rules.familyAllowance?.wife || 0);
      setFaChild(r.rules.familyAllowance?.perChild || 0);
      setFaWifeRaise(r.rules.familyAllowanceAfterRaise?.wife || 0);
      setFaChildRaise(r.rules.familyAllowanceAfterRaise?.perChild || 0);
      setNoteAr(r.rules.note_ar || "");
      setDescription(r.rules.description || "");
      setRanks(r.rules.ranks || []);
      setMedals(r.rules.ornamentChoices || []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 3000); }

  async function saveGeneral() {
    setSaving(true);
    setErr("");
    try {
      await api.updateKBRules({
        usdRate,
        familyAllowance: { wife: faWife, perChild: faChild },
        familyAllowanceAfterRaise: { wife: faWifeRaise, perChild: faChildRaise },
        note_ar: noteAr,
        description,
      });
      flash("General rules saved ✓");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveRanks() {
    setSaving(true);
    setErr("");
    try {
      await api.updateKBRules({ ranks });
      flash("Ranks saved ✓");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveMedals() {
    setSaving(true);
    setErr("");
    try {
      await api.updateKBRules({ ornamentChoices: medals });
      flash("Medals saved ✓");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function doReload() {
    try {
      const r = await api.reloadKB();
      flash(`KB reloaded: ${r.salaryEntries} entries ✓`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function doRecalculate() {
    try {
      const r = await api.recalculateKB();
      flash(`Recalculated ${r.message} ✓`);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function doSaveToDisk() {
    try {
      await api.saveKB();
      flash("KB persisted to disk ✓");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  function updateRank(i: number, field: keyof RankDef, value: string | number) {
    const copy = [...ranks];
    (copy[i] as any)[field] = field === "maxDegree" ? Number(value) : value;
    setRanks(copy);
  }

  function addRank() {
    setRanks([...ranks, { rank: "", category: "الأفراد", maxDegree: 20 }]);
  }

  function removeRank(i: number) {
    setRanks(ranks.filter((_, idx) => idx !== i));
  }

  function updateMedal(i: number, field: keyof Medal, value: string | number) {
    const copy = [...medals];
    if (field === "monthlyValue" || field === "annualValue") {
      (copy[i] as any)[field] = Number(value);
    } else {
      (copy[i] as any)[field] = value;
    }
    setMedals(copy);
  }

  function addMedal() {
    setMedals([...medals, { id: `medal_${Date.now()}`, name_ar: "", monthlyValue: 0, annualValue: 0 }]);
  }

  function removeMedal(i: number) {
    setMedals(medals.filter((_, idx) => idx !== i));
  }

  if (loading) return <div className="page-loading">Loading rules…</div>;

  return (
    <div className="page rules-page">
      <div className="page-header">
        <h1>Rules Engine</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {stats && <span className="tag">Salary entries: {stats.salaryEntries}</span>}
        </div>
      </div>

      {err && <div className="page-error">⚠ {err}</div>}
      {msg && <div className="flash-msg">{msg}</div>}

      <div className="tab-bar">
        <button className={`tab ${tab === "general" ? "active" : ""}`} onClick={() => setTab("general")}>
          General Config
        </button>
        <button className={`tab ${tab === "ranks" ? "active" : ""}`} onClick={() => setTab("ranks")}>
          Ranks ({ranks.length})
        </button>
        <button className={`tab ${tab === "medals" ? "active" : ""}`} onClick={() => setTab("medals")}>
          Medals ({medals.length})
        </button>
        <button className={`tab ${tab === "actions" ? "active" : ""}`} onClick={() => setTab("actions")}>
          KB Actions
        </button>
      </div>

      {/* ── General Config ─── */}
      {tab === "general" && (
        <div className="rules-form">
          <div className="cards">
            <div className="card">
              <h3>USD Exchange Rate</h3>
              <label>LBP per 1 USD</label>
              <input type="number" value={usdRate} onChange={(e) => setUsdRate(Number(e.target.value))} />
              <p className="note">Currently: {usdRate.toLocaleString()} LBP = $1 USD</p>
            </div>

            <div className="card">
              <h3>Family Allowance (Current)</h3>
              <label>Wife (LBP)</label>
              <input type="number" value={faWife} onChange={(e) => setFaWife(Number(e.target.value))} />
              <label>Per Child (LBP)</label>
              <input type="number" value={faChild} onChange={(e) => setFaChild(Number(e.target.value))} />
            </div>

            <div className="card">
              <h3>Family Allowance (After Raise)</h3>
              <label>Wife (LBP)</label>
              <input type="number" value={faWifeRaise} onChange={(e) => setFaWifeRaise(Number(e.target.value))} />
              <label>Per Child (LBP)</label>
              <input type="number" value={faChildRaise} onChange={(e) => setFaChildRaise(Number(e.target.value))} />
              <p className="note">Proposed post-raise values — not yet enacted</p>
            </div>

            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <h3>Notes</h3>
              <label>Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
              <label>Arabic Note</label>
              <textarea value={noteAr} onChange={(e) => setNoteAr(e.target.value)} rows={2} />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-primary" onClick={saveGeneral} disabled={saving}>
              {saving ? "Saving…" : "Save General Config"}
            </button>
          </div>
        </div>
      )}

      {/* ── Ranks ─── */}
      {tab === "ranks" && (
        <div className="rules-form">
          <table className="data-table editable">
            <thead>
              <tr>
                <th>#</th>
                <th>Rank Name (Arabic)</th>
                <th>Category</th>
                <th>Max Degree</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <input type="text" value={r.rank} onChange={(e) => updateRank(i, "rank", e.target.value)} />
                  </td>
                  <td>
                    <select value={r.category} onChange={(e) => updateRank(i, "category", e.target.value)}>
                      <option value="الأفراد">الأفراد</option>
                      <option value="الرتباء">الرتباء</option>
                      <option value="الضباط الأعوان">الضباط الأعوان</option>
                      <option value="الضباط القادة">الضباط القادة</option>
                      <option value="الضباط العامون">الضباط العامون</option>
                    </select>
                  </td>
                  <td>
                    <input type="number" min={1} max={30} value={r.maxDegree} onChange={(e) => updateRank(i, "maxDegree", e.target.value)} style={{ width: 80 }} />
                  </td>
                  <td>
                    <button className="btn-sm btn-danger" onClick={() => removeRank(i)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="form-actions">
            <button className="btn-sm" onClick={addRank}>+ Add Rank</button>
            <button className="btn-primary" onClick={saveRanks} disabled={saving}>
              {saving ? "Saving…" : "Save Ranks"}
            </button>
          </div>
        </div>
      )}

      {/* ── Medals ─── */}
      {tab === "medals" && (
        <div className="rules-form">
          <table className="data-table editable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name (Arabic)</th>
                <th>Monthly Value (LBP)</th>
                <th>Annual Value (LBP)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {medals.map((m, i) => (
                <tr key={i}>
                  <td>
                    <input type="text" value={m.id} onChange={(e) => updateMedal(i, "id", e.target.value)} style={{ width: 140 }} />
                  </td>
                  <td>
                    <input type="text" value={m.name_ar} onChange={(e) => updateMedal(i, "name_ar", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" value={m.monthlyValue} onChange={(e) => updateMedal(i, "monthlyValue", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" value={m.annualValue} onChange={(e) => updateMedal(i, "annualValue", e.target.value)} />
                  </td>
                  <td>
                    <button className="btn-sm btn-danger" onClick={() => removeMedal(i)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="form-actions">
            <button className="btn-sm" onClick={addMedal}>+ Add Medal</button>
            <button className="btn-primary" onClick={saveMedals} disabled={saving}>
              {saving ? "Saving…" : "Save Medals"}
            </button>
          </div>
        </div>
      )}

      {/* ── KB Actions ─── */}
      {tab === "actions" && (
        <div className="rules-form">
          <div className="cards">
            <div className="card action-card">
              <h3>💾 Save KB to Disk</h3>
              <p>Persist all in-memory salary data and rules to JSON files on disk.</p>
              <button className="btn-primary" onClick={doSaveToDisk}>Save to Disk</button>
            </div>
            <div className="card action-card">
              <h3>🔄 Reload KB from Disk</h3>
              <p>Hot-reload salary data and rules from disk without restarting the gateway.</p>
              <button className="btn-primary" onClick={doReload}>Reload KB</button>
            </div>
            <div className="card action-card">
              <h3>🔢 Recalculate All Entries</h3>
              <p>Recompute derived columns (pension2026, sixSalary, pct2019, etc.) for all salary entries using current rules.</p>
              <button className="btn-primary" onClick={doRecalculate}>Recalculate</button>
            </div>
            <div className="card action-card">
              <h3>⚡ Full Rebuild</h3>
              <p>Recalculate all entries → save to disk → reload. A complete one-click KB refresh.</p>
              <button className="btn-primary" onClick={async () => {
                await doRecalculate();
                await doSaveToDisk();
                await doReload();
                flash("Full rebuild complete ✓");
              }}>Full Rebuild</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
