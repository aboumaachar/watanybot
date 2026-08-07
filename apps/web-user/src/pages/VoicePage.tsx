import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic24Regular, Chat24Regular } from "../theme/watany-v4/legacyIconBridge";
import { WatanyFeatureTemplate } from "../components/template";

export default function VoicePage() {
  const navigate = useNavigate();
  const speechSupported = useMemo(() => {
    const windowWithSpeech = globalThis.window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return Boolean(windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition);
  }, []);
  const [status, setStatus] = useState(speechSupported ? "المتصفح يدعم الإدخال الصوتي." : "المتصفح الحالي لا يعلن دعماً مباشراً للإدخال الصوتي.");

  return (
    <WatanyFeatureTemplate category="chat" title="الصوت">
      <main data-watany-feature-route="voice" className="hybrid-screen" dir="rtl">
        <section className="hybrid-section">
          <div className="hybrid-section__header">
            <div>
              <span className="hybrid-section__eyebrow">قناة صوتية ميسرة</span>
              <h1 className="hybrid-section__title">ابدأ من مساعد موطني</h1>
            </div>
          </div>
          <p>هذه الصفحة تتحقق من قدرة المتصفح وتوجهك إلى قناة المحادثة المعتمدة بدل فتح تجربة صوتية منفصلة.</p>
        </section>
        <section className="community-shortcuts community-shortcuts--dense" aria-label="إجراءات الصوت">
          <button type="button" className="community-shortcut" onClick={() => setStatus(speechSupported ? "يمكن استخدام الصوت من إعدادات المتصفح أو لوحة المفاتيح الصوتية." : "استخدم لوحة المفاتيح الصوتية في الجهاز أو افتح المحادثة النصية.") }>
            <Mic24Regular aria-hidden />
            <span className="community-shortcut__label">فحص قدرة الصوت</span>
            <span className="community-shortcut__hint">{status}</span>
          </button>
          <button type="button" className="community-shortcut" onClick={() => navigate("/chat")}>
            <Chat24Regular aria-hidden />
            <span className="community-shortcut__label">فتح محادثة موطني</span>
            <span className="community-shortcut__hint">القناة المعتمدة للأسئلة والمتابعة.</span>
          </button>
        </section>
      </main>
    </WatanyFeatureTemplate>
  );
}

