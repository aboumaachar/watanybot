import { useState } from "react";
import { authFetch } from "../../lib/api";
import { useApp } from "../../store/app";

export default function JobAccountSecurityCard() {
  const { apiBaseUrl, profile } = useApp();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    if (newPassword.length < 8) return setStatus("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
    if (newPassword !== confirmPassword) return setStatus("تأكيد كلمة المرور غير مطابق.");
    setSaving(true);
    try {
      const response = await authFetch(`${apiBaseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus(data?.error === "CURRENT_PASSWORD_INVALID" ? "كلمة المرور الحالية غير صحيحة." : "تعذّر تغيير كلمة المرور.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("تم تغيير كلمة المرور بنجاح.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-section-card">
      <div className="section-title">أمان حساب الوظائف</div>
      {profile.mustChangePassword ? (
        <p>تم إنشاء الحساب من طلب وظيفة. غيّر كلمة المرور الأولية لحماية حسابك.</p>
      ) : (
        <p>يمكنك تغيير كلمة مرور حسابك من هنا.</p>
      )}
      <form onSubmit={submit} className="profile-fields-stack">
        <label className="profile-field">
          <span>كلمة المرور الحالية</span>
          <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </label>
        <label className="profile-field">
          <span>كلمة المرور الجديدة</span>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
        </label>
        <label className="profile-field">
          <span>تأكيد كلمة المرور الجديدة</span>
          <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
        </button>
      </form>
      {status ? <p aria-live="polite">{status}</p> : null}
    </section>
  );
}
