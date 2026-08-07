import "../../styles/motanyLoginLanding.css";

type MotanyLoginLandingProps = {
  onContinue: () => void;
  onGoogleContinue: () => void;
  onForgotPassword: () => void;
  onCreateAccount: () => void;
  onContinueAsGuest: () => void;
};

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.8 6.8h14.4c.72 0 1.3.58 1.3 1.3v8.05c0 .72-.58 1.3-1.3 1.3H4.8c-.72 0-1.3-.58-1.3-1.3V8.1c0-.72.58-1.3 1.3-1.3Z" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="m4.35 8.25 7.12 5.05c.32.22.74.22 1.06 0l7.12-5.05" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GuestIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 12.25c2.1 0 3.8-1.7 3.8-3.8S14.1 4.65 12 4.65s-3.8 1.7-3.8 3.8 1.7 3.8 3.8 3.8Z" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M5.2 20.15c.72-3.25 3.34-5.3 6.8-5.3s6.08 2.05 6.8 5.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export default function MotanyLoginLanding({
  onContinue,
  onGoogleContinue,
  onForgotPassword,
  onCreateAccount,
  onContinueAsGuest,
}: Readonly<MotanyLoginLandingProps>) {
  return (
    <main className="motany-login-redesign" dir="rtl" data-apex-motany-login-viewer="true" data-watany-feature="login">
      <section className="motany-login-screen" aria-labelledby="motany-login-title">
        <div className="motany-login-spacer" aria-hidden="true" />

        <header className="motany-login-brand" aria-label="موطني">
          {/* logo removed */}
          {/* large logo removed */}

          {/* Welcome lines removed per configuration */}
        </header>

        <section className="motany-login-card" aria-label="تسجيل الدخول إلى موطني">
          <h1 id="motany-login-title" className="motany-login-title">تسجيل الدخول</h1>
          <p className="motany-login-subtitle">
            مرحباً بك في موطني، سجّل دخولك للمتابعة والوصول إلى خدماتك بسهولة
          </p>

          <label className="motany-login-label" htmlFor="motany-login-identity">
            البريد الإلكتروني أو رقم الهاتف
          </label>
          <button
            type="button"
            className="motany-login-input-shell"
            onClick={onContinue}
            aria-label="إدخال البريد الإلكتروني أو رقم الهاتف"
          >
            <span className="motany-login-input-icon"><MailIcon /></span>
            <span id="motany-login-identity" className="motany-login-input-fake">
              ادخل بريدك الإلكتروني أو رقم هاتفك
            </span>
          </button>

          <button type="button" className="motany-login-primary" onClick={onContinue}>
            <span className="motany-login-primary-arrow" aria-hidden="true">‹</span>
            <span>متابعة</span>
            <span aria-hidden="true" />
          </button>

          <div className="motany-login-divider" role="separator" aria-label="أو">أو</div>

          <button type="button" className="motany-login-google" onClick={onGoogleContinue}>
            <span className="motany-login-google-logo" aria-hidden="true">G</span>
            <span>متابعة عبر Google</span>
            <span aria-hidden="true" />
          </button>

          <button type="button" className="motany-login-link motany-login-forgot" onClick={onForgotPassword}>
            نسيت كلمة المرور؟
          </button>
        </section>

        <section className="motany-login-register" aria-label="إنشاء حساب">
          <span>ليس لديك حساب؟</span>
          <button type="button" className="motany-login-register-link" onClick={onCreateAccount}>
            إنشاء حساب جديد
          </button>
          <span className="motany-login-register-arrow" aria-hidden="true">‹</span>
        </section>

        <button type="button" className="motany-login-guest" onClick={onContinueAsGuest}>
          <span className="motany-login-guest-icon"><GuestIcon /></span>
          <span className="motany-login-guest-copy">
            <span className="motany-login-guest-title">المتابعة كزائر</span>
            <span className="motany-login-guest-subtitle">تصفح الخدمات المتاحة بدون تسجيل دخول</span>
          </span>
        </button>
      </section>
    </main>
  );
}
