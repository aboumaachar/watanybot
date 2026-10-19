import { type FormEvent, useEffect, useState } from "react";
import LebanonAddressSelector from "../components/address/LebanonAddressSelector";
import type { LebanonAddressValue } from "../components/address/addressTypes";
import { authFetch } from "../lib/api";
import { useApp } from "../store/app";

const emptyForm = {
  jobType: "",
  title: "",
  summary: "",
  skills: "",
  workModes: "",
  availableFrom: "",
  expectedSalary: "",
};

export default function JobReadinessPage() {
  const { apiBaseUrl } = useApp();
  const [form, setForm] = useState(emptyForm);
  const [address, setAddress] = useState<Partial<LebanonAddressValue>>({});
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await authFetch(`${apiBaseUrl}/api/jobs/readiness/mine`);
    if (!response.ok) return;
    const data = await response.json();
    setItems(data.items ?? []);
  }

  useEffect(() => { void load(); }, [apiBaseUrl]);

  async function changeStatus(id: string, status: "ACTIVE" | "PAUSED" | "CLOSED") {
    const response = await authFetch(`${apiBaseUrl}/api/jobs/readiness/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) { setMessage("تعذّر تحديث حالة الطلب."); return; }
    await load();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.mohafaza || !address.qaza || !address.village) {
      setMessage("اختر المحافظة والقضاء والبلدة.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await authFetch(`${apiBaseUrl}/api/jobs/readiness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          skills: form.skills.split(",").map((item) => item.trim()).filter(Boolean),
          workModes: form.workModes.split(",").map((item) => item.trim()).filter(Boolean),
          governorate: address.mohafaza,
          caza: address.qaza,
          locality: address.village,
        }),
      });
      if (!response.ok) {
        setMessage("تعذّر نشر الجاهزية للعمل.");
        return;
      }
      setForm(emptyForm);
      setAddress({});
      setMessage("تم نشر جاهزيتك للعمل بنجاح.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell" dir="rtl">
      <section className="profile-section-card">
        <h1>جاهز للعمل</h1>
        <p>انشر نوع العمل الذي أنت مستعد له ليتمكن أصحاب العمل المعتمدون من العثور عليك.</p>
        <form onSubmit={submit} className="profile-fields-stack">
          <label className="profile-field"><span>نوع العمل *</span><input className="input" required value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })} /></label>
          <label className="profile-field"><span>العنوان المختصر *</span><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="profile-field"><span>نبذة عن الخبرة والجاهزية</span><textarea className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
          <label className="profile-field"><span>المهارات، مفصولة بفواصل</span><input className="input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></label>
          <label className="profile-field"><span>أنماط العمل، مفصولة بفواصل</span><input className="input" value={form.workModes} onChange={(e) => setForm({ ...form, workModes: e.target.value })} /></label>
          <LebanonAddressSelector required value={address} onChange={setAddress} exactAddressLabel="تفصيل إضافي للعنوان (اختياري)" />
          <label className="profile-field"><span>متاح من تاريخ</span><input className="input" type="date" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} /></label>
          <label className="profile-field"><span>الراتب المتوقع (اختياري)</span><input className="input" value={form.expectedSalary} onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })} /></label>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "جارٍ النشر…" : "نشر الجاهزية للعمل"}</button>
        </form>
        {message ? <p aria-live="polite">{message}</p> : null}
      </section>
      <section className="profile-section-card">
        <h2>طلباتي المنشورة</h2>
        {items.length === 0 ? <p>لا توجد طلبات جاهزية منشورة بعد.</p> : null}
        {items.map((item) => (
          <article key={item.id} className="utility-action-card utility-action-card--static">
            <strong>{item.title}</strong>
            <span>{item.job_type} · {item.status}</span>
            <div>
              {item.status !== "ACTIVE" ? <button type="button" onClick={() => void changeStatus(item.id, "ACTIVE")}>تفعيل</button> : null}
              {item.status === "ACTIVE" ? <button type="button" onClick={() => void changeStatus(item.id, "PAUSED")}>إيقاف مؤقت</button> : null}
              {item.status !== "CLOSED" ? <button type="button" onClick={() => void changeStatus(item.id, "CLOSED")}>إغلاق</button> : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
