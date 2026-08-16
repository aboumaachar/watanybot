import { FormEvent, useRef, useState } from "react";
import { useApp } from "../store/app";
import LebanonAddressSelector from "../components/address/LebanonAddressSelector";
import type { LebanonAddressValue } from "../components/address/addressTypes";
import "../styles/jobs-ainelhafeh.css";

type FormState = {
  name: string;
  phone: string;
  email: string;
  age: string;
  gender: string;
  relationType: string;
  availability: string;
  preferredPeriod: string;
  weekendWork: string;
  arrive: string;
  experience: string;
  experienceText: string;
  stand: string;
  health: string;
  future: string;
  familyMore: string;
};

const initialForm: FormState = {
  name: "", phone: "", email: "", age: "", gender: "", relationType: "",
  availability: "شهر كامل", preferredPeriod: "3 أيلول", weekendWork: "لا",
  arrive: "", experience: "", experienceText: "", stand: "", health: "", future: "نعم", familyMore: "لا",
};

const relationOptions = ["عسكري متقاعد", "زوج / زوجة عسكري متقاعد", "ابن / ابنة عسكري متقاعد", "فرد من العائلة"];
const readinessQuestions: Array<{ key: "arrive" | "stand" | "experience"; label: string }> = [
  { key: "arrive", label: "هل تستطيع الوصول إلى مفرق جبيل الاثنين 6:00 صباحًا؟" },
  { key: "stand", label: "هل تستطيع العمل وقوفًا لعدة ساعات؟" },
  { key: "experience", label: "هل لديك خبرة زراعية؟" },
];
const defaultValidationMessage = "أكمل الحقول المطلوبة، ثم اضغط على إرسال طلب التسجيل.";

export default function AinElHafehJobsPage() {
  const { apiBaseUrl } = useApp();
  const [form, setForm] = useState(initialForm);
  const [address, setAddress] = useState<Partial<LebanonAddressValue>>({});
  const [interests, setInterests] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [applicationId, setApplicationId] = useState("");
  const [validationMessage, setValidationMessage] = useState(defaultValidationMessage);
  const [validationGuideActive, setValidationGuideActive] = useState(false);
  const readinessQuestionRefs = useRef<Array<HTMLFieldSetElement | null>>([]);
  const answeredQuestionCount = readinessQuestions.filter(({ key }) => form[key]).length;
  const questionProgress = Math.round((answeredQuestionCount / readinessQuestions.length) * 100);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectReadinessAnswer(questionIndex: number, field: "arrive" | "stand" | "experience", value: string) {
    update(field, value);
    const nextQuestion = readinessQuestionRefs.current[questionIndex + 1];
    if (!nextQuestion) return;

    window.setTimeout(() => {
      nextQuestion.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    }, 0);
  }

  function describeInvalidField(field: HTMLElement) {
    const legend = field.closest("fieldset")?.querySelector("legend")?.textContent?.replace(/\s*\*\s*$/, "").trim();
    if (legend) return `يرجى الإجابة عن «${legend}»`;
    const label = field.closest("label")?.querySelector("span")?.textContent?.replace(/\s*\*\s*$/, "").trim();
    return `يرجى تعبئة حقل «${label || "المعلومات المطلوبة"}»`;
  }

  function toggleInterest(value: string) {
    setInterests((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function shareRegistrationLink() {
    const url = globalThis.location.href;
    const shareData = {
      title: "فرصة عمل موسمية - قطاف التفاح",
      text: "تسجيل فرصة عمل موسمية لقطاف التفاح في تنورين",
      url,
    };

    if (globalThis.navigator.share) {
      await globalThis.navigator.share(shareData).catch(() => undefined);
      return;
    }

    if (globalThis.navigator.clipboard) {
      await globalThis.navigator.clipboard.writeText(url);
      return;
    }

    window.prompt("انسخ رابط التسجيل:", url);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const firstInvalidField = formElement.querySelector<HTMLElement>(":invalid");
    if (firstInvalidField) {
      setValidationGuideActive(true);
      setValidationMessage(describeInvalidField(firstInvalidField));
      firstInvalidField.focus();
      window.setTimeout(() => firstInvalidField.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }

    setValidationMessage(defaultValidationMessage);
  setValidationGuideActive(false);
    setStatus("saving");
    try {
      const response = await fetch(`${apiBaseUrl}/api/koudama/surveys/seasonal-apple-job/applications`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name, phone: form.phone, email: form.email, age: form.age, gender: form.gender,
          relationType: form.relationType, governorate: address.mohafaza, caza: address.qaza, village: address.village,
          governorateId: address.governorateId, districtOrEquivalentId: address.districtOrEquivalentId,
          villageId: address.localityId, localityPcode: address.localityPcode,
          locationDatasetVersion: address.locationDatasetVersion, locationApprovalStatus: address.locationApprovalStatus,
          availability: form.availability, preferredPeriod: form.preferredPeriod,
          weekendWork: form.weekendWork, canArrive6am: form.arrive, hasAgriExperience: form.experience,
          experienceText: form.experienceText, canStandHours: form.stand, healthNote: form.health,
          futureJobsInterest: form.future, interests, familyMore: form.familyMore,
        }),
      });
      const result = await response.json() as { ok?: boolean; applicationId?: string };
      if (!response.ok || !result.ok) throw new Error("SUBMIT_FAILED");
      setApplicationId(result.applicationId || "");
      setStatus("success");
      setForm(initialForm);
      setAddress({});
      setInterests([]);
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="ainelhafeh-page" dir="rtl">
      <section className="ainelhafeh-hero">
        <div className="ainelhafeh-hero__content">
          <p className="ainelhafeh-kicker">فرصة عمل موسمية</p>
          <h1>قطاف التفاح في تنورين</h1>
          <p className="ainelhafeh-hero__lead">التسجيل مفتوح للعسكريين المتقاعدين وأفراد عائلاتهم، الأبناء والبنات بعمر 18 سنة وما فوق، للمشاركة في قطاف الموسم بدءاً من 3 أيلول ولمدة شهر.</p>
          <div className="ainelhafeh-hero__actions">
            <a className="ainelhafeh-button ainelhafeh-button--primary" href="#application">سجّل في الفرصة</a>
            <a className="ainelhafeh-button ainelhafeh-button--quiet" href="#details">اطّلع على التفاصيل</a>
          </div>
        </div>
        <div className="ainelhafeh-hero__season" aria-label="معلومات الموسم">
          <strong>3 أيلول</strong>
          <span>بداية الموسم</span>
          <strong>20$</strong>
          <span>الأجر عن يوم العمل</span>
        </div>
      </section>

      <section className="ainelhafeh-facts" aria-label="ملخص الفرصة">
        <div><strong>8 ساعات</strong><span>عمل + ساعة استراحة</span></div>
        <div><strong>شهر واحد</strong><span>مدة العمل ابتداءً من 3 أيلول</span></div>
        <div><strong>أيام العمل مدفوعة</strong><span>يوم العطلة غير مدفوع</span></div>
        <div><strong>السكن مؤمّن</strong><span>ويبقى مؤمّناً خلال يوم العطلة</span></div>
      </section>

      <section className="ainelhafeh-layout" id="details">
        <div className="ainelhafeh-details">
          <p className="ainelhafeh-kicker">ما تحتاج إلى معرفته</p>
          <h2>عمل واضح، وسكن مؤمّن،<br />وتسجيل منظم</h2>
          <div className="ainelhafeh-detail-list">
            <article><span>01</span><div><h3>الدوام والدفع</h3><p>8 ساعات عمل مع ساعة استراحة. أيام العمل مدفوعة الأجر، والدفع في نهاية كل أسبوع عمل.</p></div></article>
            <article><span>02</span><div><h3>مدة العمل</h3><p>تبدأ فرصة العمل في 3 أيلول، وتمتد لمدة شهر واحد.</p></div></article>
            <article><span>03</span><div><h3>يوم العطلة</h3><p>يوم العطلة غير مدفوع الأجر، مع استمرار تأمين السكن خلال يوم العطلة.</p></div></article>
            <article><span>04</span><div><h3>السكن والطعام</h3><p>خيم متوفرة على الأرض، والمياه مؤمّنة بالكامل. يُختار شخص واحد من كل مجموعة ليكون الطبّاخ، والمزرعة تؤمّن المواد الأولية والصحون وقدر الطبخ.</p></div></article>
            <article><span>05</span><div><h3>المرافق والاحتياجات</h3><p>مرحاض متنقل ومستلزمات نظافة شخصية متوفرة. أحضر بطانية وأغراضك الشخصية، وارتداء القبعة إلزامي.</p></div></article>
            <article><span>06</span><div><h3>الأولوية</h3><p>الأولوية للعسكريين المتقاعدين وأفراد عائلاتهم، وللمتقدمين من جبيل والبترون، مع حد أدنى للعمر هو 18 سنة.</p></div></article>
          </div>
        </div>
        <aside className="ainelhafeh-note"><span>توضيح مهم</span><strong>الدفع لأيام العمل فقط</strong><p>يوم العطلة غير مدفوع، لكن السكن يبقى مؤمّناً خلاله. الأجر المعلن هو عن يوم العمل.</p></aside>
      </section>

      <section className="ainelhafeh-application" id="application">
        <div className="ainelhafeh-section-heading"><p className="ainelhafeh-kicker">نموذج التسجيل</p><h2>أرسل طلبك للمراجعة</h2><p>الحقول المعلّمة بنجمة مطلوبة. لن يتم إرسال الطلب قبل اكتمال عنوانك الإداري.</p></div>
        {status === "success" ? <div className="ainelhafeh-alert ainelhafeh-alert--success">تم تسجيل طلبك بنجاح{applicationId ? ` برقم ${applicationId}` : ""}. سنراجع المعلومات ونتواصل معك عند الحاجة.</div> : null}
        {status === "error" ? <div className="ainelhafeh-alert ainelhafeh-alert--error">تعذر حفظ الطلب حاليًا. تحقّق من الحقول وحاول مجددًا.</div> : null}
        <form noValidate onInput={(event) => {
          if (!validationGuideActive) return;
          const firstInvalidField = event.currentTarget.querySelector<HTMLElement>(":invalid");
          setValidationMessage(firstInvalidField ? describeInvalidField(firstInvalidField) : "اكتملت الحقول المطلوبة. يمكنك إرسال الطلب الآن.");
        }} onSubmit={submit} className="ainelhafeh-form" aria-describedby="ainelhafeh-validation-tooltip">
          <div id="ainelhafeh-validation-tooltip" className="ainelhafeh-validation-tooltip" role="status" aria-live="polite">{validationMessage}</div>
          <div className="ainelhafeh-form-grid">
            <label><span>الاسم والشهرة *</span><input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label><span>رقم الهاتف *</span><input required inputMode="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
            <label><span>البريد الإلكتروني</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label><span>العمر *</span><input required inputMode="numeric" min="18" value={form.age} onChange={(event) => update("age", event.target.value)} /></label>
            <label><span>الجنس</span><select value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="">اختر</option><option>ذكر</option><option>أنثى</option></select></label>
          </div>
          <fieldset><legend>صفة المتقدم *</legend><div className="ainelhafeh-options">{relationOptions.map((option) => <label key={option}><input required type="radio" name="relationType" checked={form.relationType === option} onChange={() => update("relationType", option)} /><span>{option}</span></label>)}</div></fieldset>
          <LebanonAddressSelector required value={address} onChange={setAddress} exactAddressLabel="تفصيل إضافي للعنوان" />
          <div className="ainelhafeh-form-grid">
            <label><span>مدة التوفر *</span><select required value={form.availability} onChange={(event) => update("availability", event.target.value)}><option>شهر كامل</option></select></label>
            <label><span>تاريخ البدء</span><select value={form.preferredPeriod} onChange={(event) => update("preferredPeriod", event.target.value)}><option>3 أيلول</option></select></label>
          </div>
          <div className="ainelhafeh-form-progress" aria-label={`أجبت عن ${answeredQuestionCount} من ${readinessQuestions.length} أسئلة الاستعداد`}>
            <div className="ainelhafeh-form-progress__label"><strong>{answeredQuestionCount} / {readinessQuestions.length}</strong><span>إجابات أسئلة الاستعداد</span></div>
            <div className="ainelhafeh-form-progress__track" aria-hidden="true"><span style={{ width: `${questionProgress}%` }} /></div>
            <p>{answeredQuestionCount === readinessQuestions.length ? "اكتملت هذه الخطوة." : "أجب عن الأسئلة التالية لتوضيح ملاءمة الفرصة لك."}</p>
          </div>
          <div className="ainelhafeh-question-grid">
            {readinessQuestions.map((question, questionIndex) => {
              const answer = form[question.key];
              return <fieldset key={question.key} ref={(element) => { readinessQuestionRefs.current[questionIndex] = element; }} className={`ainelhafeh-question-card${answer ? " is-answered" : ""}`} data-answer-state={answer ? "answered" : "pending"}><legend>{question.label}</legend><div className="ainelhafeh-options ainelhafeh-options--inline"><label><input required type="radio" name={question.key} checked={answer === "نعم"} onChange={() => selectReadinessAnswer(questionIndex, question.key, "نعم")} /><span>نعم</span></label><label><input required type="radio" name={question.key} checked={answer === "لا"} onChange={() => selectReadinessAnswer(questionIndex, question.key, "لا")} /><span>لا</span></label></div><span className="ainelhafeh-question-status" aria-live="polite">{answer ? `تم اختيار: ${answer}` : "بانتظار إجابتك"}</span></fieldset>;
            })}
          </div>
          <label><span>إذا نعم، اذكر نوع الخبرة</span><textarea value={form.experienceText} onChange={(event) => update("experienceText", event.target.value)} /></label>
          <label><span>ملاحظة صحية اختيارية</span><textarea value={form.health} onChange={(event) => update("health", event.target.value)} /></label>
          <fieldset><legend>الأعمال التي تهمك مستقبلًا</legend><div className="ainelhafeh-options ainelhafeh-options--inline">{["زراعية", "صناعية", "لوجستية", "خدمات", "إدارية"].map((item) => <label key={item}><input type="checkbox" checked={interests.includes(item)} onChange={() => toggleInterest(item)} /><span>{item}</span></label>)}</div></fieldset>
          <div className="ainelhafeh-form-grid"><label><span>العمل في نهاية الأسبوع</span><select value={form.weekendWork} onChange={(event) => update("weekendWork", event.target.value)}><option>لا</option><option>نعم</option></select></label><label><span>فرص عمل مستقبلية</span><select value={form.future} onChange={(event) => update("future", event.target.value)}><option>نعم</option><option>لا</option></select></label></div>
          <label><span>هل يوجد أفراد آخرون من العائلة مهتمون؟</span><select value={form.familyMore} onChange={(event) => update("familyMore", event.target.value)}><option>لا</option><option>نعم</option></select></label>
          <button className="ainelhafeh-button ainelhafeh-button--submit" disabled={status === "saving"} type="submit">{status === "saving" ? "جارٍ إرسال الطلب…" : "إرسال طلب التسجيل"}</button>
        </form>
        <div className="ainelhafeh-share" aria-label="مشاركة التسجيل" style={{ textAlign: "center" }}>
          <button className="ainelhafeh-button ainelhafeh-button--primary" style={{ marginInline: "auto" }} type="button" onClick={() => { void shareRegistrationLink(); }}>مشاركة رابط التسجيل</button>
          <p>التسجيل مفتوح لأكبر عدد ممكن. سجّل باكرًا لتحديد الفترة التي تناسبك.</p>
        </div>
      </section>
    </main>
  );
}
