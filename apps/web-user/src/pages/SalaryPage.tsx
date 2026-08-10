import { WatanyFeatureTemplate } from "../components/template";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterclockwise24Regular,
  ArrowLeft24Regular,
  ArrowRight24Regular,
  Warning24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import type { PensionCalcResult, SalaryMeta } from "../types/domain";
import { api } from "../lib/api";
import { useApp } from "../store/app";
import { PopupModal } from "../components/PopupModal";
import { fmtLBP as fmt } from "../lib/format";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/SalaryCalculator.css";

const SIX_INCREMENTS_FACTOR = 1.214;
const FIFTY_PERCENT_INCREASE = 1.5;

type LocalSalaryRow = {
  category: string;
  rank: string;
  degree: number;
  basicSalary: number;
  degreeValue: number;
  vetSalary: number;
  equipment: number;
  driver: number;
  position: number;
  grant2025: number;
  d13020: number;
  d11227_2: number;
  d11227_1: number;
  budget2022: number;
  val2019: number;
  pension2026: number;
  pension2026usd: number;
  val2019usd: number;
  pct2019: number;
  sixSalary: number;
  totalSalary2026usd: number;
  sixPct: number;
  fiftyPct: number;
};

type LocalSalaryTable = { rows: LocalSalaryRow[] };
type LocalSalaryRankMeta = {
  familyAllowance?: { wife: number; perChild: number };
  familyAllowanceAfterRaise?: { wife: number; perChild: number; note_ar?: string };
  usdRate?: number;
  ranks?: Array<{ rank: string; category: string; maxDegree: number }>;
  ornamentChoices?: Array<{ id: string; name_ar: string; monthlyValue: number; annualValue: number }>;
};

const LOCAL_SALARY_ROWS: LocalSalaryTable["rows"] = [];
const LOCAL_RANK_META: LocalSalaryRankMeta = {};
const LOCAL_FALLBACK_RANKS = [
  "جندي", "جندي أول", "عريف", "رقيب", "رقيب أول", "مساعد", "مساعد أول",
  "ملازم", "ملازم أول", "نقيب", "رائد", "مقدم", "عقيد", "عميد", "لواء",
];

const HIDDEN_PUBLIC_RANKS = new Set(["عماد", "لواء"]);

const SOLDIER_RANKS = new Set([
  "جندي", "جندي أول", "عريف", "رقيب", "رقيب أول", "مساعد", "مساعد أول",
]);

function categoryForRank(rank: string) {
  if (SOLDIER_RANKS.has(rank)) return "الرتباء والأفراد";
  return "الضباط";
}

const LOCAL_SALARY_USD_RATE = LOCAL_RANK_META.usdRate ?? 89500;
const LOCAL_FAMILY_ALLOWANCE = LOCAL_RANK_META.familyAllowance ?? { wife: 60000, perChild: 33000 };
const LOCAL_FAMILY_ALLOWANCE_AFTER_RAISE = LOCAL_RANK_META.familyAllowanceAfterRaise ?? {
  wife: 2100000,
  perChild: 1160000,
  note_ar: "القيم المقترحة بعد إقرار الزيادة في مجلس النواب",
};

function buildLocalSalaryMeta(): SalaryMeta {
  const ranks = LOCAL_RANK_META.ranks && LOCAL_RANK_META.ranks.length > 0
    ? LOCAL_RANK_META.ranks
    : Array.from(
        LOCAL_SALARY_ROWS.reduce((acc, entry) => {
          const current = acc.get(entry.rank) ?? 0;
          acc.set(entry.rank, Math.max(current, entry.degree));
          return acc;
        }, new Map<string, number>()),
        ([rank, maxDegree]) => ({ rank, category: categoryForRank(rank), maxDegree }),
      );
  const fallbackRanks = ranks.length > 0
    ? ranks
    : LOCAL_FALLBACK_RANKS.map((rank) => ({ rank, category: categoryForRank(rank), maxDegree: 20 }));

  return {
    ranks: fallbackRanks.filter((entry) => !HIDDEN_PUBLIC_RANKS.has(entry.rank)),
    familyAllowance: LOCAL_FAMILY_ALLOWANCE,
    familyAllowanceAfterRaise: LOCAL_FAMILY_ALLOWANCE_AFTER_RAISE,
    ornamentChoices: LOCAL_RANK_META.ornamentChoices ?? [],
    usdRate: LOCAL_SALARY_USD_RATE,
  };
}

function buildLocalSalaryResult(
  input: { rank: string; degree: number; married: boolean; kidsCount: number; selectedOrnaments: string[] },
  meta: SalaryMeta | null,
): PensionCalcResult | null {
  const exactEntry = LOCAL_SALARY_ROWS.find((entry) => entry.rank === input.rank && entry.degree === input.degree);
  const nearestRankEntry = LOCAL_SALARY_ROWS
    .filter((entry) => entry.rank === input.rank)
    .sort((left, right) => Math.abs(left.degree - input.degree) - Math.abs(right.degree - input.degree))[0];
  const fallbackEntry = exactEntry ?? nearestRankEntry ?? LOCAL_SALARY_ROWS[0];

  if (!fallbackEntry) return null;

  const grossPension2026 = Math.round(Number(fallbackEntry.pension2026 || 0));
  const deduction15Pct = Math.round(Number(fallbackEntry.vetSalary || 0) * 0.015);
  const pensionCurrent = Math.max(0, grossPension2026 - deduction15Pct);
  const pensionAfterSixRaise = Math.round(pensionCurrent * SIX_INCREMENTS_FACTOR);
  const pensionAfterFiftyPct = Math.round(pensionCurrent * FIFTY_PERCENT_INCREASE);
  const familyAllowance = {
    wife: input.married ? LOCAL_FAMILY_ALLOWANCE.wife : 0,
    children: input.kidsCount * LOCAL_FAMILY_ALLOWANCE.perChild,
  };
  const familyAllowanceAfterRaise = {
    wife: input.married ? LOCAL_FAMILY_ALLOWANCE_AFTER_RAISE.wife : 0,
    children: input.kidsCount * LOCAL_FAMILY_ALLOWANCE_AFTER_RAISE.perChild,
  };
  const ornamentChoices = meta?.ornamentChoices ?? [];
  const medalItems = ornamentChoices
    .filter((choice) => input.selectedOrnaments.includes(choice.id))
    .map((choice) => ({ id: choice.id, name_ar: choice.name_ar, monthlyValue: choice.monthlyValue ?? 0 }));
  const medalsTotal = medalItems.reduce((sum, medal) => sum + medal.monthlyValue, 0);
  const totalPension = pensionCurrent + familyAllowance.wife + familyAllowance.children + medalsTotal;
  const totalAfterSixRaise = pensionAfterSixRaise + familyAllowanceAfterRaise.wife + familyAllowanceAfterRaise.children + medalsTotal;
  const totalAfterFiftyPct = pensionAfterFiftyPct + familyAllowanceAfterRaise.wife + familyAllowanceAfterRaise.children + medalsTotal;

  return {
    input: {
      rank: input.rank,
      degree: input.degree,
      married: input.married,
      kidsCount: input.kidsCount,
      selectedOrnaments: input.selectedOrnaments,
    },
    usdRate: LOCAL_SALARY_USD_RATE,
    totalPension,
    totalPensionUsd: totalPension / LOCAL_SALARY_USD_RATE,
    breakdown: {
      basicSalary: Number(fallbackEntry.basicSalary || 0),
      vetSalary: Number(fallbackEntry.vetSalary || 0),
      equipment: Number(fallbackEntry.equipment || 0),
      driver: Number(fallbackEntry.driver || 0),
      position: Number(fallbackEntry.position || 0),
      aids: {
        grant2025: Number(fallbackEntry.grant2025 || 0),
        d13020: Number(fallbackEntry.d13020 || 0),
        d11227_2: Number(fallbackEntry.d11227_2 || 0),
        d11227_1: Number(fallbackEntry.d11227_1 || 0),
        budget2022: Number(fallbackEntry.budget2022 || 0),
      },
      deduction15Pct,
      pension2026: pensionCurrent,
      pension2026usd: pensionCurrent / LOCAL_SALARY_USD_RATE,
      familyAllowance: {
        wife: familyAllowance.wife,
        children: familyAllowance.children,
        total: familyAllowance.wife + familyAllowance.children,
      },
      medals: {
        total: medalsTotal,
        items: medalItems,
      },
    },
    raise: {
      sixSalary: Math.max(0, pensionAfterSixRaise - pensionCurrent),
      pensionAfterSixRaise,
      pensionAfterSixRaiseUsd: pensionAfterSixRaise / LOCAL_SALARY_USD_RATE,
      familyAfterRaise: {
        wife: familyAllowanceAfterRaise.wife,
        children: familyAllowanceAfterRaise.children,
        total: familyAllowanceAfterRaise.wife + familyAllowanceAfterRaise.children,
      },
      totalAfterSixRaise,
      totalAfterSixRaiseUsd: totalAfterSixRaise / LOCAL_SALARY_USD_RATE,
    },
    fiftyPctRaise: {
      additionalRaise: Math.max(0, pensionAfterFiftyPct - pensionCurrent),
      pensionAfterFiftyPct,
      pensionAfterFiftyPctUsd: pensionAfterFiftyPct / LOCAL_SALARY_USD_RATE,
      familyAfterRaise: {
        wife: familyAllowanceAfterRaise.wife,
        children: familyAllowanceAfterRaise.children,
        total: familyAllowanceAfterRaise.wife + familyAllowanceAfterRaise.children,
      },
      totalAfterFiftyPct,
      totalAfterFiftyPctUsd: totalAfterFiftyPct / LOCAL_SALARY_USD_RATE,
    },
  } as PensionCalcResult;
}

// searchSalary2019 removed — unused helper

type SalaryStep = 'rank' | 'degree' | 'family' | 'kids' | 'medals';
type SalaryResultScenario = 'current' | 'six' | 'half' | 'installment';
type SectionIndex = 0 | 1 | 2 | 3;
type SalaryMetaStatus = 'ready' | 'partial_data_loaded' | 'metadata_missing' | 'server_unavailable';

type SalaryPageViewProps = Readonly<{
  meta: SalaryMeta | null;
  metaErr: string;
  metaStatus: SalaryMetaStatus;
  metaStatusNote: string;
  metaLoading: boolean;
  rank: string;
  degree: number;
  married: boolean;
  kidsCount: number;
  selectedOrnaments: string[];
  selectedOrnament: { name_ar: string } | null;
  maxDeg: number;
  currentStep: SalaryStep;
  currentStepIndex: number;
  steps: SalaryStep[];
  result: PensionCalcResult | null;
  resultScenario: SalaryResultScenario;
  loading: boolean;
  error: string;
  openSection: SectionIndex;
  showRankPicker: boolean;
  showDegreePicker: boolean;
  showFamilyPicker: boolean;
  showKidsPicker: boolean;
  showMedalsPicker: boolean;
  showResultsPopup: boolean;
  resultSectionRef: React.RefObject<HTMLElement>;
  isSingle: boolean;
  calcButtonContent: React.ReactNode;
  loadMeta: () => void;
  startWizard: () => void;
  calculate: (overrideOrnaments?: string[]) => Promise<void>;
  closeAllPickers: () => void;
  goToPreviousStep: () => void;
  goToNextStep: () => void;
  setResultScenario: (value: SalaryResultScenario) => void;
  setOpenSection: (value: SectionIndex) => void;
  setShowResultsPopup: (value: boolean) => void;
  setShowRankPicker: (value: boolean) => void;
  setShowDegreePicker: (value: boolean) => void;
  setShowFamilyPicker: (value: boolean) => void;
  setShowKidsPicker: (value: boolean) => void;
  setShowMedalsPicker: (value: boolean) => void;
  setRank: (value: string) => void;
  setDegree: (value: number) => void;
  setMarried: (value: boolean) => void;
  setKidsCount: (value: number) => void;
  setSelectedOrnaments: (value: string[]) => void;
  selectOrnament: (value: string) => void;
}>;

function SalaryResultsContent({
  result,
  resultScenario,
  openSection,
  setOpenSection,
}: Readonly<{
  result: PensionCalcResult;
  resultScenario: SalaryResultScenario;
  openSection: SectionIndex;
  setOpenSection: (value: SectionIndex) => void;
}>) {
  const b = result.breakdown;

  const num = (value: unknown, fallback = 0) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
  const toUsd = (amount: number, fallback?: number) => {
    if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
    const usdRate = result.usdRate;
    return typeof usdRate === "number" && usdRate > 0 ? amount / usdRate : 0;
  };

  const normalizeFamilyAllowance = (allowance?: { wife?: number; children?: number; total?: number }) => {
    const wife = num(allowance?.wife);
    const children = num(allowance?.children);
    return { wife, children, total: num(allowance?.total, wife + children) };
  };

  const normalizeMedals = (medals?: { total?: number; items?: Array<{ id?: string; name_ar?: string; monthlyValue?: number }> }) => {
    const items = (medals?.items ?? []).map((medal, index) => ({
      id: medal.id ?? `medal-${index}`,
      name_ar: medal.name_ar ?? "وسام",
      monthlyValue: num(medal.monthlyValue),
    }));
    return { items, total: num(medals?.total, items.reduce((sum, medal) => sum + medal.monthlyValue, 0)) };
  };

  const deduction15Pct = b.deduction15Pct;
  const currentMedals = normalizeMedals(b.medals);
  let scenario = {
    sectionTitle: 'المعاش الحالي',
    summary: num(result.totalPension),
    summaryUsd: toUsd(num(result.totalPension), result.totalPensionUsd),
    pension: num(b.pension2026),
    pensionUsd: toUsd(num(b.pension2026), b.pension2026usd),
    familyAllowance: normalizeFamilyAllowance(b.familyAllowance),
    extraGrantLabel: '',
    extraGrantValue: 0,
    deduction: num(deduction15Pct),
    medals: currentMedals,
  };

  if (resultScenario === 'six') {
    const familyAllowance = normalizeFamilyAllowance(result.raise.familyAfterRaise);
    const pension = num(result.raise.pensionAfterSixRaise, num(result.raise.totalAfterSixRaise) - familyAllowance.total - currentMedals.total);
    scenario = {
      sectionTitle: 'زائد 6 أضعاف',
      summary: num(result.raise.totalAfterSixRaise),
      summaryUsd: toUsd(num(result.raise.totalAfterSixRaise), result.raise.totalAfterSixRaiseUsd),
      pension,
      pensionUsd: toUsd(pension, result.raise.pensionAfterSixRaiseUsd),
      familyAllowance,
      extraGrantLabel: 'الزيادة الإضافية وفق 6 أضعاف',
      extraGrantValue: num(result.raise.sixSalary),
      deduction: num(deduction15Pct),
      medals: currentMedals,
    };
  } else if (resultScenario === 'installment') {
    const familyAllowance = normalizeFamilyAllowance(result.raise.familyAfterRaise);
    const sixIncrease = num(result.raise.sixSalary);
    const nineIncrease = Math.round(sixIncrease * 9 / 6);
    const pension = num(b.pension2026) + nineIncrease;
    const totalAfterNineRaise = pension + familyAllowance.total + currentMedals.total;
    scenario = {
      sectionTitle: 'معاش تقسيط',
      summary: totalAfterNineRaise,
      summaryUsd: totalAfterNineRaise / (result.usdRate || 1),
      pension,
      pensionUsd: toUsd(pension, result.raise.pensionAfterSixRaiseUsd),
      familyAllowance,
      extraGrantLabel: 'الزيادة الإضافية وفق 9 أضعاف',
      extraGrantValue: nineIncrease,
      deduction: num(deduction15Pct),
      medals: currentMedals,
    };
  } else if (resultScenario === 'half') {
    const familyAllowance = normalizeFamilyAllowance(result.fiftyPctRaise.familyAfterRaise);
    const pension = num(result.fiftyPctRaise.pensionAfterFiftyPct, num(result.fiftyPctRaise.totalAfterFiftyPct) - familyAllowance.total - currentMedals.total);
    scenario = {
      sectionTitle: 'زائد 50%',
      summary: num(result.fiftyPctRaise.totalAfterFiftyPct),
      summaryUsd: toUsd(num(result.fiftyPctRaise.totalAfterFiftyPct), result.fiftyPctRaise.totalAfterFiftyPctUsd),
      pension,
      pensionUsd: toUsd(pension, result.fiftyPctRaise.pensionAfterFiftyPctUsd),
      familyAllowance,
      extraGrantLabel: 'الزيادة الإضافية للوصول إلى 50% من راتب 2019',
      extraGrantValue: num(result.fiftyPctRaise.additionalRaise),
      deduction: num(deduction15Pct),
      medals: currentMedals,
    };
  }

  const childAllowancePerChild = result.input.kidsCount > 0 ? Math.round(scenario.familyAllowance.children / result.input.kidsCount) : 0;

  return (
    <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-results">
      <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-total-banner">
        <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-total-banner__label">{resultScenario === 'installment' ? 'المعاش الشهري بعد 9 أضعاف' : 'المعاش الشهري الإجمالي'}</span>
        <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-total-banner__value">{fmt(scenario.summary)}</span>
        <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-total-banner__currency">ل.ل.</span>
        <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-total-banner__usd">≈ {scenario.summaryUsd.toFixed(2)} $</span>
      </div>
      <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-result-metrics" aria-label="ملخص النتيجة">
        <div className="sc-result-metric">
          <span className="sc-result-metric__label">المعاش الأساسي</span>
          <strong className="sc-result-metric__value">{fmt(scenario.pension)}</strong>
          <small>ل.ل.</small>
        </div>
        <div className="sc-result-metric">
          <span className="sc-result-metric__label">التعويضات العائلية</span>
          <strong className="sc-result-metric__value">{fmt(scenario.familyAllowance.total)}</strong>
          <small>ل.ل.</small>
        </div>
        <div className="sc-result-metric">
          <span className="sc-result-metric__label">الأوسمة</span>
          <strong className="sc-result-metric__value">{fmt(scenario.medals.total)}</strong>
          <small>ل.ل.</small>
        </div>
      </div>
      <div className={`sc-section ${openSection === 1 ? "open" : ""}`}>
        <button
          type="button"
          className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-section__head"
          aria-expanded={openSection === 1}
          onClick={() => setOpenSection(openSection === 1 ? 0 : 1)}
        >
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-section__dot sc-section__dot--blue" />
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-section__title">{scenario.sectionTitle}</span>
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-section__sum">{fmt(scenario.summary)} ل.ل.</span>
          <span aria-hidden="true" className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-section__arrow">▼</span>
        </button>
        {openSection === 1 && (
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-section__body">
            <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breakdown">
              <div className="sc-breakdown__group sc-breakdown__group--core">
                <div className="sc-breakdown__group-title">الأساس والمتممات</div>
                <div className="sc-breakdown__rows">
                  <BRow label="أساس الراتب" value={b.basicSalary} />
                  <BRow label="المعاش التقاعدي (85%)" value={b.vetSalary} />
                  {b.equipment > 0 && <BRow label="تجهيزات (جدول 6)" value={b.equipment} muted />}
                  {b.driver > 0 && <BRow label="بدل سائق" value={b.driver} muted />}
                  {b.position > 0 && <BRow label="متممات منصب" value={b.position} muted />}
                  {b.aids.grant2025 > 0 && <BRow label="منحة 2025" value={b.aids.grant2025} muted variant="aid" />}
                  {b.aids.d13020 > 0 && <BRow label="مرسوم 13020" value={b.aids.d13020} muted variant="aid" />}
                  {b.aids.d11227_2 > 0 && <BRow label="مرسوم 11227/2" value={b.aids.d11227_2} muted variant="aid" />}
                  {b.aids.d11227_1 > 0 && <BRow label="مرسوم 11227/1" value={b.aids.d11227_1} muted variant="aid" />}
                  {b.aids.budget2022 > 0 && <BRow label="موازنة 2022" value={b.aids.budget2022} muted variant="aid" />}
                  {scenario.extraGrantValue > 0 && <BRow label={scenario.extraGrantLabel} value={scenario.extraGrantValue} accent />}
                  {scenario.deduction > 0 && <BRow label="اقتطاع 1.5 % =" value={-scenario.deduction} muted />}
                  <BRow label="إجمالي المعاش قبل التعويضات العائلية" value={scenario.pension} bold />
                  <BRowUsd label={`≈ ${scenario.pensionUsd.toFixed(2)} $`} accent />
                </div>
              </div>

              {(scenario.familyAllowance.wife > 0 || scenario.familyAllowance.children > 0) && (
                <div className="sc-breakdown__group sc-breakdown__group--family">
                  <div className="sc-breakdown__group-title">التعويضات العائلية</div>
                  <div className="sc-breakdown__rows">
                    {scenario.familyAllowance.wife > 0 && <BRow label="تعويض زوجة" value={scenario.familyAllowance.wife} muted />}
                    {scenario.familyAllowance.children > 0 && <BRow label={`تعويض أولاد (${result.input.kidsCount} × ${fmt(childAllowancePerChild)})`} value={scenario.familyAllowance.children} muted />}
                  </div>
                </div>
              )}

              {scenario.medals.total > 0 && (
                <div className="sc-breakdown__group sc-breakdown__group--medals">
                  <div className="sc-breakdown__group-title">الأوسمة</div>
                  <div className="sc-breakdown__rows">
                    {scenario.medals.items.map((m) => <BRow key={m.id} label={m.name_ar} value={m.monthlyValue} muted />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-results-disclaimer" data-testid="salary-results-disclaimer">
        هذا الاحتساب تقريبي للاستئناس فقط، والنتيجة النهائية ليست رسمية ولا تُعد مرجعاً معتمداً.
      </div>
    </div>
  );
}

function SalaryPageView({ // NOSONAR: rendering composition for multi-step wizard
  meta,
  metaErr,
  metaStatus,
  metaStatusNote,
  metaLoading,
  rank,
  degree,
  married,
  kidsCount,
  selectedOrnaments,
  selectedOrnament,
  maxDeg,
  currentStep: _currentStep,
  currentStepIndex,
  steps,
  result,
  resultScenario,
  loading,
  error,
  openSection,
  showRankPicker,
  showDegreePicker,
  showFamilyPicker,
  showKidsPicker,
  showMedalsPicker,
  showResultsPopup,
  resultSectionRef,
  isSingle,
  calcButtonContent,
  loadMeta,
  startWizard,
  calculate,
  closeAllPickers,
  goToPreviousStep,
  goToNextStep,
  setResultScenario,
  setOpenSection,
  setShowResultsPopup,
  setShowRankPicker,
  setShowDegreePicker,
  setShowFamilyPicker,
  setShowKidsPicker,
  setShowMedalsPicker,
  setRank,
  setDegree,
  setMarried,
  setKidsCount,
  setSelectedOrnaments,
  selectOrnament,
}: SalaryPageViewProps) {
  const b = result?.breakdown;
  let metaStatusWarning = "";
  if (metaStatus === 'server_unavailable') {
    metaStatusWarning = 'الخادم غير متاح حالياً. يتم عرض تقدير محلي مؤقت حتى عودة الخدمة.';
  } else if (metaStatus === 'metadata_missing') {
    metaStatusWarning = 'بيانات الرواتب غير مكتملة حالياً. قد لا تظهر كل الرتب أو الدرجات أو الأوسمة.';
  } else if (metaStatus === 'partial_data_loaded') {
    metaStatusWarning = 'تم تحميل جزء من بيانات الرواتب فقط. راجع الحالة قبل اعتماد النتيجة.';
  }

  if (metaErr) return (
    <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-page">
      <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-error-state">
        <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-error-state__icon"><Warning24Regular aria-hidden /></span>
        <p className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-error-state__text">{metaErr}</p>
        <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn wt-cta-glow wt-cta-processing" onClick={loadMeta} disabled={metaLoading} aria-busy={metaLoading}>
          {metaLoading ? "جارٍ إعادة المحاولة…" : <><ArrowCounterclockwise24Regular aria-hidden /> إعادة المحاولة</>}
        </button>
      </div>
    </div>
  );
  if (meta == null) return (
    <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-page">
      <div className="wmo-service-route wmo-rebuilt-route wmo-core-route screen-loader">
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route screen-loader__spinner" />
        <span>جارٍ تحميل بيانات المعاش والمستحقات… يرجى الانتظار حتى تكتمل المزامنة المحلية.</span>
      </div>
    </div>
  );
  return (
    <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-page">
      {error && <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-alert sc-alert--danger">{error}</div>}
      {metaStatus === 'ready' ? null : (
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-alert sc-alert--warn">
          {metaStatusWarning}
          {metaStatusNote ? ` (${metaStatusNote})` : ''}
        </div>
      )}
      <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-card">
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-card__title-row">
          <div>
            <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-card__eyebrow">تقدير سريع بخمس خطوات</span>
            <h3 className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-card__header">حاسبة المعاش</h3>
            <p className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-card__subheader sc-card__disclaimer">الاحتساب ادناه هو تقريبي والنتيجة ليست رسمية ولا تُعد مرجعاً معتمداً.</p>
          </div>
        </div>
      </div>

      <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-calc-launcher">
        <p className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-calc-launcher__instruction">الخطوة الأولى: اضغط الزر للبدء</p>
        <button
          className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-calc-btn wt-cta-glow wt-cta-processing wt-guided-action"
          onClick={startWizard}
          disabled={loading}
          aria-busy={loading}
        >
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-calc-btn__label">{calcButtonContent}</span>
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-calc-btn__hint">يستغرق أقل من دقيقة</span>
        </button>
      </div>

      {result ? (
        <section className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-inline-results" ref={resultSectionRef} tabIndex={-1} aria-live="polite" aria-label="نتيجة الاحتساب">
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb">
            <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb-value">{rank} | درجة {degree} | {married ? 'متأهل' : 'عازب'} | {kidsCount} أولاد {selectedOrnament ? `| ${selectedOrnament.name_ar}` : '| بدون وسام'}</span>
          </div>
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-result-tabs" role="tablist" aria-label="سيناريوهات المعاش">
            <button type="button" role="tab" aria-selected={resultScenario === 'current'} className={resultScenario === 'current' ? 'active' : ''} onClick={() => setResultScenario('current')}>المعاش الحالي</button>
            <button type="button" role="tab" aria-selected={resultScenario === 'six'} className={resultScenario === 'six' ? 'active' : ''} onClick={() => setResultScenario('six')}>زائد 6 أضعاف</button>
            <button type="button" role="tab" aria-selected={resultScenario === 'installment'} className={resultScenario === 'installment' ? 'active' : ''} onClick={() => setResultScenario('installment')}>معاش تقسيط</button>
            <button type="button" role="tab" aria-selected={resultScenario === 'half'} className={resultScenario === 'half' ? 'active' : ''} onClick={() => setResultScenario('half')}>زائد 50%</button>
          </div>
          {b ? <SalaryResultsContent result={result} resultScenario={resultScenario} openSection={openSection} setOpenSection={setOpenSection} /> : null}
        </section>
      ) : null}

      <PopupModal open={showResultsPopup} title="نتيجة الاحتساب" onClose={() => setShowResultsPopup(false)} compactMobile>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb">
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb-value">{rank} | درجة {degree} | {married ? 'متأهل' : 'عازب'} | {kidsCount} أولاد {selectedOrnaments.length > 0 ? `| ${meta?.ornamentChoices.find(o => o.id === selectedOrnaments[0])?.name_ar}` : ''}</span>
        </div>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-result-tabs" role="tablist" aria-label="سيناريوهات المعاش">
          <button type="button" role="tab" aria-selected={resultScenario === 'current'} className={resultScenario === 'current' ? 'active' : ''} onClick={() => setResultScenario('current')}>المعاش الحالي</button>
          <button type="button" role="tab" aria-selected={resultScenario === 'six'} className={resultScenario === 'six' ? 'active' : ''} onClick={() => setResultScenario('six')}>زائد 6 أضعاف</button>
          <button type="button" role="tab" aria-selected={resultScenario === 'installment'} className={resultScenario === 'installment' ? 'active' : ''} onClick={() => setResultScenario('installment')}>معاش تقسيط</button>
          <button type="button" role="tab" aria-selected={resultScenario === 'half'} className={resultScenario === 'half' ? 'active' : ''} onClick={() => setResultScenario('half')}>زائد 50%</button>
        </div>
        {b ? <SalaryResultsContent result={result} resultScenario={resultScenario} openSection={openSection} setOpenSection={setOpenSection} /> : null}
      </PopupModal>

      <PopupModal open={showRankPicker} title="اختر الرتبة" onClose={() => setShowRankPicker(false)} hideHeader mobileStickyAnchor compactMobile>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-tab-header">① اختر الرتبة</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled={currentStepIndex <= 0} onClick={goToPreviousStep} title="الخطوة السابقة"><ArrowRight24Regular aria-hidden /> للخلف</button>
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-step-counter">{currentStepIndex + 1} من {steps.length}</span>
          <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled={currentStepIndex >= steps.length - 1} onClick={goToNextStep} title="الخطوة التالية">للأمام <ArrowLeft24Regular aria-hidden /></button>
        </div>
        <div className="sc-picker-grid__count">عرض {meta.ranks.length} رتبة</div>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-picker-grid sc-picker-grid--ranks">
          {meta.ranks.map((r) => (
            <button key={r.rank} className={`sc-picker-chip ${rank === r.rank ? "active" : ""}`} onClick={() => { setRank(r.rank); setDegree(1); setResultScenario('current'); setShowRankPicker(false); setTimeout(() => setShowDegreePicker(true), 250); }}>{r.rank}</button>
          ))}
        </div>
      </PopupModal>

      <PopupModal open={showDegreePicker} title="اختر الدرجة" onClose={() => setShowDegreePicker(false)} hideHeader mobileStickyAnchor compactMobile>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-tab-header">② اختر الدرجة</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled={currentStepIndex <= 0} onClick={goToPreviousStep} title="الخطوة السابقة"><ArrowRight24Regular aria-hidden /> للخلف</button>
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-step-counter">{currentStepIndex + 1} من {steps.length}</span>
          <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled={currentStepIndex >= steps.length - 1} onClick={goToNextStep} title="الخطوة التالية">للأمام <ArrowLeft24Regular aria-hidden /></button>
        </div>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb"><span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb-value">{rank}</span></div>
        <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-secondary" style={{ marginBottom: 12 }} onClick={() => { setDegree(1); setShowDegreePicker(false); setTimeout(() => setShowFamilyPicker(true), 250); }}>لا أعرف</button>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-picker-grid sc-picker-grid--numbers">
          {Array.from({ length: maxDeg }, (_, i) => i + 1).map((d) => (
            <button key={d} className={`sc-picker-chip sc-picker-chip--num ${degree === d ? "active" : ""}`} onClick={() => { setDegree(d); setShowDegreePicker(false); setTimeout(() => setShowFamilyPicker(true), 250); }}>{d}</button>
          ))}
        </div>
      </PopupModal>

      <PopupModal open={showFamilyPicker} title="الوضع العائلي" onClose={() => setShowFamilyPicker(false)} hideHeader mobileStickyAnchor compactMobile>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-tab-header">③ الوضع العائلي</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled={currentStepIndex <= 0} onClick={goToPreviousStep} title="الخطوة السابقة"><ArrowRight24Regular aria-hidden /> للخلف</button>
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-step-counter">{currentStepIndex + 1} من {steps.length}</span>
          <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled={currentStepIndex >= steps.length - 1} onClick={goToNextStep} title="الخطوة التالية">للأمام <ArrowLeft24Regular aria-hidden /></button>
        </div>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb"><span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb-value">{rank} | درجة {degree}</span></div>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-picker-grid sc-family-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button className={`sc-picker-chip sc-picker-chip--wide sc-family-choice ${isSingle ? "active" : ""}`} aria-label="اختيار عازب" onClick={() => { setMarried(false); setShowFamilyPicker(false); setTimeout(() => setShowKidsPicker(true), 250); }}>
            <span className="sc-family-choice__label">عازب</span>
          </button>
          <button className={`sc-picker-chip sc-picker-chip--wide sc-family-choice ${married ? "active" : ""}`} aria-label="اختيار متأهل" onClick={() => { setMarried(true); setShowFamilyPicker(false); setTimeout(() => setShowKidsPicker(true), 250); }}>
            <span className="sc-family-choice__label">متأهل</span>
          </button>
        </div>
      </PopupModal>

      <PopupModal open={showKidsPicker} title="عدد الأولاد على العاتق" onClose={() => setShowKidsPicker(false)} hideHeader mobileStickyAnchor compactMobile>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-tab-header">④ اختر فقط عدد الأولاد على العاتق</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled={currentStepIndex <= 0} onClick={goToPreviousStep} title="الخطوة السابقة"><ArrowRight24Regular aria-hidden /> للخلف</button>
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-step-counter">{currentStepIndex + 1} من {steps.length}</span>
          <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled={currentStepIndex >= steps.length - 1} onClick={goToNextStep} title="الخطوة التالية">للأمام <ArrowLeft24Regular aria-hidden /></button>
        </div>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb"><span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb-value">{rank} | درجة {degree} | {married ? 'متأهل' : 'عازب'}</span></div>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-picker-grid sc-picker-grid--numbers sc-kids-grid">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`sc-picker-chip sc-picker-chip--num ${kidsCount === n ? "active" : ""}`} onClick={() => { setKidsCount(n); setShowKidsPicker(false); setTimeout(() => setShowMedalsPicker(true), 250); }}>{n}</button>
          ))}
        </div>
      </PopupModal>

      <PopupModal open={showMedalsPicker} title="اختر الوسام" onClose={() => setShowMedalsPicker(false)} hideHeader mobileStickyAnchor compactMobile>
        <div className="sc-medals-step">
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-tab-header">⑤ اختر الوسام</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled={currentStepIndex <= 0} onClick={goToPreviousStep} title="الخطوة السابقة"><ArrowRight24Regular aria-hidden /> للخلف</button>
            <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-step-counter">{currentStepIndex + 1} من {steps.length}</span>
            <button className="wmo-service-route wmo-rebuilt-route wmo-core-route btn sc-nav-btn" disabled title="هذه الخطوة الأخيرة">للأمام <ArrowLeft24Regular aria-hidden /></button>
          </div>
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb"><span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-breadcrumb-value">{rank} | درجة {degree} | {married ? 'متأهل' : 'عازب'} | {kidsCount} أولاد</span></div>
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-medals-bottom sc-medals-picker">
            <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-medals-grid sc-medals-grid--mobile-fit">
              <button
                type="button"
                className={`sc-medal-item sc-medal-unknown ${selectedOrnaments.length === 0 ? 'active' : ''}`}
                onClick={() => { setSelectedOrnaments([]); closeAllPickers(); calculate([]); }}
                aria-label="لا أعلم، احتساب الراتب بدون أوسمة"
              >
                <span className="sc-medal-info">
                  <span className="sc-medal-name">لا أعلم</span>
                  <span className="sc-medal-val">احتساب بدون أوسمة</span>
                </span>
              </button>
              {[...meta.ornamentChoices].reverse().map((o) => (
                <button key={o.id} type="button" data-feature-key={o.id} className={`sc-medal-item ${selectedOrnaments[0] === o.id ? 'active' : ''}`} onClick={() => { selectOrnament(o.id); closeAllPickers(); calculate([o.id]); }} aria-label={o.name_ar}>
                  <input type="radio" readOnly checked={selectedOrnaments[0] === o.id} tabIndex={-1} aria-hidden="true" />
                  <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-medal-check" />
                  <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-medal-info"><span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-medal-name">{o.name_ar}</span><span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-medal-val">{fmt(o.monthlyValue)} ل.ل./شهر</span></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopupModal>

      <section className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-guide" aria-label="خطوات الاحتساب">
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-summary">
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-summary__text">ما الذي سيُطلب أثناء الاحتساب؟</span>
          <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-summary__meta">5 خطوات سريعة</span>
        </div>
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-steps">
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step"><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__num">①</div><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__content"><strong>الرتبة</strong><p>ابدأ بتحديد الرتبة العسكرية المناسبة.</p></div></div>
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step"><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__num">②</div><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__content"><strong>الدرجة</strong><p>اختر الدرجة ضمن الرتبة أو استخدم خيار لا أعرف.</p></div></div>
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step"><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__num">③</div><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__content"><strong>الوضع العائلي</strong><p>يؤثر على مستحقات الزوجة والأولاد.</p></div></div>
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step"><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__num">④</div><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__content"><strong>عدد الأولاد على العاتق</strong><p>أدخل العدد فقط إذا كان لك أولاد على العاتق.</p></div></div>
          <div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step"><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__num">⑤</div><div className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-process-step__content"><strong>الوسام الأعلى</strong><p>اختر أعلى وسام أو تابع بخيار لا أعرف.</p></div></div>
        </div>
      </section>
    </div>
  );
}

function useSalaryPageController() {
  const { apiBaseUrl } = useApp();
  const resultSectionRef = useRef<HTMLElement>(null);

  const [meta, setMeta] = useState<SalaryMeta | null>(null);
  const [metaErr, setMetaErr] = useState("");
  const [metaStatus, setMetaStatus] = useState<SalaryMetaStatus>('ready');
  const [metaStatusNote, setMetaStatusNote] = useState("");
  const [metaLoading, setMetaLoading] = useState(false);
  const [rank, setRank] = useState("جندي");
  const [degree, setDegree] = useState(1);
  const [married, setMarried] = useState(true);
  const [kidsCount, setKidsCount] = useState(0);
  const [selectedOrnaments, setSelectedOrnaments] = useState<string[]>([]);
  const [showRankPicker, setShowRankPicker] = useState(false);
  const [showDegreePicker, setShowDegreePicker] = useState(false);
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [showKidsPicker, setShowKidsPicker] = useState(false);
  const [showMedalsPicker, setShowMedalsPicker] = useState(false);
  const [currentStep, setCurrentStep] = useState<SalaryStep>('rank');
  const autoCalcRef = useRef(false);
  const [result, setResult] = useState<PensionCalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openSection, setOpenSection] = useState<SectionIndex>(0);
  const [showResultsPopup, setShowResultsPopup] = useState(false);
  const [resultScenario, setResultScenario] = useState<SalaryResultScenario>('current');

  const loadMeta = useCallback(async () => {
    setMetaErr("");
    setMetaStatusNote("");
    setMetaLoading(true);
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const [health, data] = await Promise.all([
          api.salaryHealth(apiBaseUrl),
          api.salaryMeta(apiBaseUrl),
        ]);
        setMeta({ ...data, ranks: data.ranks.filter((entry) => !HIDDEN_PUBLIC_RANKS.has(entry.rank)) });
        setMetaStatus(health.status);
        if (health.status !== 'ready') {
          setMetaStatusNote(`رتب ${health.rankCount} • درجات ${health.degreeCount} • أوسمة ${health.medalCount}`);
        }
        setMetaLoading(false);
        return;
      } catch {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }
    setMeta(buildLocalSalaryMeta());
    setMetaStatus('server_unavailable');
    setMetaStatusNote('تم تفعيل وضع محلي احتياطي');
    setMetaErr("");
    setMetaLoading(false);
  }, [apiBaseUrl]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const selectOrnament = useCallback((id: string) => {
    setSelectedOrnaments([id]);
  }, []);

  const steps: SalaryStep[] = useMemo(() => ['rank', 'degree', 'family', 'kids', 'medals'], []);
  const currentStepIndex = steps.indexOf(currentStep);

  const closeAllPickers = useCallback(() => {
    setShowRankPicker(false);
    setShowDegreePicker(false);
    setShowFamilyPicker(false);
    setShowKidsPicker(false);
    setShowMedalsPicker(false);
  }, []);

  const openPickerForStep = useCallback((step: SalaryStep) => {
    switch (step) {
      case 'rank': setShowRankPicker(true); break;
      case 'degree': setShowDegreePicker(true); break;
      case 'family': setShowFamilyPicker(true); break;
      case 'kids': setShowKidsPicker(true); break;
      case 'medals': setShowMedalsPicker(true); break;
    }
  }, []);

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex <= 0) return;
    const prevStep = steps[currentStepIndex - 1];
    setCurrentStep(prevStep);
    closeAllPickers();
    openPickerForStep(prevStep);
  }, [closeAllPickers, currentStepIndex, openPickerForStep, steps]);

  const goToNextStep = useCallback(() => {
    if (currentStepIndex >= steps.length - 1) return;
    const nextStep = steps[currentStepIndex + 1];
    setCurrentStep(nextStep);
    closeAllPickers();
    openPickerForStep(nextStep);
  }, [closeAllPickers, currentStepIndex, openPickerForStep, steps]);

  const maxDeg = useMemo(() => {
    if (!meta) return 20;
    const found = meta.ranks.find((r) => r.rank === rank);
    return found?.maxDegree ?? 20;
  }, [meta, rank]);

  const selectedOrnament = meta?.ornamentChoices.find((choice) => choice.id === selectedOrnaments[0]) ?? null;

  const loadWizardResult = useCallback(async (overrideOrnaments?: string[]) => {
    setError("");
    setLoading(true);
    try {
      const ornaments = overrideOrnaments ?? selectedOrnaments;
      const r = await api.salaryCalc({ rank, degree, married, kidsCount, selectedOrnaments: ornaments }, apiBaseUrl);
      setResult(r);
      setOpenSection(0);
      setResultScenario('current');
      setShowResultsPopup(false);
    } catch {
      const fallbackResult = buildLocalSalaryResult({ rank, degree, married, kidsCount, selectedOrnaments: overrideOrnaments ?? selectedOrnaments }, meta);
      if (fallbackResult) {
        setResult(fallbackResult);
        setOpenSection(0);
        setResultScenario('current');
        setShowResultsPopup(false);
        setError("يتم عرض تقدير محلي لأن الخادم غير متاح حالياً.");
      } else {
        setError("تعذّر احتساب المعاش التقاعدي.");
      }
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, degree, kidsCount, married, meta, rank, selectedOrnaments]);

  const startWizard = useCallback(() => {
    setResult(null);
    setShowResultsPopup(false);
    closeAllPickers();
    setCurrentStep('rank');
    setShowRankPicker(true);
  }, [closeAllPickers]);

  useEffect(() => {
    if (!result || showResultsPopup) return;
    const target = resultSectionRef.current;
    if (!target) return;
    const id = globalThis.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.focus({ preventScroll: true });
    });
    return () => globalThis.cancelAnimationFrame(id);
  }, [result, showResultsPopup, resultScenario]);

  useEffect(() => {
    if (autoCalcRef.current && meta) {
      autoCalcRef.current = false;
      void loadWizardResult();
    }
  });

  let calcButtonContent = <>ابدأ الاحتساب</>;
  if (loading) {
    calcButtonContent = <><span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-btn-spinner" /> جارٍ الاحتساب…</>;
  } else if (result) {
    calcButtonContent = <>إعادة الاحتساب</>;
  }

  return {
    meta,
    metaErr,
    metaStatus,
    metaStatusNote,
    metaLoading,
    rank,
    degree,
    married,
    kidsCount,
    selectedOrnaments,
    selectedOrnament,
    maxDeg,
    currentStep,
    currentStepIndex,
    steps,
    result,
    resultScenario,
    loading,
    error,
    openSection,
    showRankPicker,
    showDegreePicker,
    showFamilyPicker,
    showKidsPicker,
    showMedalsPicker,
    showResultsPopup,
    resultSectionRef,
    isSingle: married === false,
    calcButtonContent,
    loadMeta,
    startWizard,
    calculate: loadWizardResult,
    closeAllPickers,
    goToPreviousStep,
    goToNextStep,
    setResultScenario,
    setOpenSection,
    setShowResultsPopup,
    setShowRankPicker,
    setShowDegreePicker,
    setShowFamilyPicker,
    setShowKidsPicker,
    setShowMedalsPicker,
    setRank,
    setDegree,
    setMarried,
    setKidsCount,
    setSelectedOrnaments,
    selectOrnament,
  } satisfies SalaryPageViewProps;
}

function SalaryPageTemplateContent() {
  const view = useSalaryPageController();
  return <SalaryPageView {...view} />;
}

/* ════════════════════════════════════════════════════════════
   Breakdown row components — clean card-style rows
   ════════════════════════════════════════════════════════════ */
function BRow({ label, value, bold, muted: isMuted, accent, variant }: Readonly<{
  label: string; value?: number; bold?: boolean; muted?: boolean; accent?: boolean; variant?: "aid";
}>) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const cls = [
    "sc-brow",
    bold ? "sc-brow--bold" : "",
    isMuted ? "sc-brow--muted" : "",
    accent ? "sc-brow--accent" : "",
    variant === "aid" ? "sc-brow--aid" : "",
  ].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-brow__label">
        {variant === "aid" && <small className="sc-brow__caption">المرجع</small>}
        <span>{label}</span>
      </span>
      <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-brow__value">
        {variant === "aid" && <small className="sc-brow__caption">قيمة الاستحقاق</small>}
        {safeValue < 0
          ? `(${Math.abs(safeValue).toLocaleString("ar-LB")})`
          : safeValue.toLocaleString("ar-LB")
        }
        <small> ل.ل.</small>
      </span>
    </div>
  );
}

function BRowUsd({ label, accent }: Readonly<{ label: string; accent?: boolean }>) {
  return (
    <div className={`sc-brow sc-brow--usd ${accent ? "sc-brow--accent" : ""}`}>
      <span />
      <span className="wmo-service-route wmo-rebuilt-route wmo-core-route sc-brow__value">{label}</span>
    </div>
  );
}



// APEX_PHASE3C_SERVICE_ROUTE_READY: next safe slice may wrap this route with WatanyServiceRoute after component-specific review.
function SalaryPageUnifiedTemplatePage() {
  return (
    <WatanyFeatureTemplate
      title="حاسبة الراتب والتقاعد"
      description="متابعة حسابات الراتب والتقاعد ضمن صفحة موحدة مع الحفاظ على كل أدوات الصفحة الأصلية."
      category="benefits"
    >
      <div data-watany-template-batch="v1.7.2" data-watany-template-manual-page="salary">
        <SalaryPageTemplateContent />
      </div>
    </WatanyFeatureTemplate>
  );
}

export default SalaryPageUnifiedTemplatePage;

