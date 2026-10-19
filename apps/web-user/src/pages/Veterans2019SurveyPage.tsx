import { FormEvent, useMemo, useState } from "react";
import { AddressWidgetFieldAdapter } from "../../../../packages/address-network/src/AddressWidgetFieldAdapter";
import type { AddressWidgetValue } from "../../../../packages/address-network/src/address-types";
import "./Veterans2019SurveyPage.css";
import { FeatureAdSensePlacement } from "../components/ads/FeatureAdSensePlacement";

const RANKS = [
  "جندي", "جندي اول", "عريف", "عريف اول", "رقيب", "رقيب اول",
  "معاون", "معاون اول", "مؤهل", "مؤهل اول", "ملازم", "ملازم اول",
  "نقيب", "رائد", "مقدم", "عقيد", "عميد", "لواء", "عماد",
];
const SERVICES = ["الجيش اللبناني", "قوى الأمن الداخلي", "الأمن العام", "أمن الدولة", "شرطة مجلس النواب", "الجمارك"];
const SURVEY_OPEN = false;

type FormState = {
  fullName: string; phone: string; email: string; service: string; rank: string;
  retirementDate: string; depositMonth: string; amount: string; problemSummary: string;
};
const EMPTY: FormState = { fullName: "", phone: "", email: "", service: "", rank: "", retirementDate: "", depositMonth: "", amount: "", problemSummary: "" };

function benchmark(date: string) {
  if (!date) return "يظهر التصنيف تلقائياً بعد اختيار تاريخ الإحالة.";
  return date < "2019-10-17" ? "قبل 17 تشرين الأول 2019" : "في 17 تشرين الأول 2019 أو بعده";
}
export default function Veterans2019SurveyPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [address, setAddress] = useState<AddressWidgetValue>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const benchmarkLabel = useMemo(() => benchmark(form.retirementDate), [form.retirementDate]);
  const update = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!address.governorateId || !address.cazaId) {
      setError("يرجى تحديد المحافظة والقضاء في محدد العنوان.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/veterans-2019/applications", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount), address }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; applicationId?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.applicationId) throw new Error(payload.error || "SUBMIT_FAILED");
      setApplicationId(payload.applicationId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("تعذر تسجيل الاستمارة. يرجى التحقق من المعلومات والمحاولة مجدداً.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setForm(EMPTY); setAddress({}); setApplicationId(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!SURVEY_OPEN) return (
    <main className="wt-page v19-page" dir="rtl">
      <section className="wt-panel v19-success-card">
        <p className="wt-kicker v19-kicker">الاستبيانات</p>
        <h1>تم إقفال هذا الاستبيان</h1>
        <p>تم إيقاف استقبال الطلبات الجديدة. تبقى الطلبات المقدّمة سابقاً محفوظة للمراجعة.</p>
        <div className="wt-actions">
          <a className="wt-button wt-button--primary" href="/surveys">العودة إلى الاستبيانات</a>
          <a className="wt-button wt-button--secondary" href="/home">الصفحة الرئيسية</a>
        </div>
      </section>
    </main>
  );

  if (applicationId) return (
    <main className="wt-page v19-page v19-success-page" dir="rtl">
      <section className="wt-panel v19-success-card">
        <div style={{ fontSize: 52, color: "#18794e" }}>✓</div>
        <h1>تم تسجيل الاستمارة بنجاح</h1>
        <p>تم إدراج الحالة ضمن اللائحة المخصصة للمراجعة.</p>
        <p><strong>رقم الطلب: {applicationId}</strong></p>
        <button type="button" className="wt-button wt-button--primary" onClick={reset}>تقديم استمارة جديدة</button>
      </section>
    </main>
  );

  return (
    <main className="wt-page v19-page" dir="rtl">
      <section className="wt-panel v19-hero">
        <p className="wt-kicker v19-kicker">العسكريون المتقاعدون</p>
        <h1>استمارة حصر حالات العسكريين المحالين إلى التقاعد خلال عام 2019</h1>
      </section>
      <section className="wt-panel wt-panel--subtle v19-intro">
        <h2 className="wt-panel__subtitle">الهدف من الاستمارة</h2>
        <p>تهدف هذه الاستمارة إلى حصر وتوثيق الحالات الخاصة بالعسكريين الذين أُحيلوا إلى التقاعد خلال عام 2019، ولا سيما الذين تعذّر عليهم قبض مستحقاتهم التقاعدية أو لم تدخل المبالغ المستحقة إلى حساباتهم المصرفية إلا خلال عام 2020، وذلك نتيجة الظروف المالية والمصرفية التي بدأت في لبنان خلال عام 2019.</p>
        <p>كما تهدف إلى التمييز بين الحالات التي نشأ استحقاقها <strong>قبل 17 تشرين الأول 2019</strong> وتلك التي نشأ استحقاقها <strong>في أو بعد 17 تشرين الأول 2019</strong>، تمهيداً لإعداد لائحة موحدة ودراسة كل حالة على أساس تاريخ الاستحقاق وتاريخ الدفع الفعلي.</p>
      </section>
      <FeatureAdSensePlacement featureId="veterans-2019" placement="inline" responsiveMobile />

      <form className="v19-form" onSubmit={submit}>
        <section className="wt-panel v19-section">
          <h2 className="wt-panel__subtitle v19-section-title"><span>1</span> المعلومات الشخصية</h2>
          <div className="wt-form-grid v19-grid">
            <label className="wt-field"><span>الاسم الثلاثي *</span><input required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} /></label>
            <label className="wt-field"><span>رقم الهاتف *</span><input required type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></label>
            <label className="wt-field"><span>البريد الإلكتروني — إن وجد</span><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></label>
            <label className="wt-field"><span>السلك الذي خدم فيه *</span><select required value={form.service} onChange={(e) => update("service", e.target.value)}><option value="">اختر السلك</option>{SERVICES.map((service) => <option key={service}>{service}</option>)}</select></label>
            <label className="wt-field"><span>الرتبة عند الإحالة إلى التقاعد *</span><select required value={form.rank} onChange={(e) => update("rank", e.target.value)}><option value="">اختر الرتبة</option>{RANKS.map((rank) => <option key={rank}>{rank}</option>)}</select></label>
          </div>
        </section>
        <section className="wt-panel wt-panel--subtle v19-section v19-address-section">
          <h2 className="wt-panel__subtitle v19-section-title"><span>2</span> العنوان</h2>
          <AddressWidgetFieldAdapter
            name="veteranAddress"
            value={address}
            onChange={setAddress}
            required
          />
        </section>

        <section className="wt-panel v19-section">
          <h2 className="wt-panel__subtitle v19-section-title"><span>3</span> معلومات الإحالة والتعويض</h2>
          <div className="wt-form-grid v19-grid">
            <label className="wt-field"><span>تاريخ الإحالة الفعلية إلى التقاعد *</span><input required type="date" min="2019-01-01" max="2019-12-31" value={form.retirementDate} onChange={(e) => update("retirementDate", e.target.value)} /></label>
            <div className="wt-field"><span>التصنيف بحسب 17 تشرين الأول 2019</span><div className="wt-callout">{benchmarkLabel}</div></div>
            <label className="wt-field"><span>تاريخ دخول التعويضات التقاعدية إلى الحساب المصرفي *</span><input required type="month" min="2019-01" max="2020-12" value={form.depositMonth} onChange={(e) => update("depositMonth", e.target.value)} /><small>الشهر / السنة ضمن 2019 أو 2020.</small></label>
            <label className="wt-field"><span>القيمة التقريبية للمبلغ المستحق (ل.ل.) *</span><input required type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)} /></label>
            <label className="wt-field v19-problem-field"><span>اشرح بإيجاز شديد مشكلتك — اختياري</span><textarea maxLength={500} rows={4} value={form.problemSummary} onChange={(e) => update("problemSummary", e.target.value)} placeholder="اكتب المشكلة باختصار شديد" /></label>
          </div>
          {error ? <p role="alert" style={{ color: "#b42318", fontWeight: 700 }}>{error}</p> : null}
          <div className="wt-actions">
            <button className="wt-button wt-button--primary" type="submit" disabled={submitting}>{submitting ? "جارٍ تسجيل الاستمارة…" : "إرسال الاستمارة"}</button>
            <button className="wt-button wt-button--secondary" type="button" onClick={reset} disabled={submitting}>مسح الحقول</button>
          </div>
        </section>
      </form>
    </main>
  );
}
