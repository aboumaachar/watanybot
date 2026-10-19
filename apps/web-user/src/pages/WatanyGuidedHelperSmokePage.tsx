import { useNavigate } from 'react-router-dom';
import '../styles/watany-welcome-clone.css';

export default function WatanyGuidedSmokePage() {
  const navigate = useNavigate();

  return (
    <main className="watany-welcome-page" dir="rtl" aria-label="أهلاً بك في موطني">
      <section className="screen welcome active" data-id="welcome" aria-label="صفحة الترحيب">
        <div className="welcome-top-half">
          <img
            className="welcome-logo"
            src="/logo-welcome.webp"
            alt="شعار موطني"
            width={512}
            height={512}
            fetchPriority="high"
          />
        </div>

        <div className="welcome-bottom-half">
          <div className="welcome-cta-group">
            <h1>أهلاً بك في موطني</h1>
            <p>خدمات ومعلومات موحدة بواجهة واضحة وسهلة الاستخدام.</p>
            <button type="button" className="primary" onClick={() => navigate('/login')}>
              <span className="welcome-cta-arrow" aria-hidden="true">‹</span>
              <span className="welcome-cta-label">تسجيل الدخول</span>
            </button>
            <button type="button" className="secondary" onClick={() => navigate('/home')}>
              <span className="welcome-cta-arrow" aria-hidden="true">‹</span>
              <span className="welcome-cta-label">المتابعة كزائر</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
