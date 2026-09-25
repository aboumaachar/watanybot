import { useEffect, useRef } from "react";

const ADSENSE_CLIENT = "ca-pub-6562406855952870";
const ADSENSE_SCRIPT_ID = "watany-adsense-script";
const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
const MOBILE_AD_QUERY = "(max-width: 640px)";

const containerStyle = { margin: "0 0 16px", padding: "0 2px" } as const;
const labelStyle = { margin: "0 4px 6px", color: "#88948f", fontSize: "10px", lineHeight: 1.4 } as const;
const desktopFrameStyle = { minHeight: "100px", overflow: "hidden", borderRadius: "14px", background: "rgba(255,255,255,0.018)" } as const;
function mobileFrameStyle(width: number) {
  return {
    width: "100%",
    maxWidth: `${width}px`,
    height: "100px",
    margin: "0 auto",
    overflow: "hidden",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.018)",
  } as const;
}

function salaryAdSlot() {
  const raw = String(import.meta.env.VITE_ADSENSE_SALARY_SLOT_ID ?? "").trim();
  return /^\d+$/.test(raw) ? raw : "9426086926";
}
function ensureAdSenseScript() {
  const existing = document.getElementById(ADSENSE_SCRIPT_ID)
    ?? document.querySelector(`script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`);
  if (existing) return;
  const script = document.createElement("script");
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.src = ADSENSE_SCRIPT_SRC;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export function SalaryAdSensePlacement({ placement = "primary" }: { placement?: "primary" | "results" }) {
  const slot = salaryAdSlot();
  const requestedRef = useRef(false);
  const isMobile = typeof window !== "undefined" && window.matchMedia(MOBILE_AD_QUERY).matches;
  const isNarrowMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 375px)").matches;
  const mobileAdWidth = isNarrowMobile ? 300 : 320;

  useEffect(() => {
    if (!slot || requestedRef.current) return;
    requestedRef.current = true;
    ensureAdSenseScript();
    try {
      const queue = window.adsbygoogle ?? [];
      window.adsbygoogle = queue;
      queue.push({});
    } catch {
      requestedRef.current = false;
    }
  }, [slot]);

  if (!slot) return null;

  const adProps = isMobile
    ? {}
    : { "data-ad-format": "auto", "data-full-width-responsive": "true" };

  return (
    <aside data-feature-key={`salary.adsense.${placement}`} data-adsense-status="configured" aria-label="إعلان" style={containerStyle}>
      <div style={labelStyle}>إعلان</div>
      <div style={isMobile ? mobileFrameStyle(mobileAdWidth) : desktopFrameStyle}>
        <ins
          className="adsbygoogle"
          style={isMobile
            ? { display: "inline-block", width: `${mobileAdWidth}px`, height: "100px" }
            : { display: "block", width: "100%" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          {...adProps}
        />
      </div>
    </aside>
  );
}
