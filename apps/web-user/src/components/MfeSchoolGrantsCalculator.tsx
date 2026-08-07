import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { PopupModal } from "./PopupModal";
import { fmtLBP as fmt } from "../lib/format";
import {
  buildAidPrintReport,
  calculateMfeAid,
  getAidDatasetSummary,
  loadAlshoonAidData,
  loadMfeAidData,
  type AidCalculationResult,
  type AidSystem,
  type MfeSection,
} from "../lib/mfe-school-grants";

import "../styles/MfeSchoolGrantsCalculator.css";

type MfeStudentDraft = {
  id: number;
  sectionId: string;
  rateIndex: number;
};

type SchoolGrantsView = "calculator" | AidSystem;
type InitialCalculatorView = SchoolGrantsView;

const datasetSummary = getAidDatasetSummary();

function createMfeDraft(id: number): MfeStudentDraft {
  const data = loadMfeAidData();
  return {
    id,
    sectionId: data.sections[0]?.sectionId ?? "A",
    rateIndex: 0,
  };
}

function splitArabicRateLabel(label: string) {
  const [stage, category] = label.split(" - ");
  return {
    stage: stage ?? label,
    category: category ?? "",
  };
}

function cleanSectionTitle(title: string) {
  return title.replace(/^x\S*\s+/, "").trim();
}

function renderSectionReference(section: MfeSection) {
  if (section.sectionId === "C") {
    return (
      <section className="aid-editor__section-card" key={section.sectionId}>
        <h4>{section.title}</h4>
        <p>يتم التعليم في الخارج وفق تعرفة المدارس الخاصة المحلية غير المجانية بحسب المرحلة التعليمية.</p>
      </section>
    );
  }

  return (
    <section className="aid-editor__section-card" key={section.sectionId}>
      <h4>{section.title}</h4>
      <div className="aid-editor__table-wrap">
        <table className="aid-editor__table aid-editor__table--source">
          <thead>
            <tr>
              <th>مرحلة التعليم</th>
              <th>فئة المدارس</th>
              <th>القيمة المرجعية</th>
            </tr>
          </thead>
          <tbody>
            {section.rates.map((rate, index) => {
              const parts = splitArabicRateLabel(rate.levelName);
              return (
                <tr key={`${section.sectionId}-${index}`}>
                  <td>{parts.stage}</td>
                  <td>{parts.category || rate.levelName}</td>
                  <td>{fmt(rate.amount)} ل.ل.</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ResultsPanelProps = Readonly<{
  result: AidCalculationResult;
  hundredTotalTestId: string;
  fiftyTotalTestId: string;
  hundredLabelRef?: React.RefObject<HTMLSpanElement>;
}>;

function ResultsPanel({
  result,
  hundredTotalTestId,
  fiftyTotalTestId,
  hundredLabelRef,
}: ResultsPanelProps) {
  const fiftyPercentTotal = Math.round(result.familyTotal * 0.5);

  return (
    <div className="aid-editor__results" data-testid="aid-results-mfe">
      <section className="aid-editor__results-flow" aria-label="ملخص النتائج">
        <h3>نتيجة احتساب المنحة</h3>
        <p>النتيجة أدناه تُظهر قيمة الاستحقاق لكل ولد مع المجموع النهائي للأسرة على أساس 100% و50%.</p>
      </section>

      <div className="aid-editor__totals-grid">
        <div className="aid-editor__total-card">
          <span ref={hundredLabelRef} tabIndex={-1} data-testid="aid-total-100-label">قيمة 100%</span>
          <strong data-testid={hundredTotalTestId}>{fmt(result.familyTotal)} ل.ل.</strong>
        </div>
        <div className="aid-editor__total-card aid-editor__total-card--alt">
          <span>قيمة 50%</span>
          <strong data-testid={fiftyTotalTestId}>{fmt(fiftyPercentTotal)} ل.ل.</strong>
        </div>
      </div>

      <div className="aid-editor__results-legend" aria-label="دليل قراءة الجدول">
        <span className="aid-editor__legend-pill aid-editor__legend-pill--primary">100%: الاستحقاق الكامل</span>
        <span className="aid-editor__legend-pill aid-editor__legend-pill--secondary">50%: نصف الاستحقاق</span>
      </div>

      <div className="aid-editor__comparison-block" data-testid="aid-comparison-table">
        <div className="aid-editor__group-title">
          <span>جدول التعرفة والنتيجة النهائية</span>
        </div>
        <div className="aid-editor__table-wrap">
          <table className="aid-editor__table aid-editor__table--comparison">
            <thead>
              <tr>
                <th>الولد</th>
                <th>الفئة</th>
                <th>التعرفة الرسمية</th>
                <th>قيمة 100%</th>
                <th>قيمة 50%</th>
              </tr>
            </thead>
            <tbody>
              {result.students.map((student) => (
                <tr key={`${student.name}-${student.label}`}>
                  <td>{student.name}</td>
                  <td>{student.label}</td>
                  <td>{fmt(student.baseAmount)} ل.ل.</td>
                  <td>{fmt(student.finalAmount)} ل.ل.</td>
                  <td>{fmt(Math.round(student.finalAmount * 0.5))} ل.ل.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="aid-editor__results-disclaimer" data-testid="aid-results-disclaimer">
        هذا الاحتساب تقريبي للاستئناس فقط، والنتيجة النهائية ليست رسمية ولا تُعد مرجعاً معتمداً.
      </div>
    </div>
  );
}

function focusStepTwoFromStepOne(currentTarget: HTMLElement) {
  const card = currentTarget.closest("article.aid-editor__item-card--popup");
  const stepTwoSelect = card?.querySelector<HTMLSelectElement>('select[data-testid^="aid-mfe-rate-"]');
  if (!stepTwoSelect) return;
  stepTwoSelect.focus({ preventScroll: true });
  stepTwoSelect.scrollIntoView({ behavior: "auto", block: "center" });
}

export function MfeSchoolGrantsCalculator({
  initialView = "calculator",
}: Readonly<{ initialView?: InitialCalculatorView }>) {
  const [activeView, setActiveView] = useState<SchoolGrantsView>(initialView);
  const [error, setError] = useState("");
  const [submittedTab, setSubmittedTab] = useState<"mfe" | null>(null);
  const [showMfePicker, setShowMfePicker] = useState(initialView === "calculator");
  const [showMfeResults, setShowMfeResults] = useState(false);
  const [mfeStudents, setMfeStudents] = useState<MfeStudentDraft[]>([createMfeDraft(1)]);
  const hundredLabelRef = useRef<HTMLSpanElement | null>(null);
  const pendingAddedStudentIdRef = useRef<number | null>(null);

  const alshoonData = useMemo(() => loadAlshoonAidData(), []);
  const mfeData = useMemo(() => loadMfeAidData(), []);

  const mfeResult = useMemo(() => {
    if (submittedTab !== "mfe") return null;
    return calculateMfeAid(
      mfeStudents.map((student, index) => ({
        name: `الولد ${index + 1}`,
        sectionId: student.sectionId,
        rateIndex: student.rateIndex,
      })),
      mfeData,
    );
  }, [mfeData, mfeStudents, submittedTab]);

  const currentResult = mfeResult;

  const printReport = useMemo(() => {
    if (!submittedTab || !currentResult) return "";
    return buildAidPrintReport({
      summary: datasetSummary,
      familyName: "",
      fileNumber: "",
      result: currentResult,
    });
  }, [currentResult, submittedTab]);

  useEffect(() => {
    const openCalculator = () => {
      setActiveView("calculator");
      setShowMfePicker(true);
    };
    const openMinisterial = () => {
      setShowMfePicker(false);
      setActiveView("alshoon");
    };
    const openTariff = () => {
      setShowMfePicker(false);
      setActiveView("mfe");
    };

    const applyHashView = () => {
      const hash = globalThis.location?.hash ?? "";
      if (hash === "#school-grants-ministerial") {
        setShowMfePicker(false);
        setActiveView("alshoon");
      } else if (hash === "#school-grants-tariff") {
        setShowMfePicker(false);
        setActiveView("mfe");
      } else if (hash === "#school-grants-calculator") {
        setActiveView("calculator");
        setShowMfePicker(true);
      }
    };

    applyHashView();
    globalThis.addEventListener("school-grants-open-calculator", openCalculator);
    globalThis.addEventListener("school-grants-open-ministerial", openMinisterial);
    globalThis.addEventListener("school-grants-open-tariff", openTariff);
    globalThis.addEventListener("hashchange", applyHashView);
    return () => {
      globalThis.removeEventListener("school-grants-open-calculator", openCalculator);
      globalThis.removeEventListener("school-grants-open-ministerial", openMinisterial);
      globalThis.removeEventListener("school-grants-open-tariff", openTariff);
      globalThis.removeEventListener("hashchange", applyHashView);
    };
  }, []);

  useEffect(() => {
    if (showMfePicker) {
      setMfeStudents([createMfeDraft(1)]);
    }
  }, [showMfePicker]);

  // Interaction tracking for guided glowing hints
  const [sectionTouched, setSectionTouched] = useState<Set<number>>(new Set());
  const [rateTouched, setRateTouched] = useState<Set<number>>(new Set());

  function markSectionTouched(id: number) {
    setSectionTouched((s) => new Set(s).add(id));
  }

  function markRateTouched(id: number) {
    setRateTouched((s) => new Set(s).add(id));
  }

  useEffect(() => {
    if (!showMfePicker) return;
    // Snap popup body to top and focus first section select when the picker opens
    globalThis.setTimeout(() => {
      const popup = document.querySelector('.popup-body');
      if (popup) {
        try {
          (popup as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          (popup as HTMLElement).scrollTop = 0;
        }
      }
      const firstSelect = document.querySelector('select[data-testid^="aid-mfe-section-"]') as HTMLElement | null;
      if (firstSelect && typeof firstSelect.focus === 'function') firstSelect.focus();
    }, 60);
  }, [showMfePicker]);

  useEffect(() => {
    if (!showMfeResults || !mfeResult) return;

    const focusTarget = () => {
      hundredLabelRef.current?.focus();
    };

    const raf = globalThis.requestAnimationFrame(focusTarget);
    const timer = globalThis.setTimeout(focusTarget, 80);
    return () => {
      globalThis.cancelAnimationFrame(raf);
      globalThis.clearTimeout(timer);
    };
  }, [showMfeResults, mfeResult]);

  function replaceMfeStudent(id: number, updater: (student: MfeStudentDraft) => MfeStudentDraft) {
    setMfeStudents((current) => current.map((student) => (student.id === id ? updater(student) : student)));
  }

  function addMfeStudent() {
    setMfeStudents((current) => {
      const nextId = (current[current.length - 1]?.id ?? 0) + 1;
      pendingAddedStudentIdRef.current = nextId;
      return [...current, createMfeDraft(nextId)];
    });
  }

  function calculateMfeTotals() {
    setError("");
    setSubmittedTab("mfe");
    setShowMfePicker(false);
    setShowMfeResults(true);
  }

  function closeMfeResults() {
    setShowMfeResults(false);
    setSubmittedTab(null);
  }

  useEffect(() => {
    const pendingId = pendingAddedStudentIdRef.current;
    if (!showMfePicker || !pendingId) return;

    const timer = globalThis.setTimeout(() => {
      const popupBody = document.querySelector<HTMLElement>('.popup-body');
      const select = document.querySelector<HTMLSelectElement>(`select[data-testid="aid-mfe-section-${pendingId}"]`);
      const card = select?.closest<HTMLElement>('article.aid-editor__item-card--popup');

      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (popupBody && card) {
        const popupTop = popupBody.getBoundingClientRect().top;
        const cardTop = card.getBoundingClientRect().top;
        popupBody.scrollTo({
          top: Math.max(0, popupBody.scrollTop + cardTop - popupTop - 12),
          behavior: 'smooth',
        });
      }
      if (select) {
        select.focus({ preventScroll: true });
      }
      pendingAddedStudentIdRef.current = null;
    }, 80);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [mfeStudents, showMfePicker]);

  let activeViewPanel: ReactElement;
  if (activeView === "calculator") {
    activeViewPanel = <></>;
  } else if (activeView === "alshoon") {
    activeViewPanel = (
      <div className="aid-editor__panel">
        <div className="aid-editor__info-box">
          <strong>معلومات مرجعية فقط</strong>
          <span>المرجع الوزاري معروض هنا كمرجع للقيم والعوامل المضاعفة فقط، من دون أي احتساب داخل الصفحة.</span>
        </div>

        <div className="aid-editor__group">
          <div className="aid-editor__group-title">
            <span>مستويات المساعدات التعليمية</span>
          </div>
          <div className="aid-editor__reference-grid">
            {alshoonData.grantLevels.map((grant) => (
              <div className="aid-editor__reference-card" key={grant.id}>
                <strong>{grant.levelName}</strong>
                <span>{fmt(grant.baseAmount)} ل.ل.</span>
              </div>
            ))}
          </div>
        </div>

        <div className="aid-editor__group">
          <div className="aid-editor__group-title">
            <span>العوامل المضاعفة</span>
          </div>
          <div className="aid-editor__chips">
            {alshoonData.multipliers.map((multiplier) => (
              <span className="aid-editor__chip" key={multiplier.id}>
                {multiplier.type} - {multiplier.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  } else {
    activeViewPanel = (
      <div className="aid-editor__panel">
        <div className="aid-editor__sections">{mfeData.sections.map((section) => renderSectionReference(section))}</div>
      </div>
    );
  }

  const shouldRenderInlineShell = activeView !== "calculator";

  return (
    <section className="aid-editor" data-testid="mfe-grants-calculator">
      {shouldRenderInlineShell ? (
        <div className="aid-editor__shell aid-editor__shell--plain">
          <div className="aid-editor__content">
            {activeViewPanel}

            {error ? <div className="aid-editor__error">{error}</div> : null}

            {mfeResult ? (
              <div className="aid-editor__print-sheet" data-testid="aid-print-sheet">
                <div className="aid-editor__print-frame">
                  <div className="aid-editor__print-head">
                    <div className="aid-editor__print-emblem">
                      الجمهورية اللبنانية
                      <br />
                      تعاونية موظفي الدولة
                    </div>
                    <div className="aid-editor__print-title-wrap">
                      <h4>تعرفة تعاونية موظفي الدولة</h4>
                      <p>
                        قرار رقم {datasetSummary.decreeNumber} - تاريخ {datasetSummary.decreeDate}
                      </p>
                      <p>العام الدراسي {datasetSummary.academicYears}</p>
                    </div>
                  </div>

                  <div className="aid-editor__print-body">
                    <div className="aid-editor__print-meta">
                      <span>عدد الأولاد المحددين: {mfeResult.students.length}</span>
                    </div>
                    <pre>{printReport}</pre>
                  </div>

                  <div className="aid-editor__print-footer">
                    <div>أعد هذا التقرير استنادا إلى تعرفة تعاونية موظفي الدولة.</div>
                    <div className="aid-editor__print-signatures">
                      <div>توقيع الموظف المختص</div>
                      <div>توقيع صاحب العلاقة</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <PopupModal
        open={showMfePicker}
        title="حاسبة تعرفة تعاونية موظفي الدولة"
        onClose={() => setShowMfePicker(false)}
        variant="premium"
        compactMobile
        footer={(() => {
          const firstStudentId = mfeStudents[0]?.id;
          const firstCompleted = firstStudentId ? (sectionTouched.has(firstStudentId) && rateTouched.has(firstStudentId)) : false;
          const addShouldGlow = firstCompleted && mfeStudents.length === 1;
          const calcShouldGlow = firstCompleted && mfeStudents.length > 1;

          return (
            <div className="aid-editor__popup-footer">
              <div className="aid-editor__popup-footer-note" data-testid="aid-mfe-footer-note">
                {firstCompleted
                  ? (mfeStudents.length === 1 ? 'أضف ولداً آخر عند الحاجة ثم احسب.' : 'راجع بطاقات الأولاد ثم اضغط احسب.')
                  : 'أكمل بطاقة الولد الحالية أولاً.'}
              </div>
              <div className="aid-editor__popup-actions">
                <button
                  type="button"
                  className={`aid-editor__button aid-editor__button--info ${addShouldGlow ? 'is-glowing' : ''}`}
                  onClick={addMfeStudent}
                  data-testid="aid-add-mfe-student"
                >
                  + ولد آخر
                </button>
                <button type="button" className={`aid-editor__button aid-editor__button--success ${calcShouldGlow ? 'is-glowing' : ''}`} onClick={calculateMfeTotals} data-testid="aid-calculate-mfe">
                  احسب
                </button>
              </div>
            </div>
          );
        })()}
      >
        {/* Removed: aid-editor__picker-flow guidance box per request */}

        {/* guidance removed; using glowing hints instead */}

        <div className="aid-editor__picker-intro" data-testid="aid-mfe-picker-intro">
          <div className="aid-editor__picker-badges">
            <span className="aid-editor__picker-badge">1. اختر القسم</span>
            <span className="aid-editor__picker-badge">2. اختر المرحلة</span>
            <span className="aid-editor__picker-badge">3. أضف ولداً آخر</span>
            <span className="aid-editor__picker-badge">4. عند الانتهاء اضغط احسب</span>
          </div>
        </div>

        <div className="aid-editor__picker-list" data-testid="aid-mfe-picker-list">
          {mfeStudents.map((student, index) => {
            const selectedSection = mfeData.sections.find((section) => section.sectionId === student.sectionId) ?? mfeData.sections[0];
            const firstStudentId = mfeStudents[0]?.id;
            const firstCompleted = firstStudentId ? (sectionTouched.has(firstStudentId) && rateTouched.has(firstStudentId)) : false;
            const isFirst = firstStudentId === student.id;
            const isAdditional = index > 0;

            return (
              <article className={`aid-editor__item-card aid-editor__item-card--popup${isAdditional ? ' aid-editor__item-card--popup-secondary' : ''}`} key={student.id} data-aid-student-id={student.id} data-aid-student-index={index + 1}>
                <div className="aid-editor__popup-label">{`الولد ${index + 1}`}</div>
                <div className="aid-editor__item-main">
                  <button
                    type="button"
                    className={`aid-editor__field-step aid-editor__field-step--1 ${isFirst && !firstCompleted ? 'is-glowing' : ''}`}
                    data-step="1"
                    onClick={(event) => focusStepTwoFromStepOne(event.currentTarget)}
                  >
                    اختر القسم التربوي.
                  </button>
                  <label className="aid-editor__field aid-editor__field--stacked">
                    <select
                      data-testid={`aid-mfe-section-${student.id}`}
                      value={student.sectionId}
                      onFocus={() => markSectionTouched(student.id)}
                      onChange={(event) => {
                        markSectionTouched(student.id);
                        replaceMfeStudent(student.id, (current) => ({ ...current, sectionId: event.target.value, rateIndex: 0 }));
                      }}
                      className={isFirst && !firstCompleted ? 'is-glowing' : ''}
                    >
                      {mfeData.sections.map((section) => (
                        <option key={section.sectionId} value={section.sectionId}>
                          {cleanSectionTitle(section.title)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <small className="aid-editor__field-step aid-editor__field-step--2" data-step="2">اختر المرحلة ونوع المدرسة.</small>
                  <label className="aid-editor__field aid-editor__field--stacked">
                    <select
                      data-testid={`aid-mfe-rate-${student.id}`}
                      value={student.rateIndex}
                      onFocus={() => markRateTouched(student.id)}
                      onChange={(event) => {
                        markRateTouched(student.id);
                        replaceMfeStudent(student.id, (current) => ({ ...current, rateIndex: Number(event.target.value) }));
                      }}
                      className={isFirst && !firstCompleted ? 'is-glowing' : ''}
                    >
                      {selectedSection.rates.map((rate, rateIndex) => (
                        <option key={`${selectedSection.sectionId}-${rateIndex}`} value={rateIndex}>
                          {rate.levelName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      </PopupModal>

      <PopupModal
        open={showMfeResults}
        onClose={closeMfeResults}
        variant="premium"
        hideHeader
        compactMobile
        footer={null}
      >
        {mfeResult ? <ResultsPanel result={mfeResult} hundredTotalTestId="aid-total-mfe-100" fiftyTotalTestId="aid-total-mfe-50" hundredLabelRef={hundredLabelRef} /> : null}
      </PopupModal>
    </section>
  );
}
