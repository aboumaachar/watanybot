import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LebanonAddressLocator, type LebanonAddressValue } from "../features/location/LebanonAddressLocator";
import { authFetch } from "../lib/api";
import { useApp } from "../store/app";

const API_BASE = import.meta.env.VITE_GATEWAY_BASE_URL || "";

type FieldCondition = { field: string; equals?: string | number | boolean; includes?: string };
type FieldDef = {
  key: string;
  labelAr: string;
  type: "text" | "textarea" | "integer" | "phone" | "email" | "date" | "yes_no" | "select" | "multi_select" | "universal_locator";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  min?: number;
  max?: number;
  options?: string[];
  condition?: FieldCondition;
};
type Template = {
  id: string;
  slug: string;
  employerName: string;
  titleAr: string;
  introAr: string;
  employmentType: string;
  allowProfileAutofill: boolean;
  allowPreviousAutofill: boolean;
  allowBlankStart: boolean;
  fields: FieldDef[];
};
type PreviousItem = { id: string; source: string; title: string; employer: string; submittedAt: string; values: Record<string, unknown>; address?: Record<string, string | undefined> };
type StartMode = "profile" | "previous" | "blank" | null;

const EMPTY_ADDRESS: LebanonAddressValue = { mohafaza: "", caza: "", village: "", exactAddress: "", displayAddress: "" };
const sectionForKey = (key: string) => {
  if (["full_name", "birth_date", "age_years", "birth_place", "phone", "location"].includes(key)) return "المعلومات الشخصية ومكان السكن";
  if (key.startsWith("accreditation") || key === "accredited_driver" || key === "years_experience" || key.startsWith("heavy_equipment") || key === "previous_employers") return "الاعتماد والخبرة المهنية";
  if (key.includes("read") || key.includes("write")) return "اللغات";
  return "معلومات إضافية";
};

function visible(field: FieldDef, answers: Record<string, unknown>) {
  if (!field.condition) return true;
  const current = answers[field.condition.field];
  if (Object.prototype.hasOwnProperty.call(field.condition, "equals")) return current === field.condition.equals;
  if (field.condition.includes !== undefined) return Array.isArray(current) && current.map(String).includes(field.condition.includes);
  return true;
}

function toAddressValue(raw?: Record<string, string | undefined>): LebanonAddressValue {
  return {
    mohafaza: raw?.mohafaza || "",
    caza: raw?.caza || "",
    village: raw?.village || "",
    exactAddress: raw?.address || "",
    displayAddress: [raw?.mohafaza, raw?.caza, raw?.village, raw?.address].filter(Boolean).join(" - "),
    governorateId: raw?.mohafaza_id,
    districtOrEquivalentId: raw?.caza_id,
    localityId: raw?.village_id,
    localityPcode: raw?.village_pcode,
    locationDatasetVersion: raw?.location_dataset_version,
    locationApprovalStatus: raw?.location_approval_status,
  };
}

function makeIdempotencyKey(slug: string) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `job-${slug}-${random}`;
}

export default function UniversalJobApplicationPage() {
  const { jobSlug = "" } = useParams();
  const { profile } = useApp();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<StartMode>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [address, setAddress] = useState<LebanonAddressValue>(EMPTY_ADDRESS);
  const [locatorRevision, setLocatorRevision] = useState(0);
  const [previous, setPrevious] = useState<PreviousItem[]>([]);
  const [previousLoading, setPreviousLoading] = useState(false);
  const [selectedPrevious, setSelectedPrevious] = useState("");
  const [notice, setNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ reference: string; id: string } | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`${API_BASE}/api/jobs/application-templates/slug/${encodeURIComponent(jobSlug)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "هذا الطلب غير متاح حالياً." : "تعذر تحميل نموذج طلب التوظيف.");
        return response.json() as Promise<{ item: Template }>;
      })
      .then((data) => { if (active) setTemplate(data.item); })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : "تعذر تحميل النموذج."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobSlug]);

  const fields = template?.fields || [];
  const groupedFields = useMemo(() => {
    const groups: Array<{ title: string; fields: FieldDef[] }> = [];
    for (const field of fields) {
      const title = sectionForKey(field.key);
      let group = groups.find((item) => item.title === title);
      if (!group) { group = { title, fields: [] }; groups.push(group); }
      group.fields.push(field);
    }
    return groups;
  }, [fields]);

  const setAnswer = (key: string, value: unknown) => setAnswers((current) => ({ ...current, [key]: value }));

  const startBlank = () => {
    setAnswers({});
    setAddress(EMPTY_ADDRESS);
    setLocatorRevision((value) => value + 1);
    setMode("blank");
    setNotice("تم بدء طلب جديد فارغ.");
    setSelectedPrevious("");
  };

  const startFromProfile = async () => {
    if (!profile.isAuthed) { setNotice("يرجى تسجيل الدخول لاستخدام بيانات حسابك. يمكنك متابعة الطلب يدوياً."); return; }
    setNotice("");
    try {
      const response = await authFetch(`${API_BASE}/api/jobs/application-templates/${encodeURIComponent(jobSlug)}/autofill/profile`);
      const data = await response.json() as { values?: Record<string, unknown>; error?: string };
      if (!response.ok) throw new Error(data.error || "تعذر تحميل بيانات الحساب.");
      setAnswers(data.values || {});
      setAddress(EMPTY_ADDRESS);
      setLocatorRevision((value) => value + 1);
      setMode("profile");
      setNotice("تمت تعبئة الحقول المتوافقة من حسابك. راجع المعلومات قبل الإرسال.");
    } catch {
      setNotice("تعذر استخدام بيانات الحساب حالياً. يمكنك تعبئة الطلب يدوياً.");
    }
  };

  const openPrevious = async () => {
    if (!profile.isAuthed) { setNotice("يرجى تسجيل الدخول لاستخدام طلب سابق."); return; }
    setMode("previous");
    setPreviousLoading(true);
    setNotice("");
    try {
      const response = await authFetch(`${API_BASE}/api/jobs/application-templates/${encodeURIComponent(jobSlug)}/autofill/previous`);
      const data = await response.json() as { items?: PreviousItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الطلبات السابقة.");
      setPrevious(data.items || []);
      if (!(data.items || []).length) setNotice("لا توجد طلبات سابقة متوافقة في حسابك. يمكنك تعبئة طلب جديد.");
    } catch {
      setPrevious([]);
      setNotice("تعذر تحميل الطلبات السابقة حالياً.");
    } finally { setPreviousLoading(false); }
  };

  const applyPrevious = (id: string) => {
    const item = previous.find((entry) => entry.id === id);
    setSelectedPrevious(id);
    if (!item) return;
    setAnswers(item.values || {});
    setAddress(toAddressValue(item.address));
    setLocatorRevision((value) => value + 1);
    setNotice("تم نسخ الحقول المتوافقة فقط من الطلب السابق. راجع البيانات قبل الإرسال.");
  };

  const renderField = (field: FieldDef) => {
    if (!visible(field, answers)) return null;
    if (field.type === "universal_locator") return (
      <div className="job-universal-field job-universal-field--wide" key={field.key}>
        <LebanonAddressLocator key={`locator-${locatorRevision}`} idPrefix={`job-${jobSlug}-address`} value={address} onChange={setAddress} required={field.required} />
      </div>
    );
    const value = answers[field.key];
    if (field.type === "yes_no") return (
      <label className="job-universal-field" key={field.key}><span>{field.labelAr}{field.required ? " *" : ""}</span>
        <select required={field.required} value={value === true ? "yes" : value === false ? "no" : ""} onChange={(event) => setAnswer(field.key, event.target.value === "" ? undefined : event.target.value === "yes")}>
          <option value="">اختر</option><option value="yes">نعم</option><option value="no">لا</option>
        </select>{field.helpText ? <small>{field.helpText}</small> : null}
      </label>
    );
    if (field.type === "select") return (
      <label className="job-universal-field" key={field.key}><span>{field.labelAr}{field.required ? " *" : ""}</span>
        <select required={field.required} value={String(value ?? "")} onChange={(event) => setAnswer(field.key, event.target.value)}><option value="">اختر</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      </label>
    );
    if (field.type === "multi_select") return (
      <fieldset className="job-universal-field job-universal-field--wide" key={field.key}><legend>{field.labelAr}{field.required ? " *" : ""}</legend>
        <div className="job-universal-checks">{field.options?.map((option) => { const values = Array.isArray(value) ? value.map(String) : []; return <label key={option}><input type="checkbox" checked={values.includes(option)} onChange={(event) => setAnswer(field.key, event.target.checked ? [...values, option] : values.filter((item) => item !== option))} /> <span>{option}</span></label>; })}</div>
      </fieldset>
    );
    if (field.type === "textarea") return (
      <label className="job-universal-field job-universal-field--wide" key={field.key}><span>{field.labelAr}{field.required ? " *" : ""}</span><textarea rows={3} required={field.required} placeholder={field.placeholder} value={String(value ?? "")} onChange={(event) => setAnswer(field.key, event.target.value)} />{field.helpText ? <small>{field.helpText}</small> : null}</label>
    );
    const htmlType = field.type === "integer" ? "number" : field.type === "phone" ? "tel" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text";
    return (
      <label className="job-universal-field" key={field.key}><span>{field.labelAr}{field.required ? " *" : ""}</span><input type={htmlType} inputMode={field.type === "integer" ? "numeric" : field.type === "phone" ? "tel" : undefined} required={field.required} min={field.min} max={field.max} step={field.type === "integer" ? 1 : undefined} placeholder={field.placeholder} value={String(value ?? "")} onChange={(event) => setAnswer(field.key, field.type === "integer" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} />{field.helpText ? <small>{field.helpText}</small> : null}</label>
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!template || success) return;
    setSubmitError("");
    setSubmitting(true);
    const key = idempotencyKey || makeIdempotencyKey(jobSlug);
    if (!idempotencyKey) setIdempotencyKey(key);
    const trackingStorageKey = `watany-job-tracking-${jobSlug}`;
    const trackingToken = sessionStorage.getItem(trackingStorageKey) || "";
    try {
      const response = await authFetch(`${API_BASE}/api/jobs/application-templates/${encodeURIComponent(jobSlug)}/applications`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": key,
          ...(trackingToken ? { "x-job-tracking-token": trackingToken } : {}),
        },
        body: JSON.stringify({
          answers,
          address: {
            address: address.exactAddress || address.displayAddress,
            mohafaza: address.mohafaza,
            mohafaza_id: address.governorateId,
            caza: address.caza,
            caza_id: address.districtOrEquivalentId,
            village: address.village,
            village_id: address.localityId,
            village_pcode: address.localityPcode,
            location_dataset_version: address.locationDatasetVersion,
            location_approval_status: address.locationApprovalStatus,
          },
          prefillSource: mode || "blank",
          prefillSourceApplicationId: mode === "previous" ? selectedPrevious || undefined : undefined,
        }),
      });
      const data = await response.json() as { item?: { id: string; reference: string }; trackingToken?: string; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "تعذر إرسال الطلب.");
      if (data.trackingToken) sessionStorage.setItem(trackingStorageKey, data.trackingToken);
      setSuccess({ id: data.item.id, reference: data.item.reference });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إرسال الطلب.";
      setSubmitError(message.startsWith("MISSING_REQUIRED_FIELD") ? "يرجى تعبئة جميع الحقول المطلوبة." : message.startsWith("INVALID_") ? "يرجى مراجعة القيم المدخلة والتأكد من صحتها." : message);
    } finally { setSubmitting(false); }
  };

  if (loading) return <main dir="rtl" className="job-universal-page"><p>جارٍ تحميل نموذج التوظيف...</p></main>;
  if (loadError || !template) return <main dir="rtl" className="job-universal-page"><div className="job-universal-alert job-universal-alert--error">{loadError || "هذا النموذج غير متاح."}</div><Link to="/jobs">العودة إلى الوظائف</Link></main>;

  return (
    <main dir="rtl" className="job-universal-page" data-universal-job-application={template.slug}>
      <style>{`
        .job-universal-page{max-width:900px;margin:0 auto;padding:18px 14px 90px;color:#17202a}.job-universal-hero,.job-universal-panel,.job-universal-section{background:#fff;border:1px solid #e3e7eb;border-radius:18px;padding:18px;margin-bottom:14px;box-shadow:0 7px 20px rgba(0,0,0,.05)}.job-universal-hero h1{margin:0 0 8px;font-size:1.65rem}.job-universal-hero p{margin:5px 0;color:#52606d}.job-universal-employer{font-weight:800;color:#8a6400}.job-universal-start{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.job-universal-start button{min-height:72px;border:1px solid #d5dae0;border-radius:14px;background:#f8fafb;font-weight:800;padding:10px;cursor:pointer}.job-universal-start button.active{border-color:#9b7400;background:#fff8dc}.job-universal-previous{width:100%;margin-top:10px;padding:10px;border-radius:10px;border:1px solid #ccd2d8}.job-universal-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.job-universal-field{display:grid;gap:6px;font-weight:700}.job-universal-field--wide{grid-column:1/-1}.job-universal-field input,.job-universal-field select,.job-universal-field textarea{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd2d9;border-radius:10px;background:#fff;font:inherit}.job-universal-field small{font-weight:400;color:#66727d}.job-universal-checks{display:flex;flex-wrap:wrap;gap:10px}.job-universal-checks label{font-weight:500;border:1px solid #dde2e6;border-radius:10px;padding:8px 10px}.job-universal-submit{width:100%;padding:14px;border:0;border-radius:12px;background:#8b6a00;color:#fff;font-weight:900;font-size:1.05rem;cursor:pointer}.job-universal-submit:disabled{opacity:.55}.job-universal-alert{padding:11px 12px;border-radius:10px;margin:10px 0}.job-universal-alert--info{background:#eef6ff;color:#154b7d}.job-universal-alert--error{background:#fff0f0;color:#8a1c1c}.job-universal-success{background:#f2fff4;border:1px solid #a8d8b0;border-radius:18px;padding:20px;text-align:center}.job-universal-success strong{display:block;font-size:1.25rem;margin:8px 0}.job-universal-section h2{margin-top:0;font-size:1.18rem}@media(max-width:640px){.job-universal-start,.job-universal-form-grid{grid-template-columns:1fr}.job-universal-field--wide{grid-column:auto}.job-universal-page{padding-inline:10px}.job-universal-hero,.job-universal-panel,.job-universal-section{padding:14px}}
      `}</style>
      <section className="job-universal-hero">
        <p className="job-universal-employer">{template.employerName}</p>
        <h1>{template.titleAr}</h1>
        <p>{template.introAr}</p>
        <p><strong>نوع الدوام:</strong> {template.employmentType === "FULL_TIME" ? "دوام كامل" : template.employmentType}</p>
      </section>

      {!mode ? <section className="job-universal-panel"><h2>كيف تريد تعبئة طلب التوظيف؟</h2><div className="job-universal-start">
        {template.allowProfileAutofill ? <button type="button" onClick={() => void startFromProfile()}>استخدام بيانات حسابي</button> : null}
        {template.allowPreviousAutofill ? <button type="button" onClick={() => void openPrevious()}>استخدام طلب سابق</button> : null}
        {template.allowBlankStart ? <button type="button" onClick={startBlank}>تعبئة طلب جديد</button> : null}
      </div>{notice ? <div className="job-universal-alert job-universal-alert--info" role="status">{notice}</div> : null}</section> : null}

      {mode === "previous" ? <section className="job-universal-panel"><h2>اختر طلباً سابقاً</h2>{previousLoading ? <p>جارٍ تحميل طلباتك...</p> : <select className="job-universal-previous" value={selectedPrevious} onChange={(event) => applyPrevious(event.target.value)}><option value="">اختر طلباً سابقاً</option>{previous.map((item) => <option key={`${item.source}-${item.id}`} value={item.id}>{item.title} — {item.employer} — {new Date(item.submittedAt).toLocaleDateString("ar-LB")}</option>)}</select>}{notice ? <div className="job-universal-alert job-universal-alert--info" role="status">{notice}</div> : null}</section> : null}

      {mode ? success ? <section className="job-universal-success" role="status"><h2>تم استلام طلبك بنجاح</h2><span>رقم الطلب</span><strong dir="ltr">{success.reference}</strong><p>احتفظ برقم الطلب لمتابعة حالته.</p><Link to="/jobs?section=applications">متابعة طلباتي</Link></section> : <form onSubmit={submit} noValidate={false}>
        {notice && mode !== "previous" ? <div className="job-universal-alert job-universal-alert--info" role="status">{notice}</div> : null}
        {groupedFields.map((group) => <section className="job-universal-section" key={group.title}><h2>{group.title}</h2><div className="job-universal-form-grid">{group.fields.map(renderField)}</div></section>)}
        {submitError ? <div className="job-universal-alert job-universal-alert--error" role="alert">{submitError}</div> : null}
        <button className="job-universal-submit" type="submit" disabled={submitting}>{submitting ? "جارٍ إرسال الطلب..." : "إرسال طلب التوظيف"}</button>
      </form> : null}
    </main>
  );
}
