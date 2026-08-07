import { useState } from "react";
import { useApp } from "../store/app";
import { PopupModal } from "./PopupModal";
import { Ticker } from "./Ticker";

const LOGO_SRC = "/logo.png";

export function TopBar() {
  const { apiBaseUrl } = useApp();
  const [showShortcut, setShowShortcut] = useState(false);
  // Minimal topbar: logo | ticker | burger. Profile/login removed from header per spec.

  return (
    <header className="topbar" aria-label="topbar" dir="rtl">
      <div className="watany-logo-wrap">
        <img src={LOGO_SRC} alt="Watany" className="watany-logo" />
      </div>
      <div className="watany-ticker-wrap">
        <Ticker apiBaseUrl={apiBaseUrl} />
      </div>
      <div className="watany-burger-wrap">
        <button className="watany-burger" type="button" onClick={() => setShowShortcut(true)}>
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <PopupModal open={showShortcut} title="Shortcut" onClose={() => setShowShortcut(false)}>
        <p>Save shortcut.</p>
      </PopupModal>
    </header>
  );
}
