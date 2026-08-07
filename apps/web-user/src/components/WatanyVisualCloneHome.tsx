import { watanyVisualIcons } from "../data/watanyVisualIcons";
import "../styles/watanyVisualCloneHome.css";

function go(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
}

export default function WatanyVisualCloneHome() {
  return (
    <main id="watany-visual-root-v103" dir="rtl" data-testid="watany-visual-root-v103">
      <header className="wvc-topbar" data-testid="wvc-topbar">
        <button className="wvc-logo" type="button" onClick={() => go("/")} aria-label="Watany">
          <img src="/logo.png" alt="Watany" />
        </button>

        <div className="wvc-ticker" data-testid="wvc-ticker">
          <strong>جديد</strong>
          <span>خدمة جديدة</span>
          <i />
          <span>تحديث جديد: دليل المعاشات العسكرية 2024</span>
          <i />
          <span>استعلام عن المعاملات</span>
        </div>

        <button className="wvc-menu" type="button" aria-label="Menu" data-testid="wvc-menu">
          <span />
          <span />
          <span />
        </button>
      </header>

      <section className="wvc-grid" data-testid="wvc-grid">
        {watanyVisualIcons.map((item) => (
          <button
            key={item.id}
            type="button"
            className={"wvc-tile wvc-tone-" + item.tone}
            onClick={() => go(item.href)}
            data-testid={"wvc-icon-" + item.id}
          >
            <span className="wvc-card">
              <img src={item.asset} alt="" />
            </span>
            <span className="wvc-label">{item.label}</span>
          </button>
        ))}
      </section>

      <footer className="wvc-dock" data-testid="wvc-dock">
        <section className="wvc-chat" data-testid="wvc-chat">
          <button type="button" className="wvc-chat-send" aria-label="إرسال">➤</button>
          <input aria-label="اسأل موطني" placeholder="اسأل موطني..." />
          <button type="button" className="wvc-chat-mic" aria-label="صوت">⌕</button>
        </section>

        <nav className="wvc-bottom" data-testid="wvc-bottom">
          <button type="button" onClick={() => go("/")}>
            <img src="/watany-assets/bottom/home.svg" alt="" />
            <span>الرئيسية</span>
          </button>
          <button type="button" onClick={() => go("/downloads")}>
            <img src="/watany-assets/bottom/downloads.svg" alt="" />
            <span>التنزيلات</span>
          </button>
          <button type="button" onClick={() => go("/files")}>
            <img src="/watany-assets/bottom/files.svg" alt="" />
            <span>الملفات</span>
          </button>
          <button type="button" onClick={() => go("/notifications")}>
            <img src="/watany-assets/bottom/bell.svg" alt="" />
            <span>الإشعارات</span>
          </button>
          <button type="button" onClick={() => go("/login")}>
            <img src="/watany-assets/bottom/login.svg" alt="" />
            <span>تسجيل الدخول</span>
          </button>
        </nav>
      </footer>
    </main>
  );
}
