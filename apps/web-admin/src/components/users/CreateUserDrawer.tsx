import { useState, type FormEvent } from "react";
import { adminFetch } from "../../lib/api";
import { AdminDetailDrawer, AdminNotice } from "../admin/AdminPrimitives";

const ROLE_OPTIONS = [
  ["public", "عام"],
  ["accredited", "معتمد"],
  ["driver", "سائق"],
  ["moderator", "مشرف"],
  ["admin", "مدير"],
  ["superadmin", "مدير أعلى"],
] as const;

export function CreateUserDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("public");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, email, phone, password, role, status }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "تعذر إنشاء المستخدم");
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء المستخدم");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminDetailDrawer title="إضافة مستخدم" onClose={onClose}>
      <div className="user-management-card">
        <p className="muted">أنشئ الحساب من مسار الإدارة الرسمي. تعيين أدوار المدير محمي من جهة الخادم.</p>
        {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
        <form className="user-management-form" onSubmit={submit}>
          <label><span>الاسم</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span>البريد الإلكتروني</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><span>الهاتف</span><input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label><span>كلمة المرور الأولية</span><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label><span>الدور</span><select value={role} onChange={(event) => setRole(event.target.value)}>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>الحالة</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">نشط</option><option value="suspended">موقوف</option><option value="banned">محظور</option></select></label>
          <div className="user-management-form-actions">
            <button type="button" className="ghost" onClick={onClose}>إلغاء</button>
            <button type="submit" className="accent" disabled={busy}>{busy ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button>
          </div>
        </form>
      </div>
    </AdminDetailDrawer>
  );
}
