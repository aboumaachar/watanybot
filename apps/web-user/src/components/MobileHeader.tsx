import { useMemo, useState } from "react";
import { useApp } from "../store/app";
import { PopupModal } from "./PopupModal";
import KoudamaFeatureIcon from "./koudama-icons/KoudamaFeatureIcon";

/**
 * v6 header — smartphone app feel:
 * - compact
 * - burger menu
 * - big title
 * - quick font +/- (elderly-friendly)
 */
export function MobileHeader() {
  const { fontSize, setFontSize } = useApp();
  const [showShortcutModal, setShowShortcutModal] = useState(false);

  const order = useMemo(() => ["small", "normal", "large", "xlarge"] as const, []);
  const idx = useMemo(() => Math.max(0, order.indexOf(fontSize as any)), [fontSize, order]);

  function dec() {
    const next = order[Math.max(0, idx - 1)];
    setFontSize(next as any);
    localStorage.setItem("watany_font_level", next);
  }
  function inc() {
    const next = order[Math.min(order.length - 1, idx + 1)];
    setFontSize(next as any);
    localStorage.setItem("watany_font_level", next);
  }

  function openMainMenu() {
    globalThis.dispatchEvent(new CustomEvent("watany-open-main-menu", {
      detail: { focusActiveGroup: false },
    }));
  }

  return (
    <>
      <header className="wt-header" role="banner">
        <button className="wt-iconbtn" onClick={openMainMenu} aria-label="القائمة">
          ☰
        </button>

        <div className="wt-title">موطني</div>

        <div className="wt-header__actions">
          <button className="wt-iconbtn" onClick={() => setShowShortcutModal(true)} aria-label="إضافة اختصار" title="إضافة اختصار">
            <KoudamaFeatureIcon featureId="shortcut" size="sm" />
          </button>
          <button className="wt-iconbtn" onClick={dec} aria-label="تصغير الخط" title="تصغير الخط">
            A-
          </button>
          <button className="wt-iconbtn" onClick={inc} aria-label="تكبير الخط" title="تكبير الخط">
            A+
          </button>
        </div>
      </header>

      <PopupModal open={showShortcutModal} title="إضافة اختصار" onClose={() => setShowShortcutModal(false)}>
        <p>لإضافة موطني إلى سطح المكتب أو الشاشة الرئيسية، استخدم خيار المتصفح "إضافة إلى الشاشة الرئيسية" أو أنشئ اختصاراً يدوياً.</p>
        <p>في الحواسيب: يمكنك سحب أيقونة الموقع من شريط العنوان إلى سطح المكتب.</p>
      </PopupModal>
    </>
  );
}
// APEX_PHASE4D_NAV_DUPLICATE_REVIEW: verify whether this component is still needed under WatanyMobileShell.

