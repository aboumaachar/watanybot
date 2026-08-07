import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Medal24Regular } from "../theme/watany-v4/legacyIconBridge";
import { useApp } from "../store/app";
import { api } from "../lib/api";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/Auth.css";

type RegisterForm = {
  username: string;
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useApp();
  const [form, setForm] = useState<RegisterForm>({ username: "", fullName: "", email: "", password: "", phoneNumber: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateField = (key: keyof RegisterForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.register(form);
      await login(form.email, form.password);
      navigate("/profile#account-applications");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page" data-watany-register-page="true">
      <div className="auth-card">
        <button type="button" className="auth-close" onClick={() => navigate("/chat")} aria-label="إغلاق" title="إغلاق">×</button>
        <div className="auth-logo"><Medal24Regular aria-hidden style={{ fontSize: "2.5rem", color: "var(--cedar-600, #0A6847)" }} /></div>
        <h1>إنشاء حساب</h1>
        <p className="auth-subtitle">انضم إلى موطني</p>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="auth-field">
            <label htmlFor="username">اسم المستخدم</label>
            <input id="username" type="text" value={form.username} onChange={updateField("username")} placeholder="user123" required />
          </div>
          <div className="auth-field">
            <label htmlFor="fullName">الاسم الكامل</label>
            <input id="fullName" type="text" value={form.fullName} onChange={updateField("fullName")} placeholder="أحمد حسين" required />
          </div>
          <div className="auth-field">
            <label htmlFor="email">البريد الإلكتروني</label>
            <input id="email" type="email" value={form.email} onChange={updateField("email")} placeholder="name@example.com" required dir="ltr" />
          </div>
          <div className="auth-field">
            <label htmlFor="password">كلمة المرور</label>
            <input id="password" type="password" value={form.password} onChange={updateField("password")} placeholder="6 أحرف على الأقل" required minLength={6} dir="ltr" />
          </div>
          <div className="auth-field">
            <label htmlFor="phoneNumber">رقم الهاتف (اختياري)</label>
            <input id="phoneNumber" type="tel" value={form.phoneNumber} onChange={updateField("phoneNumber")} placeholder="+961-3-123456" dir="ltr" />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "جارٍ التسجيل..." : "إنشاء حساب"}
          </button>
        </form>

        <p className="auth-link">
          لديك حساب؟ {" "}
          <Link to="/login">
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}


