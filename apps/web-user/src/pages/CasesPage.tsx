import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { AddCircle24Regular, Broom24Regular, Folder24Regular } from "../theme/watany-v4/legacyIconBridge";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import InlineInfoButton from "../components/InlineInfoButton";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import { useApp } from "../store/app";
import { api } from "../lib/api";


import { WatanyFeatureTemplate } from "../components/template";
type UtilityCardStyle = CSSProperties & {
  "--utility-color"?: string;
};

const CREATE_CARD_STYLE: UtilityCardStyle = { "--utility-color": "#2563eb" };
const CLEAR_CARD_STYLE: UtilityCardStyle = { "--utility-color": "#64748b" };
const OPEN_CASES_CARD_STYLE: UtilityCardStyle = { "--utility-color": "#ca8a04" };

const CASE_TYPE_LABELS = {
  dependents: "شؤون المعالين",
  death_inheritance: "وفاة وإرث",
  medical: "طبابة",
  schooling: "تعليم",
  pension_payment: "قبض المعاش",
  other: "معاملة أخرى",
} as const;

const CASE_STATUS_LABELS = {
  draft: "مسودة",
  in_progress: "قيد المتابعة",
  completed: "مكتملة",
  pending: "بانتظار الاستكمال",
} as const;

function CasesPageLegacy() {
  const { profile, apiBaseUrl, hasRole } = useApp();
  const [cases, setCases] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("dependents");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getCases(apiBaseUrl)
      .then(setCases)
      .catch(() => {
        setCases([]);
        setError("تعذر تحميل القضايا.");
      });
  }, [apiBaseUrl]);

  async function create() {
    if (!profile.isAuthed) return;
    setError("");
    try {
      const created = await api.createCase(
        {
          title: title || "قضية جديدة",
          type: type as
            | "dependents"
            | "death_inheritance"
            | "medical"
            | "schooling"
            | "pension_payment"
            | "other",
          status: "draft",
          checklist: [
            { label: "جمع المستندات", done: false },
            { label: "تقديم الطلب", done: false },
            { label: "متابعة", done: false },
          ],
        },
        apiBaseUrl
      );
      setCases((prev) => [created, ...prev]);
      setTitle("");
    } catch {
      setError("تعذر إنشاء القضية.");
    }
  }

  function clearDraft() {
    setTitle("");
    setType("dependents");
    setError("");
  }

  const openCases = cases.filter((item) => item.status !== "completed").length;
  const isAuthed = profile.isAuthed;
  const isAccredited = hasRole("accredited");

  if (!isAuthed) {
    return <div className="panel utility-page"><div className="muted">يرجى تسجيل الدخول لاستخدام القضايا.</div></div>;
  }

  if (!isAccredited) {
    return <div className="panel utility-page"><div className="muted">يرجى التسجيل لاستخدام هذه الخدمة.</div><Link to="/register" className="btn" style={{ marginTop: 12, display: "inline-block" }}>إنشاء حساب</Link></div>;
  }

  return (
    <div className="panel utility-page">
      <div className="utility-header">
        <UtilityHeaderTitleRow
          titleClassName="utility-title"
          title="إدارة القضايا"
          infoText="أنشئ قضية جديدة وتابع الملفات الحالية وخطوات الإنجاز."
          infoLabel="شرح إدارة القضايا"
        />
      </div>

      <div className="watany-approved-home-icons utility-action-grid utility-action-grid--compact">
        <button className="utility-action-card" onClick={create} style={CREATE_CARD_STYLE}>
          <UtilityActionIcon icon={<AddCircle24Regular aria-hidden />} />
          <span className="utility-action-card__label">إنشاء</span>
          <span className="utility-action-card__desc">فتح ملف متابعة جديد بحسب نوع المعاملة المحدد.</span>
        </button>
        <button className="utility-action-card" onClick={clearDraft} style={CLEAR_CARD_STYLE}>
          <UtilityActionIcon icon={<Broom24Regular aria-hidden />} />
          <span className="utility-action-card__label">مسح</span>
          <span className="utility-action-card__desc">إفراغ عنوان القضية وإعادة نوع المعاملة إلى الخيار الافتراضي.</span>
        </button>
        <div className="utility-action-card utility-action-card--static" style={OPEN_CASES_CARD_STYLE}>
          <UtilityActionIcon icon={<Folder24Regular aria-hidden />} />
          <span className="utility-action-card__label">مفتوحة</span>
          <span className="utility-action-card__desc">{openCases + " قضية تحتاج إلى متابعة أو استكمال."}</span>
        </div>
      </div>

      {error && <div className="panel-error">{error}</div>}
      <div className="panel-hint">أدخل عنواناً واضحاً للقضية واختر النوع المناسب لبدء تنظيم المستندات وخطوات الإجراء.</div>
      <div className="row">
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان القضية أو اسم المعاملة"
          title="أدخل عنوان القضية"
        />
        <select
          className="select"
          value={type}
          onChange={(e) => setType(e.target.value)}
          title="اختر نوع القضية"
        >
          <option value="dependents">شؤون المعالين</option>
          <option value="death_inheritance">وفاة أو إرث</option>
          <option value="medical">طبابة</option>
          <option value="schooling">تعليم ومدارس</option>
          <option value="pension_payment">قبض المعاش</option>
          <option value="other">معاملة أخرى</option>
        </select>
        <button className="btn" onClick={create} title="إنشاء قضية جديدة">
          حفظ القضية
        </button>
      </div>
      <div className="results">
        {cases.map((item) => {
          const statusLabel = CASE_STATUS_LABELS[item.status as keyof typeof CASE_STATUS_LABELS] || item.status;
          const statusPillClass = item.status === "draft" ? "pending" : "verified";

          return (
            <div className="card utility-list-card utility-list-card--compact" key={item.id}>
              <div className="utility-list-card__title-row">
                <div className="utility-list-card__title-copy">
                  <div className="card-title">{item.title}</div>
                  <div className="card-sub">{CASE_TYPE_LABELS[item.type as keyof typeof CASE_TYPE_LABELS] || item.type} ⬢ {statusLabel}</div>
                </div>
                {item.checklist?.length ? (
                  <div className="utility-list-card__title-actions">
                    <InlineInfoButton
                      text={item.checklist.map((entry: any) => `${entry.done ? "✓" : "•"} ${entry.label}`).join("/n")}
                      label={"عرض قائمة متابعة القضية " + item.title}
                    />
                  </div>
                ) : null}
              </div>
              <div className="utility-list-card__footer">
                <span className={`pill ${statusPillClass}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          );
        })}
        {cases.length > 0 ? null : <div className="muted">لا توجد قضايا مسجلة حتى الآن.</div>}
      </div>
    </div>
  );
}
export default function CasesPage() {
  return (
    <WatanyFeatureTemplate
      category="general"
      eyebrow="WatanyBot unified surface"
      title="Cases"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.1."
      meta={[{ label: "Route", value: "/cases" }]}
      className="watany-template-batch-v141"
    >
      <div data-watany-template-batch="v1.4.1" data-watany-template-route="/cases">
        <CasesPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}


