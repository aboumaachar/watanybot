import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AddressWidgetFieldAdapter, type AddressWidgetValue } from "@watany/address-network";
import { useApp } from "../store/app";

type Condition = { sourceKey:string; operator:string; action:string; value?:unknown };
type Field = {
  key:string; label:string; type:string; required:boolean; placeholder?:string; helpText?:string;
  options:string[]; condition?:Condition; pageBreakBefore?:boolean; allowedMimeTypes?:string[];
  maxFiles?:number; maxFileSizeMb?:number;
};
type Settings = {
  accessMode:string; notifyApplicantOnSubmit:boolean; notifyApplicantOnStatusChange:boolean;
  notifyAdminsOnSubmit:boolean; submitLabel?:string;
};
type PublicForm = {
  id:string; slug:string; name:string; description?:string; currentVersion:number;
  fields:Field[]; settings:Settings;
};
type UploadedFile = { id:string; field_key:string; original_name:string; mime_type:string; bytes:number };
type Identity = { name:string; phone:string; email:string };

function empty(value:unknown) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}
function conditionMatches(condition:Condition|undefined, answers:Record<string,unknown>) {
  if (!condition) return false;
  const actual = answers[condition.sourceKey];
  const expected = condition.value;
  if (condition.operator === "equals") return String(actual ?? "") === String(expected ?? "");
  if (condition.operator === "not_equals") return String(actual ?? "") !== String(expected ?? "");
  if (condition.operator === "contains") return Array.isArray(actual)
    ? actual.map(String).includes(String(expected ?? ""))
    : String(actual ?? "").includes(String(expected ?? ""));
  if (condition.operator === "gt") return Number(actual) > Number(expected);
  if (condition.operator === "lt") return Number(actual) < Number(expected);
  if (condition.operator === "is_empty") return empty(actual);
  if (condition.operator === "not_empty") return !empty(actual);
  return false;
}

function fieldState(field:Field, answers:Record<string,unknown>) {
  const matched = conditionMatches(field.condition, answers);
  const action = field.condition?.action;
  return {
    visible: action === "show" ? matched : action === "hide" ? !matched : true,
    disabled: action === "disable" && matched,
    required: (field.required || (action === "require" && matched)) && !(action === "disable" && matched),
  };
}

function buildPages(fields:Field[]) {
  const pages:Field[][] = [[]];
  for (const field of fields) {
    if (field.type === "section" && field.pageBreakBefore && pages[pages.length - 1].length) pages.push([]);
    pages[pages.length - 1].push(field);
  }
  return pages.filter((page) => page.length > 0);
}
export default function UniversalFormPage() {
  const { slug } = useParams();
  const { apiBaseUrl, profile } = useApp();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [identity, setIdentity] = useState<Identity>({ name:"", phone:"", email:"" });
  const [uploaded, setUploaded] = useState<Record<string, UploadedFile[]>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const uploadTokenRef = useRef(globalThis.crypto?.randomUUID?.() || `form-${Date.now()}-${Math.random()}`);

  useEffect(() => {
    let active = true;
    fetch(`${apiBaseUrl}/api/universal-forms/${encodeURIComponent(slug || "")}`, { credentials:"include", cache:"no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .then((data) => { if (active) { setForm(data.item); setPageIndex(0); } })
      .catch(() => { if (active) setMessage("النموذج غير متاح حالياً."); });
    return () => { active = false; };
  }, [apiBaseUrl, slug]);

  const pages = useMemo(() => buildPages(form?.fields || []), [form?.fields]);
  const setValue = (key:string, value:unknown) => setAnswers((current) => ({ ...current, [key]: value }));
  const needsAccount = form?.settings?.accessMode === "ACCOUNT_REQUIRED" || form?.settings?.accessMode === "VERIFIED_ACCOUNT_REQUIRED";
  const needsIdentity = form?.settings?.accessMode === "PUBLIC_IDENTIFIED";
  async function uploadFiles(field:Field, files:FileList|null) {
    if (!files?.length) return;
    const current = uploaded[field.key] || [];
    const maxFiles = field.maxFiles || 1;
    if (current.length + files.length > maxFiles) { setMessage(`الحد الأقصى للمرفقات في ${field.label}: ${maxFiles}`); return; }
    setUploadingKey(field.key); setMessage("");
    try {
      const next = [...current];
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("fieldKey", field.key);
        body.append("uploadToken", uploadTokenRef.current);
        body.append("file", file);
        const response = await fetch(`${apiBaseUrl}/api/universal-forms/${encodeURIComponent(slug || "")}/uploads`, {
          method:"POST", credentials:"include", body,
        });
        const data = await response.json();
        if (!response.ok || !data.item) throw new Error(data.error || `HTTP ${response.status}`);
        next.push(data.item as UploadedFile);
      }
      setUploaded((state) => ({ ...state, [field.key]: next }));
      setValue(field.key, next.map((item) => item.id));
    } catch (error) {
      setMessage(error instanceof Error ? `تعذر رفع الملف: ${error.message}` : "تعذر رفع الملف.");
    } finally { setUploadingKey(""); }
  }

  async function removeUpload(fieldKey:string, item:UploadedFile) {
    const response = await fetch(`${apiBaseUrl}/api/universal-forms/${encodeURIComponent(slug || "")}/uploads/${item.id}?token=${encodeURIComponent(uploadTokenRef.current)}`, {
      method:"DELETE", credentials:"include",
    });
    if (!response.ok) { setMessage("تعذر حذف المرفق."); return; }
    const next = (uploaded[fieldKey] || []).filter((candidate) => candidate.id !== item.id);
    setUploaded((state) => ({ ...state, [fieldKey]: next }));
    setValue(fieldKey, next.map((candidate) => candidate.id));
  }
  function renderField(field:Field) {
    const state = fieldState(field, answers);
    if (!state.visible) return null;
    if (field.type === "section") return <div className="profile-section-card" style={{ marginTop: 6 }}><h2 style={{ marginBottom: 4 }}>{field.label}</h2>{field.helpText ? <p className="muted">{field.helpText}</p> : null}</div>;
    const value = answers[field.key];
    const disabled = state.disabled;
    const required = state.required;
    if (field.type === "universal_locator") return <fieldset disabled={disabled} style={{ border:0, padding:0, margin:0 }}><AddressWidgetFieldAdapter name={field.key} value={(value && typeof value === "object" ? value : {}) as AddressWidgetValue} onChange={(next) => setValue(field.key, next)} required={required} disabled={disabled} helperText={field.helpText} featureFlags={{ gpsEnabled:true, mapEnabled:true, manualPinEnabled:true }} /></fieldset>;
    if (field.type === "file") return <div className="space-y-2"><input className="input" type="file" multiple={(field.maxFiles || 1) > 1} disabled={disabled || uploadingKey === field.key} accept={(field.allowedMimeTypes || []).join(",")} onChange={(event) => void uploadFiles(field, event.target.files)} />
      <small>{field.maxFiles || 1} ملف كحد أقصى · {field.maxFileSizeMb || 5} MB لكل ملف</small>
      {(uploaded[field.key] || []).map((item) => <div key={item.id} className="flex gap-2 items-center"><span>{item.original_name}</span><button className="btn" type="button" onClick={() => void removeUpload(field.key, item)}>حذف</button></div>)}</div>;
    if (field.type === "textarea") return <textarea className="input" rows={4} required={required} disabled={disabled} placeholder={field.placeholder || ""} value={String(value ?? "")} onChange={(event) => setValue(field.key, event.target.value)} />;
    if (field.type === "select") return <select className="input" required={required} disabled={disabled} value={String(value ?? "")} onChange={(event) => setValue(field.key, event.target.value)}><option value="">اختر</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select>;
    if (field.type === "radio") return <div className="flex flex-wrap gap-2">{field.options.map((option) => <label key={option}><input type="radio" name={field.key} required={required} disabled={disabled} checked={value === option} onChange={() => setValue(field.key, option)} /> {option}</label>)}</div>;
    if (field.type === "multi_select") { const selected = Array.isArray(value) ? value.map(String) : []; return <div className="flex flex-wrap gap-2">{field.options.map((option) => <label key={option}><input type="checkbox" disabled={disabled} checked={selected.includes(option)} onChange={(event) => setValue(field.key, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} /> {option}</label>)}</div>; }
    if (field.type === "checkbox") return <label><input type="checkbox" disabled={disabled} checked={Boolean(value)} onChange={(event) => setValue(field.key, event.target.checked)} /> نعم</label>;
    if (field.type === "yes_no") return <select className="input" required={required} disabled={disabled} value={value === true ? "yes" : value === false ? "no" : ""} onChange={(event) => setValue(field.key, event.target.value === "" ? undefined : event.target.value === "yes")}><option value="">اختر</option><option value="yes">نعم</option><option value="no">لا</option></select>;
    const htmlType = field.type === "number" || field.type === "integer" ? "number" : field.type === "phone" || field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text";
    return <input className="input" required={required} disabled={disabled} type={htmlType} placeholder={field.placeholder || ""} value={String(value ?? "")} onChange={(event) => setValue(field.key, htmlType === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} />;
  }

  function validateCurrentPage(): string | null {
    const page = pages[pageIndex] || [];
    for (const field of page) {
      if (field.type === "section") continue;
      const state = fieldState(field, answers);
      if (!state.visible || state.disabled || !state.required) continue;
      if (field.type === "universal_locator") {
        const value = answers[field.key];
        if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value as Record<string,unknown>).length === 0) return field.label;
      } else if (empty(answers[field.key])) return field.label;
    }
    return null;
  }
  async function submit(event:FormEvent) {
    event.preventDefault();
    const missing = validateCurrentPage();
    if (missing) { setMessage(`الحقل المطلوب غير مكتمل: ${missing}`); return; }
    if (needsIdentity && (!identity.name.trim() || !identity.phone.trim() || !identity.email.trim())) {
      setMessage("الاسم والهاتف والبريد الإلكتروني مطلوبة لإرسال هذا النموذج."); return;
    }
    setSending(true); setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/universal-forms/${encodeURIComponent(slug || "")}/submissions`, {
        method:"POST", credentials:"include", headers:{"content-type":"application/json"},
        body:JSON.stringify({ answers, identity, uploadToken:uploadTokenRef.current }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) throw new Error("يلزم تسجيل الدخول لإرسال هذا النموذج.");
        if (response.status === 403) throw new Error("يلزم حساب موثّق لإرسال هذا النموذج.");
        throw new Error(data.error || String(response.status));
      }
      setMessage(`تم إرسال النموذج بنجاح. المرجع: ${data.item.reference}`);
      setAnswers({}); setUploaded({}); setPageIndex(0);
      uploadTokenRef.current = globalThis.crypto?.randomUUID?.() || `form-${Date.now()}-${Math.random()}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إرسال النموذج. تحقق من الحقول المطلوبة وحاول مجدداً.");
    } finally { setSending(false); }
  }

  if (!form) return <main className="page-shell" dir="rtl"><section className="profile-section-card">{message || "جارٍ تحميل النموذج…"}</section></main>;
  if (needsAccount && !profile.isAuthed) return <main className="page-shell" dir="rtl"><section className="profile-section-card space-y-3"><h1>{form.name}</h1><p>يتطلب هذا النموذج تسجيل الدخول إلى حساب موطني.</p><a className="btn btn-primary" href="/login">تسجيل الدخول</a></section></main>;
  const currentPage = pages[pageIndex] || [];
  const progress = pages.length > 1 ? Math.round(((pageIndex + 1) / pages.length) * 100) : 100;
  return <main className="page-shell" dir="rtl" data-universal-form-version="v3a">
    <section className="profile-section-card space-y-2">
      <span className="muted">نموذج موطني · الإصدار {form.currentVersion}</span>
      <h1>{form.name}</h1>{form.description ? <p>{form.description}</p> : null}
      {pages.length > 1 ? <div><div className="muted">الخطوة {pageIndex + 1} من {pages.length} · {progress}%</div><progress max={100} value={progress} style={{ width:"100%" }} /></div> : null}
    </section>
    <form className="space-y-4" onSubmit={submit}>
      {needsIdentity && pageIndex === 0 ? <section className="profile-section-card space-y-3">
        <h2>بيانات مقدم الطلب</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="profile-field"><span>الاسم *</span><input className="input" required value={identity.name} onChange={(event) => setIdentity((value) => ({ ...value, name:event.target.value }))} /></label>
          <label className="profile-field"><span>الهاتف *</span><input className="input" required type="tel" value={identity.phone} onChange={(event) => setIdentity((value) => ({ ...value, phone:event.target.value }))} /></label>
          <label className="profile-field"><span>البريد الإلكتروني *</span><input className="input" required type="email" value={identity.email} onChange={(event) => setIdentity((value) => ({ ...value, email:event.target.value }))} /></label>
        </div>
      </section> : null}
      <section className="profile-section-card space-y-3">
        {currentPage.map((field) => {
          const state = fieldState(field, answers);
          if (!state.visible) return null;
          if (field.type === "section") return <div key={field.key}><h2>{field.label}</h2>{field.helpText ? <p className="muted">{field.helpText}</p> : null}</div>;
          return <div key={field.key} className="profile-field"><span>{field.label}{state.required ? " *" : ""}</span>{renderField(field)}{field.helpText && !["universal_locator","file"].includes(field.type) ? <small>{field.helpText}</small> : null}</div>;
        })}
      </section>
      <section className="profile-section-card space-y-3">
        <div className="flex flex-wrap gap-2">
          {pageIndex > 0 ? <button className="btn" type="button" onClick={() => { setMessage(""); setPageIndex((value) => Math.max(0, value - 1)); }}>السابق</button> : null}
          {pageIndex < pages.length - 1 ? <button className="btn btn-primary" type="button" onClick={(event) => { event.preventDefault();
            const missing = validateCurrentPage();
            if (missing) { setMessage(`الحقل المطلوب غير مكتمل: ${missing}`); return; }
            setMessage(""); setPageIndex((value) => Math.min(pages.length - 1, value + 1));
          }}>التالي</button> : <button className="btn btn-primary" type="submit" disabled={sending || Boolean(uploadingKey)}>{sending ? "جارٍ الإرسال..." : (form.settings.submitLabel || "إرسال النموذج")}</button>}
        </div>
        {message ? <p aria-live="polite">{message}</p> : null}
      </section>
    </form>
  </main>;
}
