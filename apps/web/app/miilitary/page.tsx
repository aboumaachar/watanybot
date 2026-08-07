"use client";
import { useCallback, useEffect, useState } from "react";
import SeniorPanel from "./SeniorPanel";
import type { SalaryResult } from "./SeniorPanel";
import VoiceTools from "./VoiceTools";

type Screen = "landing" | "salary_wizard" | "help";

/* ── Config ─────────────────────────────────────────────── */
const API_URL =
  typeof window !== "undefined" && (window as any).__VITE_API_URL
    ? (window as any).__VITE_API_URL
    : "http://127.0.0.1:8010";

/* ── Types ──────────────────────────────────────────────── */
type RankOption = { rank: string; category: string; maxDegree: number };

type SalaryMetaResp = {
  ranks: RankOption[];
  familyAllowance: { wife: number; perChild: number };
  familyAllowanceAfterRaise?: { wife: number; perChild: number; note_ar?: string };
  ornamentChoices: { id: string; name_ar: string; monthlyValue: number; annualValue: number }[];
  usdRate: number;
};

/* ── Static RANKS for voice matching (mirrors rankMeta.json) ── */
const RANKS: { ar: string; code: string; group: string }[] = [
  { ar: "\u062C\u0646\u062F\u064A",      code: "\u062C\u0646\u062F\u064A",      group: "\u0627\u0644\u0623\u0641\u0631\u0627\u062F" },
  { ar: "\u062C\u0646\u062F\u064A \u0627\u0648\u0644",  code: "\u062C\u0646\u062F\u064A \u0627\u0648\u0644",  group: "\u0627\u0644\u0623\u0641\u0631\u0627\u062F" },
  { ar: "\u0639\u0631\u064A\u0641",      code: "\u0639\u0631\u064A\u0641",      group: "\u0627\u0644\u0623\u0641\u0631\u0627\u062F" },
  { ar: "\u0639\u0631\u064A\u0641 \u0627\u0648\u0644",  code: "\u0639\u0631\u064A\u0641 \u0627\u0648\u0644",  group: "\u0627\u0644\u0623\u0641\u0631\u0627\u062F" },
  { ar: "\u0631\u0642\u064A\u0628",      code: "\u0631\u0642\u064A\u0628",      group: "\u0627\u0644\u0631\u062A\u0628\u0627\u0621" },
  { ar: "\u0631\u0642\u064A\u0628 \u0627\u0648\u0644",  code: "\u0631\u0642\u064A\u0628 \u0627\u0648\u0644",  group: "\u0627\u0644\u0631\u062A\u0628\u0627\u0621" },
  { ar: "\u0645\u0639\u0627\u0648\u0646",     code: "\u0645\u0639\u0627\u0648\u0646",     group: "\u0627\u0644\u0631\u062A\u0628\u0627\u0621" },
  { ar: "\u0645\u0639\u0627\u0648\u0646 \u0627\u0648\u0644", code: "\u0645\u0639\u0627\u0648\u0646 \u0627\u0648\u0644", group: "\u0627\u0644\u0631\u062A\u0628\u0627\u0621" },
  { ar: "\u0645\u0624\u0647\u0644",      code: "\u0645\u0624\u0647\u0644",      group: "\u0627\u0644\u0631\u062A\u0628\u0627\u0621" },
  { ar: "\u0645\u0624\u0647\u0644 \u0627\u0648\u0644",  code: "\u0645\u0624\u0647\u0644 \u0627\u0648\u0644",  group: "\u0627\u0644\u0631\u062A\u0628\u0627\u0621" },
  { ar: "\u0645\u0644\u0627\u0632\u0645",     code: "\u0645\u0644\u0627\u0632\u0645",     group: "\u0627\u0644\u0636\u0628\u0627\u0637 \u0627\u0644\u0623\u0639\u0648\u0627\u0646" },
  { ar: "\u0645\u0644\u0627\u0632\u0645 \u0627\u0648\u0644", code: "\u0645\u0644\u0627\u0632\u0645 \u0627\u0648\u0644", group: "\u0627\u0644\u0636\u0628\u0627\u0637 \u0627\u0644\u0623\u0639\u0648\u0627\u0646" },
  { ar: "\u0646\u0642\u064A\u0628",      code: "\u0646\u0642\u064A\u0628",      group: "\u0627\u0644\u0636\u0628\u0627\u0637 \u0627\u0644\u0623\u0639\u0648\u0627\u0646" },
  { ar: "\u0631\u0627\u0626\u062F",      code: "\u0631\u0627\u0626\u062F",      group: "\u0627\u0644\u0636\u0628\u0627\u0637 \u0627\u0644\u0642\u0627\u062F\u0629" },
  { ar: "\u0645\u0642\u062F\u0645",      code: "\u0645\u0642\u062F\u0645",      group: "\u0627\u0644\u0636\u0628\u0627\u0637 \u0627\u0644\u0642\u0627\u062F\u0629" },
  { ar: "\u0639\u0642\u064A\u062F",      code: "\u0639\u0642\u064A\u062F",      group: "\u0627\u0644\u0636\u0628\u0627\u0637 \u0627\u0644\u0642\u0627\u062F\u0629" },
  { ar: "\u0639\u0645\u064A\u062F",      code: "\u0639\u0645\u064A\u062F",      group: "\u0627\u0644\u0636\u0628\u0627\u0637 \u0627\u0644\u0639\u0627\u0645\u0648\u0646" },
  { ar: "\u0644\u0648\u0627\u0621",      code: "\u0644\u0648\u0627\u0621",      group: "\u0627\u0644\u0636\u0628\u0627\u0637 \u0627\u0644\u0639\u0627\u0645\u0648\u0646" },
  { ar: "\u0639\u0645\u0627\u062F",      code: "\u0639\u0645\u0627\u062F",      group: "\u0627\u0644\u0636\u0628\u0627\u0637 \u0627\u0644\u0639\u0627\u0645\u0648\u0646" },
];

/* ── Helpers ─────────────────────────────────────────────── */
function formatLBP(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  try {
    return new Intl.NumberFormat("ar-LB").format(n) + " ل.ل";
  } catch {
    return String(n);
  }
}

/* ── Page ───────────────────────────────────────────────── */
export default function MilitaryPage() {
  /* state: meta */
  const [meta, setMeta] = useState<SalaryMetaResp | null>(null);
  const [metaError, setMetaError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  /* state: form */
  const [rank, setRank] = useState("");
  const [degree, setDegree] = useState(1);
  const [married, setMarried] = useState(false);
  const [kidsCount, setKidsCount] = useState(0);
  const [selectedOrnaments, setSelectedOrnaments] = useState<string[]>([]);

  /* state: result */
  const [result, setResult] = useState<SalaryResult | null>(null);
  const [calcError, setCalcError] = useState("");

  /* state: screen / step (voice navigation) */
  const [screen, setScreen] = useState<Screen>("landing");
  const [step, setStep] = useState(0);

  /* ── Load meta on mount ──────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/salary/meta`);
        if (!res.ok) throw new Error(`meta ${res.status}`);
        const data = await res.json();
        setMeta(data);
      } catch (e: any) {
        setMetaError(e.message || "فشل تحميل بيانات الرتب");
      }
    })();
  }, []);

  /* ── Fetch salary calc ──────────────────────────────── */
  const fetchSalary = useCallback(async () => {
    if (!rank) return;
    setLoading(true);
    setCalcError("");
    try {
      const res = await fetch(`${API_URL}/api/salary/calc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rank, degree, married, kidsCount, selectedOrnaments }),
      });
      if (!res.ok) throw new Error(`calc ${res.status}`);
      const data = await res.json();

      // Backend returns the full SalaryResult shape directly
      if (data.meta && data.components && data.breakdown_steps) {
        setResult(data as SalaryResult);
      } else if (data.ok === false) {
        throw new Error(data.error || "خطأ بالحساب");
      } else {
        // Fallback: construct the shape from a legacy response
        const rankLabel = meta?.ranks.find((r) => r.rank === rank)?.rank ?? rank;
        setResult({
          meta: {
            mode: "senior",
            group_code: data.input?.category ?? "",
            rank_code: rank,
            rank_ar: data.input?.rank ?? rankLabel,
            step_no: data.input?.degree ?? degree,
            currency: "LBP",
            effective_date: "",
          },
          inputs: {
            marital_status: married ? "married" : "single",
            children_count: kidsCount,
            medals: selectedOrnaments,
            include_allowances: true,
          },
          components: {
            base_salary: data.breakdown?.basicSalary ?? 0,
            cola_amount: data.breakdown?.aids?.grant2025 ?? 0,
            old_step_value: null,
            new_salary: data.totalPension ?? 0,
            new_step_value: data.raise?.totalAfterSixRaise ?? null,
            social_assistance_tax_rate: 0,
            social_assistance_tax_amount: 0,
            salary_after_tax: data.breakdown?.basicSalary ?? 0,
            supplements_amount: 0,
            family_allowance_amount: 0,
          },
          breakdown_steps: [],
          final_total: data.totalPension ?? 0,
          notes_for_user: [],
        });
      }
    } catch (e: any) {
      setCalcError(e.message || "حصل خطأ");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [rank, degree, married, kidsCount, selectedOrnaments, meta]);

  /* ── Derived ────────────────────────────────────────────── */
  const ranks = meta?.ranks ?? [];
  const ornaments = meta?.ornamentChoices ?? [];
  const rankOptions = ranks.map((r) => ({ code: r.rank, label: r.rank, maxDeg: r.maxDegree }));

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div dir="rtl" style={{ fontFamily: "Tajawal, sans-serif", maxWidth: 640, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        حاسبة رواتب العسكريين المتقاعدين 🎖️
      </h1>

      {/* ── Voice Tools (always visible) ── */}
      <VoiceTools
        onTranscript={(t) => {
          // Best-effort parsing from speech
          const rankHit = RANKS.find(r => t.includes(r.ar));
          const degreeMatch = t.match(/\u062F\u0631\u062C\u0629\s*([0-9\u0660-\u0669]+)/);
          const numRaw = degreeMatch?.[1]?.replace(/[\u0660-\u0669]/g, d => "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d).toString());
          const deg = numRaw ? parseInt(numRaw, 10) : null;

          if (rankHit) {
            setRank(rankHit.code);
          }
          if (deg && deg >= 1 && deg <= 15) {
            setDegree(deg);
          }
          if (t.includes("\u0645\u062A\u0623\u0647\u0644") || t.includes("\u0645\u062A\u0632\u0648\u062C")) {
            setMarried(true);
          }
          if (t.includes("\u0623\u0639\u0632\u0628") || t.includes("\u0639\u0627\u0632\u0628")) {
            setMarried(false);
          }

          // children: ولد/أولاد + number
          const childMatch = t.match(/(\u0648\u0644\u062F|\u0623\u0648\u0644\u0627\u062F)\s*([0-9\u0660-\u0669]+)/);
          const cRaw = childMatch?.[2]?.replace(/[\u0660-\u0669]/g, d => "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d).toString());
          const cc = cRaw ? parseInt(cRaw, 10) : null;
          if (cc !== null && cc >= 0 && cc <= 10) setKidsCount(cc);

          // After voice input, go to the salary wizard
          setScreen("salary_wizard");
          setStep(6);
          setResult(null);
        }}
        speakText={"\u0627\u062D\u0643\u064A \u062C\u0645\u0644\u0629 \u0645\u062B\u0644: \u0631\u062A\u0628\u062A\u064A \u0639\u0645\u064A\u062F \u062F\u0631\u062C\u0629 4 \u0645\u062A\u0623\u0647\u0644 \u0648\u0639\u0646\u062F\u064A \u0648\u0644\u062F \u0648\u0627\u062D\u062F."}
      />

      {/* ── Landing screen ── */}
      {screen === "landing" && (
        <div style={{ textAlign: "center", padding: "30px 0" }}>
          <p style={{ fontSize: 18, marginBottom: 16 }}>
            {"\u0623\u0647\u0644\u064a\u0646 \u0641\u064a\u0643. \u0627\u0636\u063a\u0637 \u0639\u0644\u0649 \u0627\u0644\u0632\u0631 \u0623\u0648 \u0627\u062d\u0643\u064a \u0628\u0635\u0648\u062a\u0643."}
          </p>
          <button
            onClick={() => { setScreen("salary_wizard"); setStep(0); }}
            style={{
              padding: "14px 32px", borderRadius: 12, border: "none",
              background: "#1a6b3c", color: "#fff", fontWeight: 800,
              fontSize: 18, cursor: "pointer",
            }}
          >
            {"\u0627\u062d\u0633\u0628 \u0645\u0639\u0627\u0634\u064a \ud83d\udcb0"}
          </button>
        </div>
      )}

      {/* ── Help screen ── */}
      {screen === "help" && (
        <div style={{ padding: "20px 0" }}>
          <h2 style={{ fontWeight: 800, marginBottom: 10 }}>{"\u0645\u0633\u0627\u0639\u062f\u0629 \u2753"}</h2>
          <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 2 }}>
            <li>{"\u0642\u0648\u0644 \xab\u0627\u062d\u0633\u0628 \u0631\u0627\u062a\u0628\u064a\xbb \u0644\u0641\u062a\u062d \u0627\u0644\u062d\u0627\u0633\u0628\u0629"}</li>
            <li>{"\u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0631\u062a\u0628\u0629 \u0648\u0627\u0644\u062f\u0631\u062c\u0629 \u0648\u0627\u0636\u063a\u0637 \xab\u0627\u062d\u0633\u0628 \u0627\u0644\u0631\u0627\u062a\u0628\xbb"}</li>
            <li>{"\u0641\u064a\u0643 \u062a\u0633\u062a\u0639\u0645\u0644 \u0627\u0644\u0635\u0648\u062a \u0628\u062f\u0644 \u0627\u0644\u0643\u062a\u0627\u0628\u0629"}</li>
          </ul>
          <button
            onClick={() => { setScreen("salary_wizard"); setStep(0); }}
            style={{
              marginTop: 16, padding: "10px 24px", borderRadius: 10, border: "1px solid #1a6b3c",
              background: "#fff", color: "#1a6b3c", fontWeight: 700, cursor: "pointer",
            }}
          >
            {"\u0631\u062c\u0639\u0646\u064a \u0644\u0644\u062d\u0627\u0633\u0628\u0629"}
          </button>
        </div>
      )}

      {/* ── Salary wizard screen ── */}
      {screen === "salary_wizard" && <>
      <p style={{ opacity: 0.7, marginBottom: 20 }}>
        اختار رتبتك ودرجتك ومنحسبلك راتبك خطوة خطوة.
      </p>

      {metaError && <div style={{ color: "#c00", marginBottom: 12 }}>{metaError}</div>}

      {/* ── Form ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 700 }}>الرتبة</span>
          <select
            value={rank}
            onChange={(e) => { setRank(e.target.value); setDegree(1); setResult(null); }}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          >
            <option value="">\u2014 \u0627\u062E\u062A\u0627\u0631 \u0627\u0644\u0631\u062A\u0628\u0629 \u2014</option>
            {rankOptions.map((r) => (<option key={r.code} value={r.code}>{r.label}</option>))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 700 }}>الدرجة</span>
          <input
            type="number" min={1} max={30} value={degree}
            onChange={(e) => { setDegree(Math.max(1, Number.parseInt(e.target.value, 10) || 1)); setResult(null); }}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={married} onChange={(e) => setMarried(e.target.checked)} />
          <span style={{ fontWeight: 700 }}>متأهل</span>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 700 }}>عدد الأولاد</span>
          <input
            type="number" min={0} max={20} value={kidsCount}
            onChange={(e) => setKidsCount(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>
      </div>

      {ornaments.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontWeight: 700 }}>أوسمة</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {ornaments.map((o) => (
              <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  checked={selectedOrnaments.includes(o.id)}
                  onChange={(e) => setSelectedOrnaments((prev) => e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id))}
                />
                {o.name_ar}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={fetchSalary}
        disabled={!rank || loading}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
          background: rank ? "#1a6b3c" : "#ccc", color: "#fff",
          fontWeight: 800, fontSize: 18,
          cursor: rank ? "pointer" : "not-allowed", marginBottom: 12,
        }}
      >
        {loading ? "جاري الحساب..." : "احسب الراتب"}
      </button>

      {calcError && <div style={{ color: "#c00", marginBottom: 12 }}>{calcError}</div>}

      <SeniorPanel result={result} onRequestRecalc={() => fetchSalary()} />
      </>}
    </div>
  );
}
