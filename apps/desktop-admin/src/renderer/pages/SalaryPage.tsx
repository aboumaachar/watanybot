import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export default function SalaryPage() {
  const [meta, setMeta] = useState<any>(null);
  const [rank, setRank] = useState("");
  const [degree, setDegree] = useState(1);
  const [wife, setWife] = useState(false);
  const [children, setChildren] = useState(0);
  const [medals, setMedals] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [calcLoading, setCalcLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const m = await api.getSalaryMeta();
        setMeta(m);
        if (m.ranks?.length > 0) setRank(m.ranks[0].rank);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function calculate() {
    setCalcLoading(true);
    setErr("");
    try {
      const r = await api.salaryCalc({
        rank,
        degree,
        married: wife,
        kidsCount: children,
        selectedOrnaments: medals,
      });
      setResult(r);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setCalcLoading(false);
    }
  }

  function toggleMedal(id: string) {
    setMedals((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  if (loading) return <div className="page-loading">Loading salary data…</div>;

  const maxDeg = meta?.ranks?.find((r: any) => r.rank === rank)?.maxDegree || 20;

  return (
    <div className="page salary-page">
      <h1>Salary & Pension Calculator</h1>
      {err && <div className="page-error">⚠ {err}</div>}

      <div className="calc-form cards">
        <div className="card">
          <h3>Rank & Degree</h3>
          <label htmlFor="salary-rank">Rank (الرتبة)</label>
          <select id="salary-rank" value={rank} onChange={(e) => { setRank(e.target.value); setDegree(1); }}>
            {meta?.ranks?.map((r: any) => (
              <option key={r.rank} value={r.rank}>
                {r.rank} — {r.category}
              </option>
            ))}
          </select>
          <label htmlFor="salary-degree">Degree (الدرجة): {degree}</label>
          <input
            id="salary-degree"
            type="range"
            min={1}
            max={maxDeg}
            value={degree}
            onChange={(e) => setDegree(Number(e.target.value))}
          />
          <span className="note">Max: {maxDeg}</span>
        </div>

        <div className="card">
          <h3>Family Status</h3>
          <label className="checkbox-label">
            <input type="checkbox" checked={wife} onChange={(e) => setWife(e.target.checked)} />
            <span>Married (متزوج)</span>
          </label>
          <label htmlFor="salary-children">Children on dependency (أولاد على العاتق)</label>
          <input
            id="salary-children"
            type="number"
            min={0}
            max={12}
            value={children}
            onChange={(e) => setChildren(Number(e.target.value))}
          />
        </div>

        <div className="card">
          <h3>Medals & Decorations</h3>
          <div className="medal-list">
            {meta?.ornamentChoices?.map((o: any) => (
              <label key={o.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={medals.includes(o.id)}
                  onChange={() => toggleMedal(o.id)}
                />
                {o.name_ar} ({o.monthlyValue?.toLocaleString()} LBP/mo)
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", margin: "16px 0" }}>
        <button className="btn-primary btn-lg" onClick={calculate} disabled={calcLoading}>
          {calcLoading ? "Calculating…" : "Calculate Pension"}
        </button>
      </div>

      {/* Results */}
      {result?.breakdown && (
        <div className="result-section">
          <h2>Pension Results</h2>
          <div className="cards">
            {/* Current Pension */}
            <div className="card result-card">
              <h3>Current Pension (المعاش الحالي)</h3>
              <table>
                <tbody>
                  <tr><td>Basic Salary</td><td>{result.breakdown.basicSalary?.toLocaleString()} LBP</td></tr>
                  <tr><td>Vet Salary (85%)</td><td>{result.breakdown.vetSalary?.toLocaleString()} LBP</td></tr>
                  {result.breakdown.equipment > 0 && <tr><td>Equipment</td><td>{result.breakdown.equipment?.toLocaleString()} LBP</td></tr>}
                  {result.breakdown.driver > 0 && <tr><td>Driver</td><td>{result.breakdown.driver?.toLocaleString()} LBP</td></tr>}
                  {result.breakdown.position > 0 && <tr><td>Position</td><td>{result.breakdown.position?.toLocaleString()} LBP</td></tr>}
                  {result.breakdown.aids.grant2025 > 0 && <tr><td>Grant 2025</td><td>{result.breakdown.aids.grant2025?.toLocaleString()} LBP</td></tr>}
                  {result.breakdown.aids.d13020 > 0 && <tr><td>Decree 13020</td><td>{result.breakdown.aids.d13020?.toLocaleString()} LBP</td></tr>}
                  {result.breakdown.aids.d11227_2 > 0 && <tr><td>Decree 11227/2</td><td>{result.breakdown.aids.d11227_2?.toLocaleString()} LBP</td></tr>}
                  {result.breakdown.aids.d11227_1 > 0 && <tr><td>Decree 11227/1</td><td>{result.breakdown.aids.d11227_1?.toLocaleString()} LBP</td></tr>}
                  {result.breakdown.aids.budget2022 > 0 && <tr><td>Budget 2022</td><td>{result.breakdown.aids.budget2022?.toLocaleString()} LBP</td></tr>}
                  {result.breakdown.deduction15Pct > 0 && <tr><td>اقتطاع 1.5 % =</td><td>-{result.breakdown.deduction15Pct?.toLocaleString()} LBP</td></tr>}
                  <tr style={{ borderTop: "1px solid #ccc" }}>
                    <td>Pension 2026 (before family/medals)</td>
                    <td><strong>{result.breakdown.pension2026?.toLocaleString()} LBP</strong></td>
                  </tr>
                  <tr><td>≈ USD</td><td>${result.breakdown.pension2026usd?.toFixed(2)}</td></tr>
                  {result.breakdown.familyAllowance.total > 0 && (
                    <tr><td>Family Allowance</td><td>{result.breakdown.familyAllowance.total?.toLocaleString()} LBP</td></tr>
                  )}
                  {result.breakdown.medals.total > 0 && (
                    <tr><td>Medals</td><td>{result.breakdown.medals.total?.toLocaleString()} LBP</td></tr>
                  )}
                  <tr className="total-row" style={{ borderTop: "2px solid #1a73e8" }}>
                    <td><strong>Total Pension</strong></td>
                    <td><strong>{result.totalPension?.toLocaleString()} LBP</strong></td>
                  </tr>
                  <tr><td>≈ USD</td><td><strong>${result.totalPensionUsd?.toFixed(2)}</strong></td></tr>
                </tbody>
              </table>
            </div>

            {/* After 6x raise */}
            {result.raise && result.raise.sixSalary > 0 && (
              <div className="card result-card">
                <h3>Additional 6× Raise Grant (الزيادة الإضافية 6×)</h3>
                <table>
                  <tbody>
                    <tr><td>Current Pension</td><td>{result.breakdown.pension2026?.toLocaleString()} LBP</td></tr>
                    <tr><td>Additional 6× Grant</td><td>{result.raise.sixSalary?.toLocaleString()} LBP</td></tr>
                    {result.breakdown.deduction15Pct > 0 && <tr><td>اقتطاع 1.5 % =</td><td>-{result.breakdown.deduction15Pct?.toLocaleString()} LBP</td></tr>}
                    <tr><td>Pension After 6× Raise</td><td>{result.raise.pensionAfterSixRaise?.toLocaleString()} LBP</td></tr>
                    <tr><td>≈ USD</td><td>${result.raise.pensionAfterSixRaiseUsd?.toFixed(2)}</td></tr>
                    {result.raise.familyAfterRaise.total > 0 && (
                      <tr><td>Family (after raise)</td><td>{result.raise.familyAfterRaise.total?.toLocaleString()} LBP</td></tr>
                    )}
                    {result.breakdown.medals.total > 0 && (
                      <tr><td>Medals</td><td>{result.breakdown.medals.total?.toLocaleString()} LBP</td></tr>
                    )}
                    <tr className="total-row" style={{ borderTop: "2px solid #2e7d32" }}>
                      <td><strong>Total After 6× Raise</strong></td>
                      <td><strong>{result.raise.totalAfterSixRaise?.toLocaleString()} LBP</strong></td>
                    </tr>
                    <tr><td>≈ USD</td><td><strong>${result.raise.totalAfterSixRaiseUsd?.toFixed(2)}</strong></td></tr>
                    <tr><td>% of 2019</td><td>{(result.raise.sixPct * 100).toFixed(1)}%</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* 50% of 2019 */}
            {result.fiftyPctRaise && result.fiftyPctRaise.fiftyPctTargetLbp > 0 && (
              <div className="card result-card">
                <h3>Additional Raise To Reach 50% Of 2019</h3>
                <table>
                  <tbody>
                    <tr><td>2019 Value</td><td>{result.fiftyPctRaise.val2019?.toLocaleString()} LBP</td></tr>
                    <tr><td>2019 USD</td><td>${result.fiftyPctRaise.val2019usd?.toFixed(2)}</td></tr>
                    <tr><td>Target (50%)</td><td>${result.fiftyPctRaise.fiftyPctTargetUsd?.toFixed(2)}</td></tr>
                    <tr><td>Target LBP</td><td>{result.fiftyPctRaise.fiftyPctTargetLbp?.toLocaleString()} LBP</td></tr>
                    {result.fiftyPctRaise.additionalRaise > 0 && (
                      <tr><td>Additional Grant Needed</td><td>{result.fiftyPctRaise.additionalRaise?.toLocaleString()} LBP</td></tr>
                    )}
                    {result.breakdown.deduction15Pct > 0 && <tr><td>اقتطاع 1.5 % =</td><td>-{result.breakdown.deduction15Pct?.toLocaleString()} LBP</td></tr>}
                    <tr><td>Pension After 50% Raise</td><td>{result.fiftyPctRaise.pensionAfterFiftyPct?.toLocaleString()} LBP</td></tr>
                    <tr><td>≈ USD</td><td>${result.fiftyPctRaise.pensionAfterFiftyPctUsd?.toFixed(2)}</td></tr>
                    <tr className="total-row" style={{ borderTop: "2px solid #e65100" }}>
                      <td><strong>Total After 50% Raise</strong></td>
                      <td><strong>{result.fiftyPctRaise.totalAfterFiftyPct?.toLocaleString()} LBP</strong></td>
                    </tr>
                    <tr><td>≈ USD</td><td><strong>${result.fiftyPctRaise.totalAfterFiftyPctUsd?.toFixed(2)}</strong></td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
