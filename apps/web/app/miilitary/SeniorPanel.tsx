"use client";
import { useEffect, useMemo, useState } from "react";

/* -- Types aligned with backend response shape -- */

export type SalaryMeta = {
  mode: string;
  group_code: string;
  rank_code: string;
  rank_ar: string;
  step_no: number;
  currency: string;
  effective_date: string;
};

export type SalaryInputs = {
  marital_status: string;
  children_count: number;
  medals: string[];
  include_allowances: boolean;
};

export type SalaryComponents = {
  base_salary: number;
  cola_amount: number;
  old_step_value: number | null;
  new_salary: number;
  new_step_value: number | null;
  social_assistance_tax_rate: number;
  social_assistance_tax_amount: number;
  salary_after_tax: number;
  supplements_amount: number;
  family_allowance_amount: number;
};

export type BreakdownStep = {
  step_no: number;
  title: string;
  explain: string;
  before: number | null;
  after: number | null;
  op: string;
};

export type SalaryResult = {
  meta: SalaryMeta;
  inputs: SalaryInputs;
  components: SalaryComponents;
  breakdown_steps: BreakdownStep[];
  final_total: number;
  notes_for_user: string[];
};

/* -- Helpers -- */

function formatNum(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  try {
    return new Intl.NumberFormat("ar-LB").format(n);
  } catch {
    return String(n);
  }
}

function formatCurrency(n: number | null | undefined, currency?: string) {
  if (n === null || n === undefined) return "—";
  const formatted = formatNum(n);
  if (currency === "LBP") return formatted + " ل.ل";
  return formatted;
}

const OP_ICON: Record<string, string> = {
  lookup: "📋",
  subtract: "➖",
  add: "➕",
};

/* -- Component -- */

export default function SeniorPanel({
  result,
  onRequestRecalc,
}: {
  result: SalaryResult | null;
  onRequestRecalc?: () => void;
}) {
  const [fontSize, setFontSize] = useState<number>(18);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [simpleMode, setSimpleMode] = useState<boolean>(false);
  const [stepMode, setStepMode] = useState<boolean>(false);
  const [stepIndex, setStepIndex] = useState<number>(0);

  useEffect(() => {
    const fs = localStorage.getItem("senior_font_size");
    const hc = localStorage.getItem("senior_high_contrast");
    if (fs) setFontSize(Number.parseInt(fs, 10));
    if (hc) setHighContrast(hc === "1");
  }, []);
  useEffect(() => { localStorage.setItem("senior_font_size", String(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem("senior_high_contrast", highContrast ? "1" : "0"); }, [highContrast]);

  const steps = result?.breakdown_steps ?? [];
  const currency = result?.meta.currency ?? "LBP";

  const themeStyle: React.CSSProperties = useMemo(() => ({
    fontSize: `${fontSize}px`,
    lineHeight: 1.6,
    background: highContrast ? "#000" : "#f7f7f7",
    color: highContrast ? "#fff" : "#111",
    border: highContrast ? "2px solid #fff" : "1px solid #ddd",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    direction: "rtl" as const,
  }), [fontSize, highContrast]);

  const btnStyle: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 8,
    border: highContrast ? "1px solid #fff" : "1px solid #aaa",
    background: highContrast ? "#333" : "#fff",
    color: highContrast ? "#fff" : "#111",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: fontSize - 2,
  };

  if (!result) {
    return (
      <div style={themeStyle}>
        <div style={{ fontWeight: 700 }}>جاهز لمساعدتك</div>
        <div>بس اختار الرتبة والدرجة واضغط "احسب الراتب".</div>
      </div>
    );
  }

  const { meta, inputs, components: c } = result;

  return (
    <div style={themeStyle}>
      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800 }}>وضع كبار السن 🎖️</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            حجم الخط:&nbsp;
            <select value={fontSize} onChange={(e) => setFontSize(Number.parseInt(e.target.value, 10))} style={{ borderRadius: 6, padding: "2px 6px" }}>
              {[16, 18, 20, 22, 24].map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
            تباين عالي
          </label>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button style={btnStyle} onClick={() => { setSimpleMode(true); setStepMode(false); }}>شرح مبسّط</button>
        <button style={btnStyle} onClick={() => { setStepMode(true); setSimpleMode(false); setStepIndex(0); }}>خطوة خطوة</button>
        <button style={btnStyle} onClick={() => onRequestRecalc?.()}>إعادة الحساب</button>
      </div>

      {/* Result header */}
      <div style={{ marginTop: 14 }}>
        <div>الرتبة: <b>{meta.rank_ar}</b> — الدرجة: <b>{meta.step_no}</b></div>
        <div style={{ opacity: 0.8, fontSize: fontSize - 2 }}>(الجدول: {meta.group_code} · النفاذ: {meta.effective_date})</div>
        {inputs.marital_status === "married" && (
          <div style={{ opacity: 0.8, fontSize: fontSize - 2 }}>متأهل · أولاد: {inputs.children_count}</div>
        )}
      </div>

      {/* Final total banner */}
      <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 12, background: highContrast ? "#1a6b3c" : "#e6f5ec", fontWeight: 800, fontSize: fontSize + 2, textAlign: "center" }}>
        المجموع النهائي: {formatCurrency(result.final_total, currency)}
      </div>

      {/* Views */}
      <div style={{ marginTop: 14 }}>
        {!simpleMode && !stepMode && <DefaultView c={c} currency={currency} highContrast={highContrast} />}
        {simpleMode && <SimpleView meta={meta} c={c} currency={currency} finalTotal={result.final_total} />}
        {stepMode && <StepView steps={steps} stepIndex={stepIndex} setStepIndex={setStepIndex} currency={currency} highContrast={highContrast} fontSize={fontSize} btnStyle={btnStyle} />}
      </div>

      {/* Notes */}
      {result.notes_for_user.length > 0 && (
        <div style={{ marginTop: 14, padding: 10, borderRadius: 10, background: highContrast ? "#222" : "#fff8e1", border: highContrast ? "1px solid #555" : "1px solid #ffe082" }}>
          {result.notes_for_user.map((note, idx) => (
            <div key={`note-${idx}`} style={{ marginBottom: idx < result.notes_for_user.length - 1 ? 6 : 0 }}>💡 {note}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -- Sub-components -- */

function DefaultView({ c, currency, highContrast }: { c: SalaryComponents; currency: string; highContrast: boolean }) {
  const rows: [string, number][] = [
    ["الراتب الأساسي", c.base_salary],
  ];
  if (c.cola_amount) rows.push(["غلاء المعيشة", c.cola_amount]);
  if (c.social_assistance_tax_amount) rows.push([`اقتطاع مساعدات (${(c.social_assistance_tax_rate * 100).toFixed(1)}%)`, -c.social_assistance_tax_amount]);
  rows.push(["الراتب بعد الاقتطاع", c.salary_after_tax]);
  if (c.supplements_amount) rows.push(["المتممات", c.supplements_amount]);
  if (c.family_allowance_amount) rows.push(["التعويضات العائلية", c.family_allowance_amount]);

  return (
    <div>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>تفاصيل المكونات</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {rows.map(([label, val]) => (
            <tr key={label} style={{ borderBottom: highContrast ? "1px solid #444" : "1px solid #e0e0e0" }}>
              <td style={{ padding: "6px 4px" }}>{label}</td>
              <td style={{ padding: "6px 4px", fontWeight: 700, textAlign: "left" }}>
                {val < 0 ? `−${formatCurrency(Math.abs(val), currency)}` : formatCurrency(val, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10, opacity: 0.85 }}>إذا بتحب، فيني شرحلّك بطريقة أبسط أو خطوة خطوة.</div>
    </div>
  );
}

function SimpleView({ meta, c, currency, finalTotal }: { meta: SalaryMeta; c: SalaryComponents; currency: string; finalTotal: number }) {
  return (
    <div>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>شرح مبسّط (بدون تعقيد)</div>
      <ul style={{ margin: 0, paddingInlineStart: 20, listStyle: "disc" }}>
        <li>الرتبة: <b>{meta.rank_ar}</b> — الدرجة: <b>{meta.step_no}</b></li>
        <li>الراتب الأساسي: <b>{formatCurrency(c.base_salary, currency)}</b></li>
        {c.social_assistance_tax_amount > 0 && (
          <li>اقتطاع مساعدات ({(c.social_assistance_tax_rate * 100).toFixed(1)}%): <b>−{formatCurrency(c.social_assistance_tax_amount, currency)}</b></li>
        )}
        <li>الراتب بعد الاقتطاع: <b>{formatCurrency(c.salary_after_tax, currency)}</b></li>
        {c.supplements_amount > 0 && <li>المتممات: <b>{formatCurrency(c.supplements_amount, currency)}</b></li>}
        {c.family_allowance_amount > 0 && <li>التعويضات العائلية: <b>{formatCurrency(c.family_allowance_amount, currency)}</b></li>}
        <li style={{ fontWeight: 800, marginTop: 6 }}>المجموع النهائي: <b>{formatCurrency(finalTotal, currency)}</b></li>
      </ul>
      <div style={{ marginTop: 10, opacity: 0.85 }}>إذا بتحب، فيني أعرضلك "الخطوات وحدة وحدة".</div>
    </div>
  );
}

function StepView({ steps, stepIndex, setStepIndex, currency, highContrast, fontSize, btnStyle }: {
  steps: BreakdownStep[];
  stepIndex: number;
  setStepIndex: React.Dispatch<React.SetStateAction<number>>;
  currency: string;
  highContrast: boolean;
  fontSize: number;
  btnStyle: React.CSSProperties;
}) {
  const currentStep = steps[stepIndex];
  if (!steps.length || !currentStep) return <div>ما في خطوات كافية للعرض حالياً.</div>;

  return (
    <div>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>إعادة الحساب خطوة خطوة</div>
      <div style={{ padding: 12, borderRadius: 12, border: highContrast ? "1px solid #fff" : "1px solid #ccc", background: highContrast ? "#111" : "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: fontSize + 4 }}>{OP_ICON[currentStep.op] ?? "🔢"}</span>
          <span style={{ fontWeight: 800 }}>{currentStep.title}</span>
        </div>
        <div style={{ marginTop: 6, opacity: 0.9 }}>{currentStep.explain}</div>
        <div style={{ marginTop: 10, display: "flex", gap: 20 }}>
          {currentStep.before !== null && <div>قبل: <b>{formatCurrency(currentStep.before, currency)}</b></div>}
          <div>بعد: <b style={{ color: highContrast ? "#4f8" : "#1a6b3c" }}>{formatCurrency(currentStep.after, currency)}</b></div>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ marginTop: 10, background: highContrast ? "#333" : "#e0e0e0", borderRadius: 6, height: 6 }}>
        <div style={{ width: `${((stepIndex + 1) / steps.length) * 100}%`, background: "#1a6b3c", borderRadius: 6, height: 6, transition: "width 0.3s ease" }} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "space-between", alignItems: "center" }}>
        <button style={{ ...btnStyle, opacity: stepIndex === 0 ? 0.4 : 1 }} onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0}>← السابق</button>
        <div style={{ fontWeight: 700 }}>{stepIndex + 1} / {steps.length}</div>
        <button style={{ ...btnStyle, opacity: stepIndex === steps.length - 1 ? 0.4 : 1 }} onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))} disabled={stepIndex === steps.length - 1}>التالي →</button>
      </div>
    </div>
  );
}
