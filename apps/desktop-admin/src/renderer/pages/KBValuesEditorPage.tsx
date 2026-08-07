import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

/**
 * KB Values Editor — Full power control to edit all KB configuration values
 * Including: grants, salary multipliers, social aids, family allowances, etc.
 */

interface SocialAidRule {
  type: string;
  multiplier?: number;
  base_excludes?: string[];
  min_total_including_base?: number;
  max_increase?: number;
  floor?: number;
  amount?: number;
}

interface SocialAids {
  budget_2022?: SocialAidRule;
  decree_11227?: SocialAidRule;
  decree_11227_2?: SocialAidRule;
  decree_13020?: SocialAidRule;
  grant_12m?: SocialAidRule;
  [key: string]: any;
}

export default function KBValuesEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  
  // KB Data
  const [kbRules, setKbRules] = useState<any>(null);
  const [socialAids, setSocialAids] = useState<SocialAids>({});
  const [salaryConfig, setSalaryConfig] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  
  // Edit state
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<any>({});

  useEffect(() => {
    loadAllKBData();
  }, []);

  async function loadAllKBData() {
    setLoading(true);
    setError("");
    try {
      const [rules, salaryMeta] = await Promise.all([
        api.getKBRules(),
        api.getSalaryMeta()
      ]);
      
      setKbRules(rules);
      setMeta(salaryMeta);
      
      // Extract social aids from KB rules if available
      if (rules?.socialAids) {
        setSocialAids(rules.socialAids);
      }
      
      if (salaryMeta) {
        setSalaryConfig({
          usdRate: salaryMeta.usdRate,
          familyAllowance: salaryMeta.familyAllowance,
          familyAllowanceAfterRaise: salaryMeta.familyAllowanceAfterRaise,
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAllChanges() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      // Build the patch object with all updated values
      const patch: any = {};
      
      if (socialAids) {
        patch.socialAids = socialAids;
      }
      
      if (salaryConfig) {
        patch.usdRate = salaryConfig.usdRate;
        patch.familyAllowance = salaryConfig.familyAllowance;
        patch.familyAllowanceAfterRaise = salaryConfig.familyAllowanceAfterRaise;
      }

      await api.updateKBRules(patch);
      await api.saveKB();
      
      setMessage("✓ All KB values saved successfully!");
      setTimeout(() => setMessage(""), 5000);
    } catch (e: any) {
      setError(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function updateSocialAidValue(ruleName: string, field: string, value: any) {
    setSocialAids(prev => ({
      ...prev,
      [ruleName]: {
        ...prev[ruleName],
        [field]: field === 'type' ? value : Number(value)
      }
    }));
  }

  function updateSalaryConfigValue(field: string, subfield: string | null, value: any) {
    if (subfield) {
      setSalaryConfig((prev: any) => ({
        ...prev,
        [field]: {
          ...prev[field],
          [subfield]: Number(value)
        }
      }));
    } else {
      setSalaryConfig((prev: any) => ({
        ...prev,
        [field]: Number(value)
      }));
    }
  }

  function startEdit(ruleName: string) {
    setEditingRule(ruleName);
    setTempValue(socialAids[ruleName] || {});
  }

  function cancelEdit() {
    setEditingRule(null);
    setTempValue({});
  }

  function saveEdit() {
    if (editingRule) {
      setSocialAids(prev => ({
        ...prev,
        [editingRule]: tempValue
      }));
      setEditingRule(null);
      setTempValue({});
    }
  }

  if (loading) {
    return <div className="page-loading">Loading KB configuration...</div>;
  }

  return (
    <div className="page kb-values-editor">
      <div className="page-header">
        <h1>📊 KB Values Editor</h1>
        <p className="subtitle">Full control over all knowledge base configuration values</p>
      </div>

      {error && <div className="page-error">⚠ {error}</div>}
      {message && <div className="page-success">{message}</div>}

      <div className="controls-bar">
        <button 
          className="btn-primary" 
          onClick={saveAllChanges}
          disabled={saving}
        >
          {saving ? "Saving..." : "💾 Save All Changes"}
        </button>
        <button onClick={loadAllKBData} disabled={saving}>
          🔄 Reload Data
        </button>
        <button onClick={async () => {
          try {
            await api.reloadKB();
            setMessage("KB reloaded into memory");
          } catch (e: any) {
            setError(e.message);
          }
        }}>
          ⚡ Reload KB into Memory
        </button>
      </div>

      {/* Social Aid Rules */}
      <section className="section">
        <h2>💰 Social Aid Rules & Grants</h2>
        <p className="note">Configure pension multipliers, floors, caps, and fixed grants</p>
        
        <div className="cards">
          {/* Grant 12M - Featured prominently */}
          {socialAids.grant_12m && (
            <div className="card highlight-card">
              <div className="card-header">
                <h3>🎁 Fixed Grant (منحة مالية)</h3>
                {editingRule !== 'grant_12m' && (
                  <button className="btn-sm" onClick={() => startEdit('grant_12m')}>Edit</button>
                )}
              </div>
              
              {editingRule === 'grant_12m' ? (
                <div className="edit-form">
                  <div className="form-group">
                    <label>Type:</label>
                    <select 
                      value={tempValue.type || 'fixed'}
                      onChange={(e) => setTempValue({...tempValue, type: e.target.value})}
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="multiplier">Multiplier</option>
                      <option value="multiplier_with_floor">Multiplier with Floor</option>
                      <option value="multiplier_with_caps">Multiplier with Caps</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Amount (LBP):</label>
                    <input
                      type="number"
                      value={tempValue.amount || 12000000}
                      onChange={(e) => setTempValue({...tempValue, amount: Number(e.target.value)})}
                      className="input-large"
                    />
                  </div>
                  
                  <div className="form-actions">
                    <button className="btn-success" onClick={saveEdit}>✓ Save</button>
                    <button onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="value-display">
                  <div className="stat-large">
                    {socialAids.grant_12m.amount?.toLocaleString()} LBP
                  </div>
                  <div className="meta">Type: {socialAids.grant_12m.type}</div>
                </div>
              )}
            </div>
          )}

          {/* Budget 2022 */}
          {socialAids.budget_2022 && (
            <div className="card">
              <div className="card-header">
                <h4>Budget 2022</h4>
                {editingRule !== 'budget_2022' && (
                  <button className="btn-sm" onClick={() => startEdit('budget_2022')}>Edit</button>
                )}
              </div>
              
              {editingRule === 'budget_2022' ? (
                <div className="edit-form">
                  <div className="form-group">
                    <label>Multiplier:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempValue.multiplier || 2}
                      onChange={(e) => setTempValue({...tempValue, multiplier: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Increase (LBP):</label>
                    <input
                      type="number"
                      value={tempValue.max_increase || 12000000}
                      onChange={(e) => setTempValue({...tempValue, max_increase: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Min Total (LBP):</label>
                    <input
                      type="number"
                      value={tempValue.min_total_including_base || 500000}
                      onChange={(e) => setTempValue({...tempValue, min_total_including_base: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-actions">
                    <button className="btn-success" onClick={saveEdit}>✓ Save</button>
                    <button onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="value-display">
                  <p>Multiplier: {socialAids.budget_2022.multiplier}x</p>
                  <p>Max Increase: {socialAids.budget_2022.max_increase?.toLocaleString()} LBP</p>
                  <p>Min Total: {socialAids.budget_2022.min_total_including_base?.toLocaleString()} LBP</p>
                </div>
              )}
            </div>
          )}

          {/* Decree 11227 */}
          {socialAids.decree_11227 && (
            <div className="card">
              <div className="card-header">
                <h4>Decree 11227 (18/04/2023)</h4>
                {editingRule !== 'decree_11227' && (
                  <button className="btn-sm" onClick={() => startEdit('decree_11227')}>Edit</button>
                )}
              </div>
              
              {editingRule === 'decree_11227' ? (
                <div className="edit-form">
                  <div className="form-group">
                    <label>Multiplier:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempValue.multiplier || 4}
                      onChange={(e) => setTempValue({...tempValue, multiplier: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-actions">
                    <button className="btn-success" onClick={saveEdit}>✓ Save</button>
                    <button onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="value-display">
                  <p>Multiplier: {socialAids.decree_11227.multiplier}x pension</p>
                  <p className="note">Excludes family allowance & ornaments</p>
                </div>
              )}
            </div>
          )}

          {/* Decree 11227_2 */}
          {socialAids.decree_11227_2 && (
            <div className="card">
              <div className="card-header">
                <h4>Decree 11227-2 (21/9/2023)</h4>
                {editingRule !== 'decree_11227_2' && (
                  <button className="btn-sm" onClick={() => startEdit('decree_11227_2')}>Edit</button>
                )}
              </div>
              
              {editingRule === 'decree_11227_2' ? (
                <div className="edit-form">
                  <div className="form-group">
                    <label>Multiplier:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempValue.multiplier || 3}
                      onChange={(e) => setTempValue({...tempValue, multiplier: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Floor (LBP):</label>
                    <input
                      type="number"
                      value={tempValue.floor || 7000000}
                      onChange={(e) => setTempValue({...tempValue, floor: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-actions">
                    <button className="btn-success" onClick={saveEdit}>✓ Save</button>
                    <button onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="value-display">
                  <p>Multiplier: {socialAids.decree_11227_2.multiplier}x</p>
                  <p>Floor: {socialAids.decree_11227_2.floor?.toLocaleString()} LBP</p>
                </div>
              )}
            </div>
          )}

          {/* Decree 13020 */}
          {socialAids.decree_13020 && (
            <div className="card">
              <div className="card-header">
                <h4>Decree 13020 (28/02/2024)</h4>
                {editingRule !== 'decree_13020' && (
                  <button className="btn-sm" onClick={() => startEdit('decree_13020')}>Edit</button>
                )}
              </div>
              
              {editingRule === 'decree_13020' ? (
                <div className="edit-form">
                  <div className="form-group">
                    <label>Multiplier:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempValue.multiplier || 3}
                      onChange={(e) => setTempValue({...tempValue, multiplier: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Floor (LBP):</label>
                    <input
                      type="number"
                      value={tempValue.floor || 7000000}
                      onChange={(e) => setTempValue({...tempValue, floor: Number(e.target.value)})}
                    />
                  </div>
                  <div className="form-actions">
                    <button className="btn-success" onClick={saveEdit}>✓ Save</button>
                    <button onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="value-display">
                  <p>Multiplier: {socialAids.decree_13020.multiplier}x</p>
                  <p>Floor: {socialAids.decree_13020.floor?.toLocaleString()} LBP</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Salary Configuration */}
      {salaryConfig && (
        <section className="section">
          <h2>💵 Salary Configuration</h2>
          
          <div className="cards">
            <div className="card">
              <h4>USD Exchange Rate</h4>
              <div className="form-group">
                <input
                  type="number"
                  value={salaryConfig.usdRate || 89500}
                  onChange={(e) => updateSalaryConfigValue('usdRate', null, e.target.value)}
                  className="input-large"
                />
                <span className="unit">LBP per USD</span>
              </div>
            </div>

            <div className="card">
              <h4>Family Allowance (Before Raise)</h4>
              <div className="form-group">
                <label>Wife:</label>
                <input
                  type="number"
                  value={salaryConfig.familyAllowance?.wife || 60000}
                  onChange={(e) => updateSalaryConfigValue('familyAllowance', 'wife', e.target.value)}
                />
                <span className="unit">LBP</span>
              </div>
              <div className="form-group">
                <label>Per Child:</label>
                <input
                  type="number"
                  value={salaryConfig.familyAllowance?.perChild || 33000}
                  onChange={(e) => updateSalaryConfigValue('familyAllowance', 'perChild', e.target.value)}
                />
                <span className="unit">LBP</span>
              </div>
            </div>

            <div className="card">
              <h4>Family Allowance (After Raise)</h4>
              <div className="form-group">
                <label>Wife:</label>
                <input
                  type="number"
                  value={salaryConfig.familyAllowanceAfterRaise?.wife || 180000}
                  onChange={(e) => updateSalaryConfigValue('familyAllowanceAfterRaise', 'wife', e.target.value)}
                />
                <span className="unit">LBP</span>
              </div>
              <div className="form-group">
                <label>Per Child:</label>
                <input
                  type="number"
                  value={salaryConfig.familyAllowanceAfterRaise?.perChild || 99000}
                  onChange={(e) => updateSalaryConfigValue('familyAllowanceAfterRaise', 'perChild', e.target.value)}
                />
                <span className="unit">LBP</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Version Control & Audit */}
      <section className="section">
        <h2>📜 Change History & Version Control</h2>
        <div className="note">
          All changes are automatically versioned. You can rollback to any previous state from the KB Management page.
        </div>
        <button onClick={() => window.location.href = '#/kb'}>
          View KB Versions →
        </button>
      </section>

      {/* Quick Actions */}
      <section className="section">
        <h2>⚡ Quick Actions</h2>
        <div className="action-grid">
          <button onClick={async () => {
            try {
              await api.recalculateKB();
              setMessage("KB recalculated successfully");
            } catch (e: any) {
              setError(e.message);
            }
          }}>
            🔢 Recalculate All Salary Values
          </button>
          
          <button onClick={async () => {
            try {
              const exported = await api.saveKB();
              setMessage("KB exported to disk");
            } catch (e: any) {
              setError(e.message);
            }
          }}>
            💾 Export KB Snapshot
          </button>
        </div>
      </section>
    </div>
  );
}
