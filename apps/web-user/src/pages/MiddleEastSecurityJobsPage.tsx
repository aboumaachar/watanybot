import { FormEvent, useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import "../styles/jobs-ainmreisseh.css";
import LebanonAddressLocator, { type LebanonAddressValue } from "../features/location/LebanonAddressLocator";

const locations = ["بيروت", "طرابلس", "عكار", "الجنوب", "البقاع"] as const;
const levels = ["لا أجيد", "وسط", "جيد"] as const;
const TRACKING_KEY = "watany_mes_tracking_token";

type FormState = Record<string, string | boolean>;

function sessionSecret(key: string): string {
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function transientSecret(): string {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function MiddleEastSecurityJobsPage() {
  useEffect(() => {
    document.title = "فرصة عمل في الأمن والحماية — ميدل إيست سيكوريتي لبنان | موطني";
  }, []);
  const [form, setForm] = useState<FormState>({
    security_training: false,
    ngo_experience: false,
    arabic_read: "وسط",
    arabic_write: "وسط",
    english_read: "لا أجيد",
    english_write: "لا أجيد",
    preferred_location: locations[0],
  });
  const [result, setResult] = useState<{ id: string; trackingToken?: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => transientSecret());
  const [address, setAddress] = useState<Partial<LebanonAddressValue>>({});
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !address.governorateId
      || !address.districtOrEquivalentId
      || !address.localityId
      || address.locationApprovalStatus !== "approvedCanonical"
    ) {
      setError("اختر المحافظة والقضاء والقرية من محدد العنوان الموحد.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const trackingToken = sessionSecret(TRACKING_KEY);
      const response = await authFetch("/api/jobs/middle-east-security/applications", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mes-tracking-token": trackingToken,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          ...form,
          address: address.displayAddress || undefined,
          mohafaza: address.mohafaza,
          mohafaza_id: address.governorateId,
          caza: address.caza,
          caza_id: address.districtOrEquivalentId,
          village: address.village,
          village_id: address.localityId,
          village_pcode: address.localityPcode,
          location_dataset_version: address.locationDatasetVersion,
          location_approval_status: address.locationApprovalStatus,
        }),
      });
      const data = await response.json() as { item?: { id: string }; trackingToken?: string; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "تعذر حفظ الطلب");
      setResult({ id: data.item.id, trackingToken: data.trackingToken || trackingToken });
      try { window.sessionStorage.removeItem(TRACKING_KEY); } catch { /* Continue after a successful submission. */ }
      setIdempotencyKey(transientSecret());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذر حفظ الطلب");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <main className="ainmreisseh-page" dir="rtl">
        <section className="ainmreisseh-section">
          <div className="ainmreisseh-message" role="status">
            <h1>تم استلام طلبك</h1>
            <p>رقم الطلب: <strong>{result.id}</strong></p>
            {result.trackingToken ? <p>رمز المتابعة الخاص بك: <strong>{result.trackingToken}</strong></p> : null}
            <p>احتفظ برقم الطلب ورمز المتابعة للوصول الآمن إلى طلبك.</p>
            <a href="/jobs?section=applications">متابعة الطلبات</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ainmreisseh-page" dir="rtl">
      <header className="ainmreisseh-hero">
        <div className="ainmreisseh-hero__content">
          <p className="ainmreisseh-kicker">ميدل إيست سيكوريتي لبنان</p>
          <h1>فرصة عمل في الأمن والحماية</h1>
          <p className="ainmreisseh-lead">طلب انضمام إلى فريق ميدل إيست سيكوريتي لبنان بمعاش محترم وبحسب المؤهلات. يرجى تعبئة المعلومات بدقة.</p>
        </div>
      </header>
      <section className="ainmreisseh-section ainmreisseh-section--form">
        <form className="ainmreisseh-form" onSubmit={submit} aria-describedby={error ? "mes-form-error" : undefined}>
          <div className="ainmreisseh-form-grid">
            {[
              ["full_name", "الاسم الثلاثي", "text"],
              ["birth_date", "تاريخ الميلاد", "date"],
              ["age_years", "العمر بالسنوات", "number"],
              ["birth_place", "مكان الميلاد", "text"],
              ["phone", "رقم الهاتف", "tel"],
            ].map(([key, label, type]) => (
              <label key={key}><span>{label}</span><input required type={type} placeholder={key === "age_years" ? "62" : undefined} min={key === "age_years" ? 1 : undefined} max={key === "age_years" ? 130 : undefined} step={key === "age_years" ? 1 : undefined} value={String(form[key] || "")} onChange={(event) => set(key, event.target.value)} />{key === "age_years" ? <small>يرجى كتابة العمر بالأرقام فقط</small> : null}</label>
            ))}
          </div>
          <LebanonAddressLocator
            required
            includeExactAddress={false}
            value={address}
            onChange={setAddress}
          />
          <label><span>الموقع المفضل للعمل</span>
            <select required value={String(form.preferred_location)} onChange={(event) => set("preferred_location", event.target.value)}>
              {locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
          <div className="ainmreisseh-form-grid">
            {[
              ["arabic_read", "العربية قراءة"],
              ["arabic_write", "العربية كتابة"],
              ["english_read", "الإنكليزية قراءة"],
              ["english_write", "الإنكليزية كتابة"],
            ].map(([key, label]) => (
              <label key={key}><span>{label}</span><select required value={String(form[key])} onChange={(event) => set(key, event.target.value)}>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
            ))}
          </div>
          <label><span>هل سبق أن تلقيت تدريباً أمنياً؟</span>
            <select value={String(form.security_training)} onChange={(event) => set("security_training", event.target.value === "true")}><option value="false">لا</option><option value="true">نعم</option></select>
          </label>
          {form.security_training ? <label><span>يرجى ذكر نوع التدريب الأمني والجهة التي قدمته</span><textarea required value={String(form.security_training_details || "")} onChange={(event) => set("security_training_details", event.target.value)} /></label> : null}
          <label><span>هل عملت سابقاً مع منظمات غير حكومية (NGOs)؟</span>
            <select value={String(form.ngo_experience)} onChange={(event) => set("ngo_experience", event.target.value === "true")}><option value="false">لا</option><option value="true">نعم</option></select>
          </label>
          {form.ngo_experience ? <label><span>تفاصيل الخبرة</span><textarea required placeholder="تفاصيل الخبرة" value={String(form.ngo_details || "")} onChange={(event) => set("ngo_details", event.target.value)} /></label> : null}
          <label><span>ملاحظات إضافية</span><textarea value={String(form.notes || "")} onChange={(event) => set("notes", event.target.value)} /></label>
          {error ? <p id="mes-form-error" className="ainmreisseh-message ainmreisseh-message--error" role="alert">{error}</p> : null}
          <button className="ainmreisseh-submit" type="submit" disabled={busy}>{busy ? "جار الحفظ…" : "إرسال الطلب"}</button>
        </form>
      </section>
    </main>
  );
}
