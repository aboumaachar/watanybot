import { useEffect, useState, type CSSProperties } from "react";
import { PopupModal } from "./PopupModal";
import { UtilityActionIcon } from "./UtilityActionIcon";
import { usePwaInstall } from "../pwa/usePwaInstall";
import KoudamaFeatureIcon from "./koudama-icons/KoudamaFeatureIcon";

const INSTALL_CONFIRMED_KEY = "watany_pwa_prompt_installed_v1";

type UtilityActionStyle = CSSProperties & Record<"--utility-color", string>;

const installUtilityStyle: UtilityActionStyle = { "--utility-color": "#0f766e" };
const fullscreenUtilityStyle: UtilityActionStyle = { "--utility-color": "#2563eb" };

function readBooleanStorage(key: string) {
  return globalThis.localStorage?.getItem(key) === "1";
}

async function requestAppFullscreen() {
  if (typeof document === "undefined" || typeof document.documentElement.requestFullscreen !== "function") {
    return false;
  }

  try {
    await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export function PwaInstallController() {
  const { platform, canInstall, isStandalone, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone || readBooleanStorage(INSTALL_CONFIRMED_KEY));

  useEffect(() => {
    if (!isStandalone) return;
    setInstalled(true);
    globalThis.localStorage?.setItem(INSTALL_CONFIRMED_KEY, "1");
  }, [isStandalone]);

  useEffect(() => {
    const openPrompt = () => {
      if (!installed) {
        setOpen(true);
      }
    };
    const requestImmersive = () => {
      void requestAppFullscreen();
    };

    globalThis.addEventListener("watany-open-install-prompt", openPrompt);
    globalThis.addEventListener("watany-enter-fullscreen", requestImmersive);

    return () => {
      globalThis.removeEventListener("watany-open-install-prompt", openPrompt);
      globalThis.removeEventListener("watany-enter-fullscreen", requestImmersive);
    };
  }, [installed]);

  async function handleInstall() {
    if (platform === "ios" && !canInstall) {
      setOpen(false);
      return;
    }

    setInstalling(true);
    try {
      const accepted = await promptInstall();
      if (accepted) {
        setInstalled(true);
        globalThis.localStorage?.setItem(INSTALL_CONFIRMED_KEY, "1");
        setOpen(false);
      }
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    setOpen(false);
  }

  if (!open) return null;

  return (
    <PopupModal open={open} title="ثبّت موطني على جهازك" onClose={handleDismiss} icon={<KoudamaFeatureIcon featureId="install" size="sm" />} variant="premium">
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <strong style={{ color: "var(--ink)" }}>وضع الهاتف الكامل جاهز الآن</strong>
          <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>
            ثبّت التطبيق لتشغيله كواجهة هاتف كاملة، ثم فعّل ملء الشاشة لعرض أكثر اندماجاً مع تذكّر تفضيلك لاحقاً.
          </p>
          {platform === "ios" && !canInstall ? (
            <p style={{ color: "var(--ink-3)", lineHeight: 1.8 }}>
              على iPhone وiPad استخدم زر المشاركة ثم اختر "إضافة إلى الشاشة الرئيسية".
            </p>
          ) : null}
        </div>

        <div className="utility-action-grid utility-action-grid--compact">
          <div className="utility-action-card utility-action-card--static" style={installUtilityStyle}>
            <UtilityActionIcon icon={<KoudamaFeatureIcon featureId="install" size="sm" />} />
            <span className="utility-action-card__label">تثبيت التطبيق</span>
            <span className="utility-action-card__desc">إضافة موطني إلى الشاشة الرئيسية مع تذكّر حالة التثبيت.</span>
          </div>
          <div className="utility-action-card utility-action-card--static" style={fullscreenUtilityStyle}>
            <UtilityActionIcon icon={<KoudamaFeatureIcon featureId="fullscreen" size="sm" />} />
            <span className="utility-action-card__label">ملء الشاشة</span>
            <span className="utility-action-card__desc">تفعيل العرض الغامر الآن ثم إعادة طلبه تلقائياً عند الفتح التالي بعد أول لمسة.</span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button className="btn" type="button" onClick={() => void handleInstall()} disabled={installing || (!canInstall && platform !== "ios")}>
            {installing ? "جارٍ التثبيت…" : "ثبّت الآن"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              void requestAppFullscreen();
            }}
          >
            فعّل ملء الشاشة
          </button>
          <button className="btn" type="button" onClick={handleDismiss}>
            لاحقاً
          </button>
        </div>
      </div>
    </PopupModal>
  );
}