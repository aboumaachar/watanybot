import { FormEvent, useState } from "react";
import LebanonAddressSelector from "../components/address/LebanonAddressSelector";
import type { LebanonAddressValue } from "../components/address/addressTypes";
import { useApp } from "../store/app";
import "../styles/jobs-ainmreisseh.css";

type FormState = {
  name: string;
  phone: string;
  age: string;
  email: string;
  canWorkFullTime: string;
  acceptsSalary600: string;
  wantsHousing: string;
  availableStartDate: string;
};

const initialForm: FormState = {
  name: "",
  phone: "",
  age: "",
  email: "",
  canWorkFullTime: "",
  acceptsSalary600: "",
  wantsHousing: "",
  availableStartDate: "",
};

const answerOptions = ["نعم", "لا"];

export default function AinMreissehBuildingAssistantJobsPage() {
  const { apiBaseUrl } = useApp();
  const [form, setForm] = useState(initialForm);
  const [address, setAddress] = useState<Partial<LebanonAddressValue>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [applicationId, setApplicationId] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function shareRegistrationLink() {
    const url = globalThis.location.href;
    const shareData = {
      title: "فرصة عمل في عين المريسة",
      text: "تقديم طلب للعمل كمساعد مدير مبنى في عين المريسة",
      url,
    };

    if (globalThis.navigator.share) {
      try {
        await globalThis.navigator.share(shareData);
        setShareStatus("تمت مشاركة الرابط.");
      } catch {
        setShareStatus("");
      }
      return;
    }

    try {
      if (globalThis.navigator.clipboard) {
        await globalThis.navigator.clipboard.writeText(url);
        setShareStatus("تم نسخ الرابط.");
        return;
      }
    } catch {
      // Use the prompt fallback below when clipboard access is unavailable.
    }

    globalThis.prompt("انسخ رابط الفرصة:", url);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.mohafaza || !address.qaza || !address.village || !address.localityId) {
      setStatus("error");
      return;
    }

    setStatus("saving");
    try {
      const response = await fetch(`${apiBaseUrl}/api/jobs/ain-mreisseh-building-assistant/applications`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          age: form.age,
          email: form.email,
          governorate: address.mohafaza,
          governorateAr: address.mohafaza,
          caza: address.qaza,
          cazaAr: address.qaza,
          village: address.village,
          villageAr: address.village,
          villageId: address.localityId,
          canWorkFullTime: form.canWorkFullTime,
          acceptsSalary600: form.acceptsSalary600,
          wantsHousing: form.wantsHousing,
          availableStartDate: form.availableStartDate,
        }),
      });
      const result = await response.json() as { item?: { id?: string }; error?: string };
      if (!response.ok || !result.item) throw new Error(result.error || "SUBMIT_FAILED");
      setApplicationId(result.item.id || "");
      setStatus("success");
      setForm(initialForm);
      setAddress({});
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="ainmreisseh-page" dir="rtl">
      <section className="ainmreisseh-hero">
        <div className="ainmreisseh-hero__content">
          <p className="ainmreisseh-kicker">فرصة عمل في بيروت</p>
          <h1>مساعد مدير مبنى في عين المريسة</h1>
          <p className="ainmreisseh-lead">فرصة للانضمام إلى فريق إدارة مبنى في عين المريسة. نبحث عن شخص ملتزم، متاح للعمل بدوام كامل، وقادر على بدء العمل في التاريخ الذي يحدده في طلبه.</p>
        </div>
        <div className="ainmreisseh-hero__badge">
          <strong>عين المريسة – بيروت</strong>
          <span>دوام كامل</span>
          <span>الراتب: 600 دولار شهريًا</span>
        </div>
      </section>

      <section className="ainmreisseh-facts" aria-label="ملخص الفرصة">
        <div><strong>دوام كامل</strong><span>التزام يومي بالعمل</span></div>
        <div><strong>600 دولار</strong><span>الراتب الشهري</span></div>
        <div><strong>عين المريسة</strong><span>بيروت</span></div>
      </section>

      <section className="ainmreisseh-section ainmreisseh-section--form" id="application">
        <div className="ainmreisseh-section-heading">
          <p className="ainmreisseh-kicker">طلب التقديم</p>
          <h2>أرسل معلوماتك الأساسية</h2>
          <p>أكمل الحقول الثمانية التالية لإرسال الطلب. ستُستخدم المعلومات للتواصل معك بشأن الفرصة.</p>
        </div>
        {status === "success" ? <div className="ainmreisseh-message">تم إرسال طلبك بنجاح{applicationId ? ` برقم ${applicationId}` : ""}.</div> : null}
        {status === "error" ? <div className="ainmreisseh-message ainmreisseh-message--error" role="alert">أكمل الحقول المطلوبة وتحقق من رقم الهاتف والعنوان الإداري قبل الإرسال.</div> : null}
        <form className="ainmreisseh-form" onSubmit={submit}>
          <div className="ainmreisseh-form-grid">
            <label><span>الاسم *</span><input required type="text" value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label><span>رقم الهاتف *</span><input required type="tel" inputMode="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
            <label><span>العمر *</span><input required type="number" min="1" max="120" value={form.age} onChange={(event) => update("age", event.target.value)} /></label>
            <label><span>البريد الإلكتروني (اختياري)</span><input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label><span>تاريخ بدء العمل المتاح *</span><input required type="date" value={form.availableStartDate} onChange={(event) => update("availableStartDate", event.target.value)} /></label>
          </div>

          <LebanonAddressSelector required value={address} onChange={setAddress} exactAddressLabel="تفصيل إضافي للعنوان (اختياري)" />

          <fieldset>
            <legend>هل أنت متاح للعمل بدوام كامل؟ *</legend>
            <div className="ainmreisseh-options">{answerOptions.map((option) => <label className="ainmreisseh-option" key={`full-time-${option}`}><input required type="radio" name="canWorkFullTime" checked={form.canWorkFullTime === option} onChange={() => update("canWorkFullTime", option)} /><span>{option}</span></label>)}</div>
          </fieldset>
          <fieldset>
            <legend>هل تقبل براتب 600 دولار شهريًا؟ *</legend>
            <div className="ainmreisseh-options">{answerOptions.map((option) => <label className="ainmreisseh-option" key={`salary-${option}`}><input required type="radio" name="acceptsSalary600" checked={form.acceptsSalary600 === option} onChange={() => update("acceptsSalary600", option)} /><span>{option}</span></label>)}</div>
          </fieldset>
          <fieldset>
            <legend>هل تحتاج إلى سكن؟ *</legend>
            <div className="ainmreisseh-options">{answerOptions.map((option) => <label className="ainmreisseh-option" key={`housing-${option}`}><input required type="radio" name="wantsHousing" checked={form.wantsHousing === option} onChange={() => update("wantsHousing", option)} /><span>{option}</span></label>)}</div>
          </fieldset>
          <button className="ainmreisseh-submit" type="submit" disabled={status === "saving"}>{status === "saving" ? "جارٍ إرسال الطلب…" : "إرسال الطلب"}</button>
          <button className="ainmreisseh-share" type="button" onClick={() => { void shareRegistrationLink(); }}>مشاركة فرصة العمل</button>
          {shareStatus ? <p className="ainmreisseh-share-status" role="status">{shareStatus}</p> : null}
        </form>
      </section>
    </main>
  );
}
