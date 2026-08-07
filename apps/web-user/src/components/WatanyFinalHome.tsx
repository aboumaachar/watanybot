import { watanyHomeIcons } from "../data/watanyHomeIcons";
import "../styles/watanyFinalHome.css";

export default function WatanyFinalHome() {
  function go(path: string) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <main className="watany-final-shell" dir="rtl" data-testid="watany-final-home">
      <header className="watany-final-topbar" data-testid="watany-final-topbar">
        <img className="watany-final-logo" src="/logo.png" alt="موطني" />
        <div className="watany-final-ticker" aria-label="آخر التحديثات">
          <strong>جديد</strong>
          <span>خدمة جديدة</span>
          <i />
          <span>تحديث جديد: دليل المعاشات العسكرية 2024</span>
          <i />
          <span>استعلام عن المعاملات</span>
        </div>
        <button className="watany-final-menu" type="button" aria-label="القائمة" data-testid="watany-menu-button">
          <span />
          <span />
          <span />
        </button>
      </header>

      <section className="watany-final-icon-grid" aria-label="القائمة الرئيسية">
        {watanyHomeIcons.map((item) => (
          <button
            type="button"
            key={item.id}
            className={"watany-final-icon watany-tone-" + item.tone}
            onClick={() => go(item.href)}
            data-testid={"watany-home-icon-" + item.id}
          >
            <span className="watany-final-icon-frame">
              <img src={item.asset} alt="" />
            </span>
            <span className="watany-final-icon-label">{item.label}</span>
          </button>
        ))}
      </section>

      <section className="watany-final-chat" data-testid="watany-hybrid-chat-bar" aria-label="اسأل موطني">
        <button type="button" className="watany-chat-send" aria-label="إرسال">➤</button>
        <input aria-label="اسأل موطني" placeholder="اسأل موطني..." />
        <button type="button" className="watany-chat-mic" aria-label="تسجيل صوتي">⌕</button>
      </section>

      <nav className="watany-final-bottom" data-testid="watany-bottom-bar" aria-label="التنقل السفلي">
        <button type="button" onClick={() => go("/")}>
          <span className="watany-bottom-sign">⌂</span>
          <b>الرئيسية</b>
        </button>
        <button type="button" onClick={() => go("/downloads")}>
          <span className="watany-bottom-sign">⇩</span>
          <b>التنزيلات</b>
        </button>
        <button type="button" onClick={() => go("/files")}>
          <span className="watany-bottom-sign">▭</span>
          <b>الملفات</b>
        </button>
        <button type="button" onClick={() => go("/notifications")}>
          <span className="watany-bottom-sign">♧</span>
          <b>الإشعارات</b>
        </button>
        <button type="button" onClick={() => go("/login")}>
          <span className="watany-bottom-sign">↪</span>
          <b>تسجيل الدخول</b>
        </button>
      </nav>
    </main>
  );
}
